// src/modules/sync.js

import { db } from '../firebaseConfig.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getPendingResults, markAsSynced } from './database.js';
import { getCurrentUser, getUserStatus } from './auth.js';
import { Dialog } from './dialog.js';

let isAutoSyncEnabled = localStorage.getItem('autoSync') === 'true'; // Default false
let isSyncing = false; // Flaga statusu synchronizacji

export function initSyncService() {
    window.addEventListener('online', () => {
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
    if (isAutoSyncEnabled && status !== 'APPROVED') {
        console.log("AutoSync disabled due to non-approved status:", status);
        isAutoSyncEnabled = false;
        localStorage.setItem('autoSync', 'false');
        const toggleSync = document.getElementById('toggle-sync');
        if (toggleSync) toggleSync.checked = false;
    }
}

export function setAutoSync(enabled) {
    // Zapamiętaj poprzedni stan przed zmianą
    const previousState = isAutoSyncEnabled;

    if (enabled) {
        const userStatus = getUserStatus();
        if (userStatus !== 'APPROVED') {
            const toggleSync = document.getElementById('toggle-sync');
            if (toggleSync) toggleSync.checked = false;

            Dialog.alert(
                "Tryb Sync jest dostępny tylko dla zatwierdzonych użytkowników. Aby nim zostać skontaktuj się z Administratorem (Bartosz Kauc)",
                'error'
            );
            return;
        }
    }

    isAutoSyncEnabled = enabled;
    localStorage.setItem('autoSync', enabled);

    // Animacja toggle
    const toggleContainer = document.getElementById('sync-toggle-container');
    if (toggleContainer) {
        toggleContainer.classList.add('sync-toggled');
        setTimeout(() => toggleContainer.classList.remove('sync-toggled'), 300);
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

    const pending = await getPendingResults(user.uid);
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

            if (e.code === 'permission-denied') {
                isSyncing = false;
                updateSyncUI(false, 0);
                import('./dialog.js').then(({ Dialog }) => {
                    Dialog.alert(`Błąd synchronizacji: Brak uprawnień. Sprawdź czy Twój status to 'APPROVED' i czy reguły bazy danych są poprawne.`, 'error');
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
    window.dispatchEvent(new Event('sync-complete'));
}

/**
 * Wewnętrzna funkcja wysyłająca pojedyńczy rekord (bez obsługi UI globalnego sync).
 * Wyrzuca błąd w przypadku niepowodzenia.
 */
async function syncSingleResultInternal(record) {
    const docRef = await addDoc(collection(db, "results"), {
        researcher_uid: record.researcher_uid,
        test_id: record.test_id || record.testId,
        subject_id: record.subject_id,
        demographics: record.demographics,
        data: record.wyniki || record.data,
        timestamp: record.timestamp,
        synced_at: new Date().toISOString()
    });

    await markAsSynced(record.id, docRef.id);
    console.log(`Synced record ${record.id} -> ${docRef.id}`);
}

/**
 * Manualna synchronizacja pojedynczego wyniku (wywoływana z UI).
 */
export async function syncSingleResult(record) {
    if (!navigator.onLine) {
        throw new Error("Brak połączenia z internetem.");
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error("Użytkownik nie jest zalogowany.");
    }

    if (record.researcher_uid !== user.uid) {
        throw new Error("Nie możesz wysłać wyniku należącego do innego użytkownika.");
    }

    try {
        await syncSingleResultInternal(record);
        window.dispatchEvent(new Event('sync-complete'));
        return { success: true };
    } catch (e) {
        console.error(`Failed to manually sync record ${record.id}:`, e);
        if (e.code === 'permission-denied') {
            throw new Error("Brak uprawnień (Permission Denied). Sprawdź status Approved.");
        }
        throw e;
    }
}

/**
 * Aktualizuje UI podczas synchronizacji (animacja toggle).
 */
function updateSyncUI(syncing, remaining) {
    const toggleContainer = document.getElementById('sync-toggle-container');
    const toggleLabel = document.getElementById('sync-status-label');

    if (toggleContainer) {
        if (syncing) {
            toggleContainer.classList.add('syncing');
            if (toggleLabel) {
                toggleLabel.textContent = `SYNC (${remaining})`;
            }
        } else {
            toggleContainer.classList.remove('syncing');
            if (toggleLabel) {
                toggleLabel.textContent = 'SYNC';
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
    if (document.getElementById('sync-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'sync-toast';
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-header">
                <h4 class="toast-title"><span class="material-icons" style="font-size:18px;vertical-align:middle;margin-right:6px;">cloud_done</span>Synchronizacja</h4>
                <button class="toast-close">&times;</button>
            </div>
            <p class="toast-message">Zsynchronizowano ${count} ${count === 1 ? 'wynik' : count < 5 ? 'wyniki' : 'wyników'}.</p>
        </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 50);

    const close = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.toast-close').addEventListener('click', close);
    // Auto-dismiss after 4 seconds
    setTimeout(close, 4000);
}
