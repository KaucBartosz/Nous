// src/db/index.js — otwarcie NousDB + schemat v5 (C2).
// Schemat IDENTYCZNY jak wcześniej (DB_NAME/VERSION/store'y/indeksy) — zero migracji danych.
import { openDB } from "../lib/idb.js";
import { ensureCrypto } from "./cryptoPolicy.js";

const DB_NAME = "NousDB";
const DB_VERSION = 5;

let dbPromise = null;

export async function initDB() {
  await ensureCrypto();

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // 1. RESULTS STORE
        let resultsStore;
        if (!db.objectStoreNames.contains("results")) {
          resultsStore = db.createObjectStore("results", { keyPath: "id" });
        } else {
          resultsStore = transaction.objectStore("results");
        }

        if (!resultsStore.indexNames.contains("timestamp")) {
          resultsStore.createIndex("timestamp", "timestamp");
        }
        if (!resultsStore.indexNames.contains("sync_status")) {
          resultsStore.createIndex("sync_status", "sync_status");
        }

        // 2. TEMPLATES STORE
        if (!db.objectStoreNames.contains("demographicsTemplates")) {
          db.createObjectStore("demographicsTemplates", { keyPath: "id" });
        }

        // 3. PARTICIPANTS STORE (Kartoteka Badanych)
        if (!db.objectStoreNames.contains("participants")) {
          const participantsStore = db.createObjectStore("participants", {
            keyPath: "id",
          });
          participantsStore.createIndex("researcher_uid", "researcher_uid");
        }

        // 4. LOCAL ACCOUNTS STORE
        if (!db.objectStoreNames.contains("localAccounts")) {
          db.createObjectStore("localAccounts", { keyPath: "username" });
        }
      },
    }).catch(err => {
      dbPromise = null;
      throw err;
    });
  }

  return dbPromise;
}
