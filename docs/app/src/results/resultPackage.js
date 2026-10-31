// src/results/resultPackage.js — ResultPackage (C3): 1 miejsce normalizacji kształtu Wyniku.
// Zabija łańcuchy `r.test_id || r.testId` rozproszone po 4 modułach.
export const UNKNOWN_ID = "Nieznany";

/** Kanoniczny dostęp do tożsamości testu (było kopiowane w filtrach historii). */
export function testIdOf(r) {
  return r.test_id || r.testId || UNKNOWN_ID;
}

/** Kanoniczny dostęp do tożsamości badanego (było kopiowane w filtrach historii). */
export function subjectIdOf(r) {
  return (
    r.subject_id ||
    (r.wyniki && r.wyniki.subjectId) ||
    (r.data && r.data.subjectId) ||
    UNKNOWN_ID
  );
}

/**
 * Normalizuje dowolny kształt wyniku (DB / chmura / IPC testu) do kanonu snake_case.
 * Nie narzuca display-defaultów (te należą do formatowania), poza test_id jak w results.js.
 */
export function normalizeResult(raw = {}) {
  const resData = raw.wyniki || raw.data || {};
  return {
    ...raw,
    test_id: raw.test_id || raw.testId || "test",
    timestamp: raw.timestamp || new Date().toISOString(),
    subject_id:
      raw.subject_id ?? resData.subjectId ?? raw.subjectId ?? null,
    researcher_uid: raw.researcher_uid ?? null,
    sync_status: raw.sync_status || raw.syncStatus || "PENDING",
    firestore_id: raw.firestore_id || raw.firestoreId || null,
    demographics: raw.demographics || null,
    wyniki: resData,
  };
}
