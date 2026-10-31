// src/history/historyState.js — jeden właściciel mutowalnego stanu Historii.
// Wcześniej 8 rozproszonych letów w modules/history.js; teraz jawny obiekt
// przekazywany do historyFilters/historyTable. Martwy filterValuesCache usunięty.
export const PAGE_SIZE = 50;
export const CLOUD_FETCH_THROTTLE_MS = 2000;

/** Świeży zestaw filtrów (kształt zgodny z historyQuery.filterResults). */
export function emptyHistoryFilters() {
  return {
    date: new Set(),
    test_id: new Set(),
    subject_id: new Set(),
    status: new Set(),
  };
}

export function createHistoryState() {
  return {
    /** Zaznaczone checkboxy (id wyników). */
    selectedIds: new Set(),
    /** Przełączniki widoku: gość / chmura (oba false = lokalne). */
    guestView: false,
    cloudView: false,
    /** Cache wyników chmurowych + throttle pobierania. */
    cloudResults: [],
    lastCloudFetch: 0,
    /** Aktywne filtry + dane bieżącego widoku + strona. */
    filters: emptyHistoryFilters(),
    page: 1,
    allResults: [],
  };
}

/** Reset filtrów (czystka przy przeładowaniu / zmianie widoku). */
export function resetHistoryFilters(state) {
  state.filters = emptyHistoryFilters();
}
