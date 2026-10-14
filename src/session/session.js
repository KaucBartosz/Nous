// src/session/session.js — Session (C4): 1 obiekt zamiast tria getterów.
// Jedyna polityka: kto jest kim (researcherUid) i kto może co (upload/sync).
export const SessionKind = Object.freeze({
  APPROVED: "APPROVED",
  ADMIN: "ADMIN",
  PENDING: "PENDING",
  LOCAL: "LOCAL",
  GUEST: "GUEST",
  UNKNOWN: "UNKNOWN",
  ERROR: "ERROR",
});

/** Mapowanie kontekstu → researcher_uid (reguła z auth.getResearcherUid, bez zmian). */
export function researcherUidFor({ firebaseUid = null, kind = "UNKNOWN", localUsername = null } = {}) {
  if (firebaseUid) return firebaseUid;
  if (kind === "LOCAL" && localUsername) {
    return `LOCAL::${localUsername}`;
  }
  return "GUEST";
}

export function createSession({ firebaseUid = null, kind = "UNKNOWN", localUsername = null } = {}) {
  return {
    uid: firebaseUid,
    kind,
    localUsername,
    researcherUid: researcherUidFor({ firebaseUid, kind, localUsername }),
  };
}

/** Wysyłka pojedynczego wyniku (reguła z history.js: APPROVED lub ADMIN). */
export function canUploadResult(kind) {
  return kind === "APPROVED" || kind === "ADMIN";
}

/** Auto-synchronizacja chmury (reguła z sync.enforceSyncPolicy: tylko APPROVED). */
export function isCloudSyncAllowed(kind) {
  return kind === "APPROVED";
}

/** Konto bez chmury: lokalne lub gość (reguła z sync.syncNow/syncSingleResult). */
export function isLocalSessionKind(kind) {
  return kind === "LOCAL" || kind === "GUEST";
}

/**
 * Bezpieczny sufiks kluczy storage per użytkownik (A3: 1 reguła `::` → `__`
 * zamiast 3 rozproszonych kopii w library/demographics/tagsStore).
 * Zachowuje 1:1 starą semantykę (pierwsze wystąpienie).
 */
export function storageKeySuffix(researcherUid) {
  return String(researcherUid || "").replace("::", "__");
}
