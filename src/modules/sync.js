// src/modules/sync.js
import { db } from '../firebaseConfig.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getPendingResults, markAsSynced } from './database.js';
import { getCurrentUser } from './auth.js';

let isAutoSyncEnabled = localStorage.getItem('autoSync') === 'true'; // Default false

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
    if (enabled && navigator.onLine) {
        syncNow();
    }
}

export function getAutoSyncState() {
    return isAutoSyncEnabled;
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

    // Check if approved? Maybe stricter check later.

    const pending = await getPendingResults();
    if (pending.length === 0) {
        console.log("Nothing to sync.");
        return;
    }

    console.log(`Syncing ${pending.length} results...`);

    for (const record of pending) {
        try {
            const docRef = await addDoc(collection(db, "results"), {
                researcher_uid: record.researcher_uid, // Ujednolicone nazewnictwo
                test_id: record.testId,
                subject_id: record.subject_id,
                demographics: record.demographics,
                data: record.wyniki,
                timestamp: record.timestamp,
                syncedAt: new Date().toISOString()
            });

            await markAsSynced(record.id, docRef.id);
            console.log(`Synced record ${record.id} -> ${docRef.id}`);
        } catch (e) {
            console.error(`Failed to sync record ${record.id}:`, e);
        }
    }

    // Notify UI to refresh history table if visible
    // Simple event dispatch
    window.dispatchEvent(new Event('sync-complete'));
}
