// src/modules/sync.js
import { db } from '../firebaseConfig.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getPendingResults, markAsSynced } from './database.js';
import { getCurrentUser } from './auth.js';

let isAutoSyncEnabled = localStorage.getItem('autoSync') === 'true'; // Default false
let isSyncing = false; // Flaga statusu synchronizacji

export function initSyncService() {
    window.addEventListener('online', () => {
        console.log("Online Detected. Attempting sync...");
        syncNow();
    });

    // Initial sync attempt
    if (navigator.onLine) {
        setTimeout(syncNow, 5000);
    }
}

export function setAutoSync(enabled) {
    isAutoSyncEnabled = enabled;
    localStorage.setItem('autoSync', enabled);

    // Animacja toggle
    const toggleContainer = document.getElementById('sync-toggle-container');
    if (toggleContainer) {
        toggleContainer.classList.add('sync-toggled');
        setTimeout(() => toggleContainer.classList.remove('sync-toggled'), 300);
    }

    if (enabled && navigator.onLine) {
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
            const docRef = await addDoc(collection(db, "results"), {
                researcher_uid: record.researcher_uid,
                test_id: record.test_id || record.testId,
                subject_id: record.subject_id,
                demographics: record.demographics,
                data: record.wyniki,
                timestamp: record.timestamp,
                synced_at: new Date().toISOString()
            });

            await markAsSynced(record.id, docRef.id);
            synced_count++;
            console.log(`Synced record ${record.id} -> ${docRef.id}`);

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

    // Notify UI to refresh history table if visible
    window.dispatchEvent(new Event('sync-complete'));
}

/**
 * Aktualizuje UI podczas synchronizacji (animacja toggle).
 * @param {boolean} syncing - Czy synchronizacja jest w toku
 * @param {number} remaining - Liczba pozostałych rekordów
 */
function updateSyncUI(syncing, remaining) {
    const toggleContainer = document.getElementById('sync-toggle-container');
    const toggleLabel = toggleContainer?.querySelector('span:last-child');

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
