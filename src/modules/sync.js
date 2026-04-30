// src/modules/sync.js

import { db } from "../firebaseConfig.js";
import {
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getPendingResults, markAsSynced } from "./database.js";
import { getCurrentUser, getUserStatus } from "./auth.js";
import { Dialog } from "./dialog.js";

let isAutoSyncEnabled = localStorage.getItem("autoSync") === "true"; // Default false
let isSyncing = false; // Flaga statusu synchronizacji

export function initSyncService() {
  window.addEventListener("online", () => {
    console.log("Online Detected. Attempting sync...");
    syncNow();
  });

  // Check status check moved to enforceSyncPolicy called by auth
  // Initial sync attempt
  if (navigator.onLine) {
    setTimeout(syncNow, 5000);
  }
}

export function enforceSyncPolicy(status) {
  // Konta lokalne i goście nigdy nie synchronizują — wymusz wyłączenie i zakończ
  if (status === "LOCAL" || status === "GUEST") {
    if (isAutoSyncEnabled) {
      console.log(
        "AutoSync disabled: konto lokalne/gość nie synchronizuje z chmurą.",
      );
      isAutoSyncEnabled = false;
      localStorage.setItem("autoSync", "false");
      const toggleSync = document.getElementById("toggle-sync");
      if (toggleSync) toggleSync.checked = false;
    }
    return; // Wyjdź — dalsze sprawdzenia nie mają sensu
  }

  if (isAutoSyncEnabled && status !== "APPROVED") {
    console.log("AutoSync disabled due to non-approved status:", status);
    isAutoSyncEnabled = false;
    localStorage.setItem("autoSync", "false");
    const toggleSync = document.getElementById("toggle-sync");
    if (toggleSync) toggleSync.checked = false;
  }
}

export function setAutoSync(enabled) {
  // Zapamiętaj poprzedni stan przed zmianą
  const previousState = isAutoSyncEnabled;

  if (enabled) {
    const userStatus = getUserStatus();
    if (userStatus !== "APPROVED") {
      const toggleSync = document.getElementById("toggle-sync");
      if (toggleSync) toggleSync.checked = false;

      Dialog.alert(
        "Tryb Sync jest dostępny tylko dla zatwierdzonych użytkowników. Aby nim zostać skontaktuj się z Administratorem (Bartosz Kauc)",
        "error",
      );
      return;
    }
  }

  isAutoSyncEnabled = enabled;
  localStorage.setItem("autoSync", enabled);

  // Animacja toggle
  const toggleContainer = document.getElementById("sync-toggle-container");
  if (toggleContainer) {
    toggleContainer.classList.add("sync-toggled");
    setTimeout(() => toggleContainer.classList.remove("sync-toggled"), 300);
  }

  // Wywołaj synchronizację TYLKO gdy sync był wyłączony i został włączony
  // (przełącznik zmienił stan z false na true)
  if (enabled && !previousState && navigator.onLine) {
    console.log("Sync został włączony - sprawdzam oczekujące wyniki...");
    syncNow();
  }
}

export function getAutoSyncState() {
  return isAutoSyncEnabled;
}

export function isSyncInProgress() {
  return isSyncing;
}

export async function syncNow() {
  if (!isAutoSyncEnabled) {
    console.log("Sync skipped: Auto-Sync is disabled by user.");
    return;
  }

  // Konto lokalne lub gość — nigdy nie łączymy się z Firebase
  const userStatus = getUserStatus();
  if (userStatus === "LOCAL" || userStatus === "GUEST") {
    console.log("Sync skipped: konto lokalne/gość nie synchronizuje z chmurą.");
    return;
  }

  if (!navigator.onLine) {
    console.log("Sync skipped: Offline.");
    return;
  }

  const user = getCurrentUser();
  if (!user) {
    console.log("Sync skipped: No user logged in.");
    return;
  }

  if (isSyncing) {
    console.log("Sync skipped: Already in progress.");
    return;
  }

  const allPending = await getPendingResults(user.uid);
  // Bezpiecznik: pomijamy wyniki kont lokalnych nawet jeśli trafiły do PENDING
  const pending = allPending.filter(
    (r) =>
      r.sync_status !== "LOCAL" &&
      !(r.researcher_uid && r.researcher_uid.startsWith("LOCAL::")),
  );
  if (pending.length === 0) {
    console.log("Nothing to sync for user:", user.uid);
    return;
  }

  // Rozpocznij synchronizację
  isSyncing = true;
  updateSyncUI(true, pending.length);

  console.log(`Syncing ${pending.length} results...`);

  let synced_count = 0;

  for (const record of pending) {
    try {
      await syncSingleResultInternal(record); // Użyj wspólnej funkcji wewn.
      synced_count++;

      // Aktualizuj progress
      updateSyncUI(true, pending.length - synced_count);
    } catch (e) {
      console.error(`Failed to sync record ${record.id}:`, e);

      if (e.code === "permission-denied") {
        isSyncing = false;
        updateSyncUI(false, 0);
        import("./dialog.js").then(({ Dialog }) => {
          Dialog.alert(
            `Błąd synchronizacji: Brak uprawnień. Sprawdź czy Twój status to 'APPROVED' i czy reguły bazy danych są poprawne.`,
            "error",
          );
        });
        break; // Stop syncing on perm error
      }
    }
  }

  // Zakończ synchronizację
  isSyncing = false;
  updateSyncUI(false, 0);

  // #13: Show toast after successful sync
  if (synced_count > 0) {
    showSyncToast(synced_count);
  }

  // Notify UI to refresh history table if visible
  window.dispatchEvent(new Event("sync-complete"));
}

import { hasCloudKey, encryptCloudData } from "./cryptoService.js";

/**
 * Wewnętrzna funkcja wysyłająca pojedyńczy rekord (bez obsługi UI globalnego sync).
 * Wyrzuca błąd w przypadku niepowodzenia.
 */
async function syncSingleResultInternal(record) {
  // Nigdy nie synchronizuj wyników z kont lokalnych do chmury
  if (
    record.sync_status === "LOCAL" ||
    (record.researcher_uid && record.researcher_uid.startsWith("LOCAL::"))
  ) {
    console.warn(
      `syncSingleResultInternal: Pomijam wynik LOCAL (${record.id})`,
    );
    return;
  }

  let finalData = record.wyniki || record.data;
  let finalDemographics = record.demographics;
  let isEncrypted = false;
  let iv = null;

  // Szyfruj logiką chmurową E2E jeśli klucz jest dostępny (a powinien zawsze być dla zalogowanego)
  if (hasCloudKey()) {
    const payloadToEncrypt = {
      data: finalData,
      demographics: finalDemographics,
    };
    const encrypted = await encryptCloudData(payloadToEncrypt);
    finalData = encrypted.payload;
    finalDemographics = null; // Ukrywamy dane wrażliwe (są wewnątrz szyfrogramu)
    iv = encrypted.iv;
    isEncrypted = true;
  } else {
    console.warn("Wysyłanie nieszyfrowanych danych! Brak klucza chmurowego.");
  }

  const docRef = await addDoc(collection(db, "results"), {
    researcher_uid: record.researcher_uid,
    test_id: record.test_id || record.testId,
    subject_id: record.subject_id,
    demographics: finalDemographics,
    data: finalData,
    iv: iv,
    is_encrypted: isEncrypted,
    timestamp: record.timestamp,
    synced_at: new Date().toISOString(),
  });

  await markAsSynced(record.id, docRef.id);
  console.log(`Synced record ${record.id} -> ${docRef.id}`);
}

/**
 * Manualna synchronizacja pojedynczego wyniku (wywoływana z UI).
 */
export async function syncSingleResult(record) {
  // Konta lokalne nie synchronizują z chmurą
  const userStatus = getUserStatus();
  if (userStatus === "LOCAL" || userStatus === "GUEST") {
    throw new Error(
      "Synchronizacja z chmurą nie jest dostępna dla kont lokalnych i trybu Gościa.",
    );
  }

  // Jawna blokada po stronie rekordu (ochrona przed wywołaniem z nieprawidłowym rekordem)
  if (
    record.sync_status === "LOCAL" ||
    (record.researcher_uid && record.researcher_uid.startsWith("LOCAL::"))
  ) {
    throw new Error(
      "Ten wynik pochodzi z konta lokalnego i nie może być synchronizowany z chmurą.",
    );
  }

  if (!navigator.onLine) {
    throw new Error("Brak połączenia z internetem.");
  }

  const user = getCurrentUser();
  if (!user) {
    throw new Error("Użytkownik nie jest zalogowany.");
  }

  if (record.researcher_uid !== user.uid) {
    throw new Error(
      "Nie możesz wysłać wyniku należącego do innego użytkownika.",
    );
  }

  try {
    await syncSingleResultInternal(record);
    window.dispatchEvent(new Event("sync-complete"));
    return { success: true };
  } catch (e) {
    console.error(`Failed to manually sync record ${record.id}:`, e);
    if (e.code === "permission-denied") {
      throw new Error(
        "Brak uprawnień (Permission Denied). Sprawdź status Approved.",
      );
    }
    throw e;
  }
}

/**
 * Aktualizuje UI podczas synchronizacji (animacja toggle).
 */
function updateSyncUI(syncing, remaining) {
  const toggleContainer = document.getElementById("sync-toggle-container");
  const toggleLabel = document.getElementById("sync-status-label");

  if (toggleContainer) {
    if (syncing) {
      toggleContainer.classList.add("syncing");
      if (toggleLabel) {
        toggleLabel.textContent = `SYNC (${remaining})`;
      }
    } else {
      toggleContainer.classList.remove("syncing");
      if (toggleLabel) {
        toggleLabel.textContent = "SYNC";
      }
    }
  }
}

/**
 * #13 — Pokazuje toast po pomyślnej synchronizacji.
 * @param {number} count - Liczba zsynchronizowanych wyników
 */
function showSyncToast(count) {
  // Prevent duplicates
  if (document.getElementById("sync-toast")) return;

  const toast = document.createElement("div");
  toast.id = "sync-toast";
  toast.className = "toast-notification";
  toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-header">
                <h4 class="toast-title"><span class="material-icons" style="font-size:18px;vertical-align:middle;margin-right:6px;">cloud_done</span>Synchronizacja</h4>
                <button class="toast-close">&times;</button>
            </div>
            <p class="toast-message">Zsynchronizowano ${count} ${count === 1 ? "wynik" : count < 5 ? "wyniki" : "wyników"}.</p>
        </div>
    `;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);

  const close = () => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  };

  toast.querySelector(".toast-close").addEventListener("click", close);
  // Auto-dismiss after 4 seconds
  setTimeout(close, 4000);
}
