// src/db/results.js — ResultsStore (C2): Wyniki + szyfrowanie + polityka własności.
// Jedyny moduł znający snake_case/camelCase, prefixy LOCAL::/GUEST i statusy sync.
import { initDB } from "./index.js";
import { isCryptoReady, encryptData, decryptData } from "./cryptoPolicy.js";

/** Normalizacja legacy camelCase → snake_case (1 miejsce, było w 2 gałęziach). */
function normalizeRecord(record) {
  return {
    ...record,
    sync_status: record.sync_status || record.syncStatus,
    firestore_id: record.firestore_id || record.firestoreId,
    test_id: record.test_id || record.testId,
    subject_id: record.subject_id || record.subjectId,
    researcher_uid: record.researcher_uid,
  };
}

/**
 * Processes a database record, decrypting if necessary
 * @param {Object} record - Raw database record
 * @returns {Promise<Object>} Decrypted and normalized record
 * @throws {Error} If decryption fails
 */
async function processRecordOutput(record) {
  if (record.is_encrypted && isCryptoReady()) {
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
  if (record.isEncrypted && isCryptoReady()) {
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

  return normalizeRecord(record);
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
    if (isCryptoReady()) {
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

export async function getAllResults() {
  try {
    const db = await initDB();
    const records = await db.getAllFromIndex("results", "timestamp");

    // Decrypt all — pojedynczy zepsuty record nie zabija reszty
    const results = await Promise.allSettled(records.map(processRecordOutput));
    const decrypted = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        decrypted.push(r.value);
      } else {
        console.error("Failed to decrypt one result record:", r.reason);
      }
    }
    return decrypted;
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

    const results = await Promise.allSettled(records.map(processRecordOutput));
    const decodedRecords = results
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

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

    // C2: batch w 1 transakcji (było: seryjne await w pętli)
    await Promise.all(ids.map((id) => store.delete(id)));

    await tx.done;
  } catch (error) {
    console.error("Error deleting multiple results:", error);
    throw new Error(`Nie udało się usunąć wyników: ${error.message}`);
  }
}

/**
 * Checks if a result already exists in the local database.
 * C2: dopasowanie na jawnych metadanych (bez deszyfracji całości — było: getAllResults + .some()).
 */
export async function checkResultExists(
  firestoreId,
  timestamp,
  testId,
  subjectId,
) {
  const db = await initDB();
  const records = await db.getAll("results");
  return records.some(
    (r) =>
      (firestoreId && (r.firestore_id === firestoreId || r.firestoreId === firestoreId)) ||
      (r.timestamp === timestamp &&
        (r.test_id === testId || r.testId === testId) &&
        (r.subject_id === subjectId || r.subjectId === subjectId)),
  );
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
