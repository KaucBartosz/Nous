// src/modules/database.js
import { openDB } from "../lib/idb.js";
import { initCrypto, encryptData, decryptData } from "./cryptoService.js";
import { Dialog } from "./dialog.js";

const DB_NAME = "NousDB";
const DB_VERSION = 5;

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
              "warning",
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
            "error",
          );
        }, 1000);
      }
    }
  }

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
    });
  }

  return dbPromise;
}

/**
 * Saves a test result to IndexedDB with encryption
 * @param {Object} resultData - The result data to save
 * @param {string} currentUserId - The current user's ID for verification
 * @returns {Promise<string>} The generated or existing ID
 */
export async function saveResult(resultData, currentUserId) {
  try {
    const db = await initDB();

    // Generate ID if not provided (prevent race conditions)
    const id = resultData.id || crypto.randomUUID();
    const timestamp = resultData.timestamp || new Date().toISOString();

    // Verify researcher_uid matches current user
    if (
      resultData.researcher_uid &&
      resultData.researcher_uid !== currentUserId
    ) {
      throw new Error(
        "researcher_uid mismatch: cannot save result for another user",
      );
    }

    let payloadToSave = {
      ...resultData,
      id,
      researcher_uid: currentUserId, // Ensure correct user
      timestamp,
      sync_status: resultData.sync_status || "PENDING",
      created_at: timestamp,
    };

    // --- ENCRYPTION ---
    if (isCryptoReady) {
      // Encrypt the sensitive payload, keep indices clear
      const { payload, iv } = await encryptData(resultData);

      payloadToSave = {
        id: id,
        timestamp: timestamp, // INDEXED
        sync_status: resultData.sync_status || "PENDING", // INDEXED
        created_at: timestamp,
        is_encrypted: true,
        encrypted_payload: payload,
        iv: iv,
        // Keep minimal metadata unencrypted for listing and filtering
        test_id: resultData.test_id || resultData.testId,
        subject_id: resultData.subject_id,
        researcher_uid: currentUserId, // Potrzebne do filtrowania LOCAL::/GUEST w history.js
      };
    }

    await db.put("results", payloadToSave);
    return id;
  } catch (error) {
    console.error("Error saving result:", error);
    throw new Error(`Nie udało się zapisać wyniku: ${error.message}`);
  }
}

/**
 * Processes a database record, decrypting if necessary
 * @param {Object} record - Raw database record
 * @returns {Promise<Object>} Decrypted and normalized record
 * @throws {Error} If decryption fails
 */
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
        firestore_id: record.firestore_id,
      };
    } catch (e) {
      console.error("Decryption error for record:", record.id, e);
      // Throw error to prevent displaying corrupted data
      throw new Error(`Failed to decrypt record ${record.id}: ${e.message}`);
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
        firestore_id: record.firestoreId || record.firestore_id,
      };
    } catch (e) {
      console.error("Decryption error for legacy record:", record.id, e);
      throw new Error(
        `Failed to decrypt legacy record ${record.id}: ${e.message}`,
      );
    }
  }

  // Normalize legacy camelCase to snake_case
  return {
    ...record,
    sync_status: record.sync_status || record.syncStatus,
    firestore_id: record.firestore_id || record.firestoreId,
    test_id: record.test_id || record.testId,
    subject_id: record.subject_id || record.subjectId,
    researcher_uid: record.researcher_uid,
  };
}

export async function getAllResults() {
  try {
    const db = await initDB();
    const records = await db.getAllFromIndex("results", "timestamp");

    // Decrypt all
    return await Promise.all(records.map(processRecordOutput));
  } catch (error) {
    console.error("Error getting all results:", error);
    throw new Error(`Nie udało się pobrać wyników: ${error.message}`);
  }
}

export async function getPendingResults(userId) {
  try {
    const db = await initDB();
    // Try new index name first, fallback to old
    let records;
    try {
      records = await db.getAllFromIndex("results", "sync_status", "PENDING");
    } catch {
      // Fallback for legacy index name
      records = await db.getAllFromIndex("results", "syncStatus", "PENDING");
    }

    const decodedRecords = await Promise.all(records.map(processRecordOutput));

    // Filter by user if userId is provided
    if (userId) {
      return decodedRecords.filter((r) => r.researcher_uid === userId);
    }

    return decodedRecords;
  } catch (error) {
    console.error("Error getting pending results:", error);
    throw new Error(
      `Nie udało się pobrać oczekujących wyników: ${error.message}`,
    );
  }
}

export async function markAsSynced(local_id, firestore_id) {
  try {
    const db = await initDB();
    const tx = db.transaction("results", "readwrite");
    const store = tx.objectStore("results");

    const record = await store.get(local_id);
    if (record) {
      record.sync_status = "SYNCED";
      record.firestore_id = firestore_id;
      // Also set legacy fields for backward compatibility
      record.syncStatus = "SYNCED";
      record.firestoreId = firestore_id;
      await store.put(record);
    }
    await tx.done;
  } catch (error) {
    console.error("Error marking as synced:", error);
    throw new Error(
      `Nie udało się oznaczyć jako zsynchronizowane: ${error.message}`,
    );
  }
}

export async function deleteResult(id) {
  try {
    const db = await initDB();
    await db.delete("results", id);
  } catch (error) {
    console.error("Error deleting result:", error);
    throw new Error(`Nie udało się usunąć wyniku: ${error.message}`);
  }
}

export async function deleteResults(ids) {
  try {
    const db = await initDB();
    const tx = db.transaction("results", "readwrite");
    const store = tx.objectStore("results");

    for (const id of ids) {
      await store.delete(id);
    }

    await tx.done;
  } catch (error) {
    console.error("Error deleting multiple results:", error);
    throw new Error(`Nie udało się usunąć wyników: ${error.message}`);
  }
}

/**
 * Checks if a result already exists in the local database.
 */
export async function checkResultExists(
  firestoreId,
  timestamp,
  testId,
  subjectId,
) {
  try {
    const results = await getAllResults();
    return results.some(
      (r) =>
        (firestoreId && r.firestore_id === firestoreId) ||
        (r.timestamp === timestamp &&
          r.test_id === testId &&
          r.subject_id === subjectId),
    );
  } catch (e) {
    console.error("Error checking for duplicate:", e);
    return false;
  }
}

/**
 * Claims a Guest result and assigns it to the current user.
 * @param {Object} guestResult - The fully decrypted result object
 * @param {string} currentUserId - The user claiming the result
 * @param {boolean} keepOriginal - If true, copies (new ID); if false, moves (overwrites ID)
 */
export async function claimGuestResult(
  guestResult,
  currentUserId,
  keepOriginal,
) {
  if (
    !currentUserId ||
    currentUserId === "GUEST" ||
    currentUserId.startsWith("LOCAL::")
  ) {
    throw new Error(
      "Tylko zalogowany użytkownik konta online może przejąć wyniki Gościa.",
    );
  }

  const payload = { ...guestResult };

  // Set new owner
  payload.researcher_uid = currentUserId;

  // Reset sync status ensures it will be synced to cloud
  payload.sync_status = "PENDING";

  // Remove cloud reference if exists (Guest results shouldn't have one, but just in case)
  delete payload.firestore_id;
  delete payload.firestoreId;

  if (keepOriginal) {
    // COPY: Remove ID to let saveResult generate a new unique one
    delete payload.id;
  } else {
    // MOVE: We keep the ID to overwrite the old record.
    // The record was previously owned by GUEST, now by USER.
  }

  return await saveResult(payload, currentUserId);
}

// --- TEMPLATES (Metryczki - NOT ENCRYPTED intentionally) ---
// Templates are config, not sensitive result data.

export async function saveTemplate(template) {
  try {
    const db = await initDB();
    const id = template.id || crypto.randomUUID();
    await db.put("demographicsTemplates", { ...template, id });
    return id;
  } catch (error) {
    console.error("Error saving template:", error);
    throw new Error(`Nie udało się zapisać szablonu: ${error.message}`);
  }
}

export async function getAllTemplates() {
  try {
    const db = await initDB();
    return db.getAll("demographicsTemplates");
  } catch (error) {
    console.error("Error getting all templates:", error);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
}

export async function getTemplate(id) {
  try {
    const db = await initDB();
    return db.get("demographicsTemplates", id);
  } catch (error) {
    console.error("Error getting template:", error);
    throw new Error(`Nie udało się pobrać szablonu: ${error.message}`);
  }
}

export async function deleteTemplate(id) {
  try {
    const db = await initDB();
    await db.delete("demographicsTemplates", id);
  } catch (error) {
    console.error("Error deleting template:", error);
    throw new Error(`Nie udało się usunąć szablonu: ${error.message}`);
  }
}

// --- PARTICIPANTS (Kartoteka Badanych - NOT ENCRYPTED intentionally) ---
// Participant profiles are config/metadata, not sensitive result data.

export async function saveParticipant(participant, researcherUid) {
  try {
    const db = await initDB();
    const id = participant.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...participant,
      id,
      researcher_uid: researcherUid,
      created_at: participant.created_at || now,
      updated_at: now,
    };
    await db.put("participants", record);
    return id;
  } catch (error) {
    console.error("Error saving participant:", error);
    throw new Error(`Nie udało się zapisać badanego: ${error.message}`);
  }
}

export async function getAllParticipants(researcherUid) {
  try {
    const db = await initDB();
    const allParticipants = await db.getAllFromIndex(
      "participants",
      "researcher_uid",
      researcherUid,
    );
    return allParticipants.sort((a, b) =>
      a.display_name.localeCompare(b.display_name, "pl"),
    );
  } catch (error) {
    console.error("Error getting participants:", error);
    return [];
  }
}

export async function getParticipant(id) {
  try {
    const db = await initDB();
    return db.get("participants", id);
  } catch (error) {
    console.error("Error getting participant:", error);
    throw new Error(`Nie udało się pobrać badanego: ${error.message}`);
  }
}

export async function deleteParticipant(id) {
  try {
    const db = await initDB();
    await db.delete("participants", id);
  } catch (error) {
    console.error("Error deleting participant:", error);
    throw new Error(`Nie udało się usunąć badanego: ${error.message}`);
  }
}

// --- LOCAL ACCOUNTS ---
// Konta lokalne przechowywane w IndexedDB.
// UWAGA: getLocalAccount zwraca pełny rekord z passwordHash (używać tylko w auth.js).
// getAllLocalAccounts zwraca rekordy BEZ passwordHash (bezpieczne dla UI).

export async function getLocalAccount(username) {
  try {
    const db = await initDB();
    return db.get("localAccounts", username);
  } catch (error) {
    console.error("Error getting local account:", error);
    throw new Error(`Nie udało się pobrać konta: ${error.message}`);
  }
}

export async function createLocalAccount(username, passwordHash, salt) {
  try {
    const db = await initDB();
    const now = new Date().toISOString();
    await db.put("localAccounts", {
      username,
      passwordHash,
      salt,
      createdAt: now,
      lastLogin: now,
    });
  } catch (error) {
    console.error("Error creating local account:", error);
    throw new Error(`Nie udało się utworzyć konta: ${error.message}`);
  }
}

export async function getAllLocalAccounts() {
  try {
    const db = await initDB();
    const accounts = await db.getAll("localAccounts");
    // Nie zwracamy passwordHash ani salt - tylko metadane
    return accounts.map(({ username, createdAt, lastLogin }) => ({
      username,
      createdAt,
      lastLogin,
    }));
  } catch (error) {
    console.error("Error getting local accounts:", error);
    return [];
  }
}

export async function updateLocalAccountLastLogin(username) {
  try {
    const db = await initDB();
    const account = await db.get("localAccounts", username);
    if (account) {
      account.lastLogin = new Date().toISOString();
      await db.put("localAccounts", account);
    }
  } catch (error) {
    console.error("Error updating last login:", error);
    // Non-critical, don't throw
  }
}

export async function deleteLocalAccount(username) {
  try {
    const db = await initDB();
    await db.delete("localAccounts", username);
  } catch (error) {
    console.error("Error deleting local account:", error);
    throw new Error(`Nie udało się usunąć konta: ${error.message}`);
  }
}
