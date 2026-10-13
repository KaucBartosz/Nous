// src/results/cloudResults.js — operacje chmurowe historii (C3): czyste funkcje kolekcji.
// Firestore/Auth/Dialog zostają w history.js (warstwa UI); tu tylko decyzje na danych.
import { normalizeResult } from "./resultPackage.js";

/** Klucze już-zaimportowanych: firestore_id + znacznik czas_test_badanego. */
export function buildLocalKeys(localResults) {
  const keys = new Set();
  (localResults || []).forEach((r) => {
    if (r.firestore_id) keys.add(r.firestore_id);
    keys.add(`${r.timestamp}_${r.test_id}_${r.subject_id}`);
  });
  return keys;
}

export function cloudKeyOf(cloudResult) {
  return `${cloudResult.timestamp}_${cloudResult.test_id}_${cloudResult.subject_id}`;
}

export function isAlreadyImported(cloudResult, localKeys) {
  return (
    localKeys.has(cloudResult.firestore_id) ||
    localKeys.has(cloudKeyOf(cloudResult))
  );
}

/** Mapowanie rekordu chmury → pakiet lokalny (było kopiowane w 2 miejscach). */
export function cloudRecordToLocal(cloudResult, researcherUid) {
  return {
    test_id: cloudResult.test_id,
    subject_id: cloudResult.subject_id,
    timestamp: cloudResult.timestamp,
    researcher_uid: researcherUid,
    demographics: cloudResult.demographics,
    wyniki: cloudResult.data,
    firestore_id: cloudResult.firestore_id,
    sync_status: "SYNCED",
  };
}

/**
 * Równoległa deszyfracja listy (była seryjna pętla await). Kolejność zachowana.
 * Zależności wstrzyknięte (testowalność): { hasKey, decrypt }.
 */
export async function decryptCloudRecords(items, { hasKey, decrypt }) {
  return Promise.all(
    items.map(async (data) => {
      if (data.is_encrypted && data.iv) {
        if (!hasKey()) {
          data.data = { score: "Zaszyfrowane (Brak Klucza Chmury)" };
        } else {
          try {
            const decrypted = await decrypt(data.data, data.iv);
            data.data = decrypted.data;
            data.demographics = decrypted.demographics;
            data.is_encrypted = false; // Po odszyfrowaniu w RAM jak zwykły obiekt
          } catch (e) {
            console.error("Failed to decrypt cloud result:", e);
            data.data = { score: "Błąd Deszyfracji" };
          }
        }
      }
      return data;
    }),
  );
}

/**
 * Równoległy zapis przygotowanej listy (były seryjne await w pętlach importu).
 * Zwraca liczbę zapisanych; błędy pojedynczych rekordów nie zabijają reszty.
 */
export async function importPreparedList(items, userId, saveFn) {
  const settled = await Promise.allSettled(
    items.map((item) => saveFn(item, userId)),
  );
  let count = 0;
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      count++;
    } else {
      console.error("Failed to import result:", items[i], s.reason);
    }
  });
  return count;
}

/** Przygotowanie importu gości: move (mutacja właściciela) vs duplicate (nowe ID). */
export function prepareGuestImport(guestResults, userId, mode) {
  return guestResults.map((res) => {
    if (mode === "move") {
      return { ...res, researcher_uid: userId, sync_status: "PENDING" };
    }
    const copy = {
      ...res,
      id: crypto.randomUUID(),
      researcher_uid: userId,
      sync_status: "PENDING",
    };
    delete copy.firestore_id;
    return copy;
  });
}

export { normalizeResult };
