// src/modules/database.js
import { openDB } from '../lib/idb.js';
import { initCrypto, encryptData, decryptData } from './cryptoService.js';
import { Dialog } from './dialog.js';

const DB_NAME = 'NousDB';
const DB_VERSION = 2;

let isCryptoReady = false;

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
            }
        } catch (e) {
            console.error("Crypto Init Failed:", e);
        }
    }

    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('results')) {
                const store = db.createObjectStore('results', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp');
                store.createIndex('syncStatus', 'syncStatus');
            }
            if (!db.objectStoreNames.contains('demographicsTemplates')) {
                db.createObjectStore('demographicsTemplates', { keyPath: 'id' });
            }
        },
    });
}

export async function saveResult(resultData) {
    try {
        const db = await initDB();
        const id = resultData.id || crypto.randomUUID();
        const timestamp = new Date().toISOString();

        let payloadToSave = { ...resultData, id, syncStatus: 'PENDING', createdAt: timestamp };

        // --- ENCRYPTION ---
        if (isCryptoReady) {
            // Encrypt the sensitive payload, keep indices clear
            const { payload, iv } = await encryptData(resultData);

            payloadToSave = {
                id: id,
                timestamp: timestamp,       // INDEXED
                syncStatus: 'PENDING',      // INDEXED
                createdAt: timestamp,
                isEncrypted: true,
                encryptedPayload: payload,
                iv: iv,
                // We keep minimal metadata unencrypted if needed, but here indices are enough
                testId: resultData.testId,  // Optional: keep testId visible for listing?
                subject_id: resultData.subject_id // Optional: keep subject visible?
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
    if (record.isEncrypted && isCryptoReady) {
        try {
            const decrypted = await decryptData(record.encryptedPayload, record.iv);
            // Merge back with metadata (id, syncStatus etc)
            return {
                ...decrypted,
                id: record.id,
                syncStatus: record.syncStatus,
                timestamp: record.timestamp,
                firestoreId: record.firestoreId
            };
        } catch (e) {
            console.error("Decryption error for record:", record.id, e);
            return {
                ...record,
                error: "Decryption Failed"
            };
        }
    }
    return record; // Return raw if not encrypted (legacy support)
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

export async function getPendingResults() {
    try {
        const db = await initDB();
        const records = await db.getAllFromIndex('results', 'syncStatus', 'PENDING');

        // Decrypt all
        return await Promise.all(records.map(processRecordOutput));
    } catch (error) {
        console.error('Error getting pending results:', error);
        throw new Error(`Nie udało się pobrać oczekujących wyników: ${error.message}`);
    }
}

export async function markAsSynced(localId, firestoreId) {
    try {
        const db = await initDB();
        const tx = db.transaction('results', 'readwrite');
        const store = tx.objectStore('results');

        const record = await store.get(localId);
        if (record) {
            record.syncStatus = 'SYNCED';
            record.firestoreId = firestoreId;
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

// --- TEMPLATES (Metryczki - NOT ENCRYPTED intentionally for now, or should be?) ---
// User asked for "encryption of data". Templates are config, not really sensitive result data.
// Leaving plain for performance and ease of use in UI.

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
