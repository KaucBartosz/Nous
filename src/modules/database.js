// src/modules/database.js
import { openDB } from '../lib/idb.js';

const DB_NAME = 'NousDB';
const DB_VERSION = 1;

export async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('results')) {
                const store = db.createObjectStore('results', { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp');
                store.createIndex('syncStatus', 'syncStatus');
            }
        },
    });
}

export async function saveResult(resultData) {
    const db = await initDB();
    const id = resultData.id || crypto.randomUUID();

    await db.put('results', {
        ...resultData,
        id: id,
        syncStatus: 'PENDING', // Default status
        createdAt: new Date().toISOString()
    });
    return id;
}

export async function getAllResults() {
    const db = await initDB();
    return db.getAllFromIndex('results', 'timestamp');
}

export async function getPendingResults() {
    const db = await initDB();
    return db.getAllFromIndex('results', 'syncStatus', 'PENDING');
}

export async function markAsSynced(localId, firestoreId) {
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
}

export async function deleteResult(id) {
    const db = await initDB();
    await db.delete('results', id);
}
