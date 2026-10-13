// src/results/historyQuery.js — query-model historii (C3): czyste funkcje, zero DOM.
// Jedyny właściciel logiki statusów / filtrów / paginacji.
import { testIdOf, subjectIdOf } from "./resultPackage.js";

/** Jedyny resolver statusu w kodzie (były 3 kopie tego łańcucha). */
export function resolveStatusLabel(r) {
  const sync_status = r.sync_status || r.syncStatus;
  if (r.researcher_uid && r.researcher_uid.startsWith("LOCAL::")) return "Konto lokalne";
  if (sync_status === "LOCAL") return "Konto lokalne";
  if (r.researcher_uid === "GUEST") return "Tryb Gościa";
  if (sync_status === "SYNCED") return "Zsynchronizowano";
  if (sync_status === "PENDING") return "Oczekuje";
  return "Lokalne";
}

/** Klucz dnia `day:rok:miesiąc:dzień` (miesiąc 0-indeksowany, jak w filtrach). */
export function dayKeyOf(timestamp) {
  const d = new Date(timestamp);
  return `day:${d.getFullYear()}:${d.getMonth()}:${d.getDate()}`;
}

export function hasActiveFilters(filters) {
  return (
    filters.date.size > 0 ||
    filters.test_id.size > 0 ||
    filters.subject_id.size > 0 ||
    filters.status.size > 0
  );
}

export function matchesFilters(r, filters) {
  if (filters.date.size > 0 && !filters.date.has(dayKeyOf(r.timestamp))) {
    return false;
  }
  if (filters.test_id.size > 0 && !filters.test_id.has(testIdOf(r))) {
    return false;
  }
  if (filters.subject_id.size > 0 && !filters.subject_id.has(subjectIdOf(r))) {
    return false;
  }
  if (filters.status.size > 0 && !filters.status.has(resolveStatusLabel(r))) {
    return false;
  }
  return true;
}

/** Bez aktywnych filtrów zwraca listę bez kopiowania (jak wcześniej). */
export function filterResults(results, filters) {
  if (!hasActiveFilters(filters)) return results;
  return results.filter((r) => matchesFilters(r, filters));
}

/** Stronicowanie + liczba stron (Math.ceil jak w widoku). */
export function paginate(list, page, pageSize) {
  const totalPages = Math.ceil(list.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  return { items: list.slice(startIdx, startIdx + pageSize), totalPages };
}

export function emptyFilters() {
  return {
    date: new Set(),
    test_id: new Set(),
    subject_id: new Set(),
    status: new Set(),
  };
}
