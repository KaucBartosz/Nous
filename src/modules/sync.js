// src/modules/sync.js

import { db } from "../firebaseConfig.js";
import {
  collection,
  addDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getPendingResults, markAsSynced } from "./database.js";
import { getCurrentUser, getUserStatus } from "./auth.js";
import { Dialog } from "./dialog.js";
import { toast, syncCountMessage } from "../notify/notify.js";
import { hasCloudKey, encryptCloudData } from "./cryptoService.js";
import { isCloudSyncAllowed } from "../session/session.js";
import {
  selectSyncable,
  syncBlockReason,
  manualSyncBlockReason,
  packRecord,
  syncOneRecord,
  syncAll,
} from "../sync/syncEngine.js";

let isAutoSyncEnabled = (() => {
  try {
    return localStorage.getItem("autoSync") === "true";
  } catch {
    return false;
  }
})(); // Default false
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
  // Synchronizować mogą wyłącznie zatwierdzeni użytkownicy (konta lokalne/goście nigdy).
  if (!isCloudSyncAllowed(status)) {
    if (isAutoSyncEnabled) {
      console.log("AutoSync disabled due to status:", status);
      isAutoSyncEnabled = false;
      localStorage.setItem("autoSync", "false");
      const toggleSync = document.getElementById("toggle-sync");
      if (toggleSync) toggleSync.checked = false;
    }
    return;
  }
}

export function setAutoSync(enabled) {
  // Zapamiętaj poprzedni stan przed zmianą
  const previousState = isAutoSyncEnabled;

  if (enabled) {
    const userStatus = getUserStatus();
    if (!isCloudSyncAllowed(userStatus)) {
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

// Komunikaty skipów — te same co wcześniej (kolejność guardów w SyncEngine).
const SYNC_SKIP_LOG = {
  disabled: "Sync skipped: Auto-Sync is disabled by user.",
  "local-session": "Sync skipped: konto lokalne/gość nie synchronizuje z chmurą.",
  offline: "Sync skipped: Offline.",
  "no-user": "Sync skipped: No user logged in.",
  "in-progress": "Sync skipped: Already in progress.",
};

// Prawdziwe I/O wstrzykiwane do SyncEngine (Firestore + klucz chmurowy E2E).
const cloudCrypto = {
  hasKey: () => hasCloudKey(),
  encrypt: (payload) => encryptCloudData(payload),
};
const firestoreIo = {
  packRecord: (record) =>
    packRecord(record, cloudCrypto, {
      onUnencrypted: () =>
        console.warn("Wysyłanie nieszyfrowanych danych! Brak klucza chmurowego."),
    }),
  saveRemote: (doc) => addDoc(collection(db, "results"), doc),
  markSynced: (localId, remoteId) => markAsSynced(localId, remoteId),
};

export async function syncNow() {
  // D: guardy w SyncEngine (ta sama kolejność, te same logi)
  const user = getCurrentUser();
  const reason = syncBlockReason({
    autoSyncEnabled: isAutoSyncEnabled,
    status: getUserStatus(),
    online: navigator.onLine,
    user,
    syncing: isSyncing,
  });
  if (reason) {
    console.log(SYNC_SKIP_LOG[reason]);
    return;
  }

  const allPending = await getPendingResults(user.uid);
  // Bezpiecznik: pomijamy wyniki kont lokalnych nawet jeśli trafiły do PENDING
  const pending = selectSyncable(allPending);
  if (pending.length === 0) {
    console.log("Nothing to sync for user:", user.uid);
    return;
  }

  // Rozpocznij synchronizację
  isSyncing = true;
  updateSyncUI(true, pending.length);

  console.log(`Syncing ${pending.length} results...`);

  let result = { synced: [], failed: [], halted: false };

  try {
    result = await syncAll(pending, firestoreIo, {
      onProgress: (done, total) => updateSyncUI(true, total - done),
    });
    for (const f of result.failed) {
      console.error(`Failed to sync record ${f.id}:`, f.error);
    }
    if (result.halted) {
      updateSyncUI(false, 0);
      Dialog.alert(
        `Błąd synchronizacji: Brak uprawnień. Sprawdź czy Twój status to 'APPROVED' i czy reguły bazy danych są poprawne.`,
        "error",
      );
    }
  } finally {
    // Zakończ synchronizację — zawsze resetuj flagę
    isSyncing = false;
    updateSyncUI(false, 0);
  }

  // #13: Show toast after successful sync
  if (result.synced.length > 0) {
    showSyncToast(result.synced.length);
  }

  // Notify UI to refresh history table if visible
  window.dispatchEvent(new Event("sync-complete"));
}

/**
 * Wewnętrzna funkcja wysyłająca pojedyńczy rekord (bez obsługi UI globalnego sync).
 * Wyrzuca błąd w przypadku niepowodzenia.
 */
async function syncSingleResultInternal(record) {
  const res = await syncOneRecord(record, firestoreIo);
  if (res.skipped) {
    console.warn(
      `syncSingleResultInternal: Pomijam wynik LOCAL (${record.id})`,
    );
    return;
  }
  console.log(`Synced record ${record.id} -> ${res.remoteId}`);
}

/**
 * Manualna synchronizacja pojedynczego wyniku (wywoływana z UI).
 */
// Komunikaty ręcznej wysyłki — te same co wcześniej.
const MANUAL_BLOCK_MESSAGE = {
  "local-session":
    "Synchronizacja z chmurą nie jest dostępna dla kont lokalnych i trybu Gościa.",
  "local-record":
    "Ten wynik pochodzi z konta lokalnego i nie może być synchronizowany z chmurą.",
  offline: "Brak połączenia z internetem.",
  "no-user": "Użytkownik nie jest zalogowany.",
  "foreign-record": "Nie możesz wysłać wyniku należącego do innego użytkownika.",
};

export async function syncSingleResult(record) {
  // D: guardy w SyncEngine (ta sama kolejność, te same komunikaty)
  const user = getCurrentUser();
  const reason = manualSyncBlockReason(record, {
    status: getUserStatus(),
    online: navigator.onLine,
    user,
  });
  if (reason) throw new Error(MANUAL_BLOCK_MESSAGE[reason]);

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
 * #13 — Pokazuje toast po pomyślnej synchronizacji (C5: konstrukcja w notify).
 */
function showSyncToast(count) {
  toast({
    id: "sync-toast",
    titleHtml: `<span class="material-icons" style="font-size:18px;vertical-align:middle;margin-right:6px;">cloud_done</span>Synchronizacja`,
    messageHtml: syncCountMessage(count),
    autoDismissMs: 4000,
  });
}
