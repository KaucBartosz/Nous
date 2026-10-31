// src/sync/syncEngine.js — SyncEngine (D): głęboki moduł Synchronizacji.
// Własność: guardy startu, filtr rekordów LOCAL, pakowanie E2E, pętla wysyłki.
// Czysta orkiestracja: Firestore/DOM/Dialog/toast zostają w adapterze
// (`src/modules/sync.js`), który wstrzykuje tu I/O. Testowalna na fejkach.
// Polityka sesji z seama `src/session/session.js` (jak dotąd w sync.js).

import { isLocalSessionKind } from "../session/session.js";

/** Prefix researcher_uid dla kont lokalnych (reguła z sync.js, była w 3 kopiach). */
export const LOCAL_PREFIX = "LOCAL::";

/**
 * Rekord konta lokalnego — nigdy nie leci do chmury (ani nie jest liczony).
 * Jedno źródło zamiast 3 rozproszonych if-ów (syncNow + internal + manual).
 */
export function isLocalRecord(record) {
  if (!record) return false;
  return (
    record.sync_status === "LOCAL" ||
    (typeof record.researcher_uid === "string" &&
      record.researcher_uid.startsWith(LOCAL_PREFIX))
  );
}

/** Rekordy do wysyłki: PENDING bez LOCAL (kolejność zachowana). */
export function selectSyncable(records) {
  return (records || []).filter((r) => !isLocalRecord(r));
}

/**
 * Guard łańcucha syncNow — powody w kolejności oryginalnych if-ów.
 * @returns {string|null} — 'disabled' | 'local-session' | 'offline' | 'no-user' | 'in-progress' | null
 */
export function syncBlockReason({ autoSyncEnabled, status, online, user, syncing } = {}) {
  if (!autoSyncEnabled) return "disabled";
  if (isLocalSessionKind(status)) return "local-session";
  if (!online) return "offline";
  if (!user) return "no-user";
  if (syncing) return "in-progress";
  return null;
}

/**
 * Guard ręcznej wysyłki jednego rekordu (syncSingleResult) — kolejność jak w UI.
 * @returns {string|null} — 'local-session' | 'local-record' | 'offline' | 'no-user' | 'foreign-record' | null
 */
export function manualSyncBlockReason(record, { status, online, user } = {}) {
  if (isLocalSessionKind(status)) return "local-session";
  if (isLocalRecord(record)) return "local-record";
  if (!online) return "offline";
  if (!user) return "no-user";
  if (record && record.researcher_uid !== user.uid) return "foreign-record";
  return null;
}

/**
 * Pakowanie rekordu do dokumentu Firestore (treść syncSingleResultInternal).
 * Szyfrowanie E2E gdy klucz dostępny; bez klucza dane jawne + hook (adapter loguje warn).
 * @param {object} record — rekord lokalny (wyniki/data, demographics, ...)
 * @param {object} crypto — { hasKey(): bool, encrypt({data, demographics}): {payload, iv} }
 * @param {object} hooks — { onUnencrypted(record) }
 */
export async function packRecord(record, crypto, hooks = {}) {
  let finalData = record.wyniki || record.data;
  let finalDemographics = record.demographics;
  let isEncrypted = false;
  let iv = null;

  if (crypto.hasKey()) {
    const encrypted = await crypto.encrypt({
      data: finalData,
      demographics: finalDemographics,
    });
    finalData = encrypted.payload;
    finalDemographics = null; // wrażliwe dane schowane w szyfrogramie
    iv = encrypted.iv;
    isEncrypted = true;
  } else if (hooks.onUnencrypted) {
    hooks.onUnencrypted(record);
  }

  return {
    researcher_uid: record.researcher_uid,
    test_id: record.test_id || record.testId,
    subject_id: record.subject_id,
    demographics: finalDemographics,
    data: finalData,
    iv,
    is_encrypted: isEncrypted,
    timestamp: record.timestamp,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Wysyłka jednego rekordu: pack → save → mark. Rzuca przy błędzie I/O.
 * @param {object} io — { packRecord(record): doc, saveRemote(doc): {id}, markSynced(localId, remoteId) }
 * @returns {{skipped:true} | {synced:true, remoteId}}
 */
export async function syncOneRecord(record, io) {
  // Obrona w głębi (pre-filtr to selectSyncable w syncNow).
  if (isLocalRecord(record)) return { skipped: true };

  const doc = await io.packRecord(record);
  const ref = await io.saveRemote(doc);
  await io.markSynced(record.id, ref.id);
  return { synced: true, remoteId: ref.id };
}

/**
 * Pętla wysyłki (treść syncNow): per-rekord try/catch, stop na permission-denied.
 * @param {array} records — już po selectSyncable
 * @param {object} io — jak w syncOneRecord
 * @param {object} hooks — { onProgress(done, total) }
 * @returns {{ synced: string[], failed: {id, error}[], halted: bool }}
 */
export async function syncAll(records, io, hooks = {}) {
  const synced = [];
  const failed = [];
  let halted = false;

  for (const record of records) {
    try {
      const res = await syncOneRecord(record, io);
      if (res.synced) synced.push(record.id);
      if (hooks.onProgress) hooks.onProgress(synced.length, records.length);
    } catch (e) {
      failed.push({ id: record.id, error: e });
      if (e && e.code === "permission-denied") {
        halted = true;
        break; // jak wcześniej: stop przy braku uprawnień
      }
    }
  }

  return { synced, failed, halted };
}
