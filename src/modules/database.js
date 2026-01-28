// src/modules/database.js
import { openDB } from '../lib/idb.js';

const DB_NAME = 'NousDB';
const DB_VERSION = 2;

export async function initDB() {
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

        await db.put('results', {
            ...resultData,
            id: id,
            syncStatus: 'PENDING',
            createdAt: new Date().toISOString()
        });
        return id;
    } catch (error) {
        console.error('Error saving result:', error);
        throw new Error(`Nie udało się zapisać wyniku: ${error.message}`);
    }
}

export async function getAllResults() {
    try {
        const db = await initDB();
        return db.getAllFromIndex('results', 'timestamp');
    } catch (error) {
        console.error('Error getting all results:', error);
        throw new Error(`Nie udało się pobrać wyników: ${error.message}`);
    }
}

export async function getPendingResults() {
    try {
        const db = await initDB();
        return db.getAllFromIndex('results', 'syncStatus', 'PENDING');
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

// --- TEMPLATES (Metryczki) ---

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
