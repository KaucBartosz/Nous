// src/modules/database.js
import { openDB } from '../lib/idb.js';
import { initCrypto, encryptData, decryptData } from './cryptoService.js';
import { Dialog } from './dialog.js';

const DB_NAME = 'NousDB';
const DB_VERSION = 2;

let isCryptoReady = false;
let cryptoWarningShown = false; // Zapobiega wielokrotnemu pokazywaniu ostrzeżenia

let dbPromise = null;

export async function initDB() {
    // --- CRYPTO INIT (Lazy) ---
    if (!isCryptoReady && window.electronAPI) {
        try {
            const key = await window.electronAPI.getEncryptionKey();
            if (key) {
                await initCrypto(key);
                isCryptoReady = true;
            } else {
                console.error("Failed to get encryption key!");
                // Pokaż ostrzeżenie użytkownikowi (tylko raz)
                if (!cryptoWarningShown) {
                    cryptoWarningShown = true;
                    // Używamy setTimeout aby nie blokować inicjalizacji
                    setTimeout(() => {
                        Dialog.alert(
                            "Błąd inicjalizacji szyfrowania. Dane lokalne mogą nie być szyfrowane. " +
                            "Przyczyną może być brak dostępu do systemu przechowywania kluczy (DPAPI/Keychain).",
                            'warning'
                        );
                    }, 1000);
                }
            }
        } catch (e) {
            console.error("Crypto Init Failed:", e);
            // Pokaż ostrzeżenie użytkownikowi (tylko raz)
            if (!cryptoWarningShown) {
                cryptoWarningShown = true;
                setTimeout(() => {
                    Dialog.alert(
                        `Błąd szyfrowania: ${e.message}. Dane lokalne będą przechowywane niezaszyfrowane.`,
                        'error'
                    );
                }, 1000);
            }
        }
    }

    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('results')) {
                    const store = db.createObjectStore('results', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('sync_status', 'sync_status');
                }
                if (!db.objectStoreNames.contains('demographicsTemplates')) {
                    db.createObjectStore('demographicsTemplates', { keyPath: 'id' });
                }
            },
        });
    }

    return dbPromise;
}

export async function saveResult(resultData) {
    try {
        const db = await initDB();
        const id = resultData.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        let payloadToSave = {
            ...resultData,
            id,
            sync_status: 'PENDING',
            created_at: timestamp
        };

        // --- ENCRYPTION ---
        if (isCryptoReady) {
            // Encrypt the sensitive payload, keep indices clear
            const { payload, iv } = await encryptData(resultData);

            payloadToSave = {
                id: id,
                timestamp: timestamp,           // INDEXED
                sync_status: 'PENDING',         // INDEXED
                created_at: timestamp,
                is_encrypted: true,
                encrypted_payload: payload,
                iv: iv,
                // Keep minimal metadata unencrypted for listing
                test_id: resultData.test_id || resultData.testId,
                subject_id: resultData.subject_id
            };
        }

        await db.put('results', payloadToSave);
        return id;
    } catch (error) {
        console.error('Error saving result:', error);
        throw new Error(`Nie udało się zapisać wyniku: ${error.message}`);
    }
}

async function processRecordOutput(record) {
    if (record.is_encrypted && isCryptoReady) {
        try {
            const decrypted = await decryptData(record.encrypted_payload, record.iv);
            // Merge back with metadata (id, sync_status etc)
            return {
                ...decrypted,
                id: record.id,
                sync_status: record.sync_status,
                timestamp: record.timestamp,
                firestore_id: record.firestore_id
            };
        } catch (e) {
            console.error("Decryption error for record:", record.id, e);
            return {
                ...record,
                error: "Decryption Failed"
            };
        }
    }

    // Legacy support - handle old records with camelCase fields
    if (record.isEncrypted && isCryptoReady) {
        try {
            const decrypted = await decryptData(record.encryptedPayload, record.iv);
            return {
                ...decrypted,
                id: record.id,
                sync_status: record.syncStatus || record.sync_status,
                timestamp: record.timestamp,
                firestore_id: record.firestoreId || record.firestore_id
            };
        } catch (e) {
            console.error("Decryption error for legacy record:", record.id, e);
            return {
                ...record,
                error: "Decryption Failed"
            };
        }
    }

    // Normalize legacy camelCase to snake_case
    return {
        ...record,
        sync_status: record.sync_status || record.syncStatus,
        firestore_id: record.firestore_id || record.firestoreId,
        test_id: record.test_id || record.testId,
        subject_id: record.subject_id || record.subjectId,
        researcher_uid: record.researcher_uid
    };
}

export async function getAllResults() {
    try {
        const db = await initDB();
        const records = await db.getAllFromIndex('results', 'timestamp');

        // Decrypt all
        return await Promise.all(records.map(processRecordOutput));
    } catch (error) {
        console.error('Error getting all results:', error);
        throw new Error(`Nie udało się pobrać wyników: ${error.message}`);
    }
}

export async function getPendingResults(userId) {
    try {
        const db = await initDB();
        // Try new index name first, fallback to old
        let records;
        try {
            records = await db.getAllFromIndex('results', 'sync_status', 'PENDING');
        } catch {
            // Fallback for legacy index name
            records = await db.getAllFromIndex('results', 'syncStatus', 'PENDING');
        }

        const decodedRecords = await Promise.all(records.map(processRecordOutput));

        // Filter by user if userId is provided
        if (userId) {
            return decodedRecords.filter(r => r.researcher_uid === userId);
        }

        return decodedRecords;
    } catch (error) {
        console.error('Error getting pending results:', error);
        throw new Error(`Nie udało się pobrać oczekujących wyników: ${error.message}`);
    }
}

export async function markAsSynced(local_id, firestore_id) {
    try {
        const db = await initDB();
        const tx = db.transaction('results', 'readwrite');
        const store = tx.objectStore('results');

        const record = await store.get(local_id);
        if (record) {
            record.sync_status = 'SYNCED';
            record.firestore_id = firestore_id;
            // Also set legacy fields for backward compatibility
            record.syncStatus = 'SYNCED';
            record.firestoreId = firestore_id;
            await store.put(record);
        }
        await tx.done;
    } catch (error) {
        console.error('Error marking as synced:', error);
        throw new Error(`Nie udało się oznaczyć jako zsynchronizowane: ${error.message}`);
    }
}

export async function deleteResult(id) {
    try {
        const db = await initDB();
        await db.delete('results', id);
    } catch (error) {
        console.error('Error deleting result:', error);
        throw new Error(`Nie udało się usunąć wyniku: ${error.message}`);
    }
}

// --- TEMPLATES (Metryczki - NOT ENCRYPTED intentionally) ---
// Templates are config, not sensitive result data.

export async function saveTemplate(template) {
    try {
        const db = await initDB();
        const id = template.id || crypto.randomUUID();
        await db.put('demographicsTemplates', { ...template, id });
        return id;
    } catch (error) {
        console.error('Error saving template:', error);
        throw new Error(`Nie udało się zapisać szablonu: ${error.message}`);
    }
}

export async function getAllTemplates() {
    try {
        const db = await initDB();
        return db.getAll('demographicsTemplates');
    } catch (error) {
        console.error('Error getting all templates:', error);
        // Return empty array instead of throwing to prevent UI crash
        return [];
    }
}

export async function getTemplate(id) {
    try {
        const db = await initDB();
        return db.get('demographicsTemplates', id);
    } catch (error) {
        console.error('Error getting template:', error);
        throw new Error(`Nie udało się pobrać szablonu: ${error.message}`);
    }
}

export async function deleteTemplate(id) {
    try {
        const db = await initDB();
        await db.delete('demographicsTemplates', id);
    } catch (error) {
        console.error('Error deleting template:', error);
        throw new Error(`Nie udało się usunąć szablonu: ${error.message}`);
    }
}
