// src/catalog/testCatalog.js — TestCatalog (C5): głęboki moduł Biblioteki testów.
// Własność: rejestr chmury + wersje lokalne + backfill + sort + status + query.
// Widoki (library/updates) tylko renderują; Firestore/DOM nie wyciekają na zewnątrz.
import { sortByInstallStatus } from "../modules/utils.js";

export const CACHE_KEY = "cached_tests_metadata";
export const FETCH_TIMEOUT_MS = 8000;

/** Status dystrybucyjny testu (dane, nie deskryptory renderu — te zostają w widokach). */
export function statusOf(t) {
  if (t.isLocalDev) return "localdev";
  if ((t.local_ver || 0) === 0) return "missing";
  if (t.local_ver < t.remote_ver) return "outdated";
  return "uptodate";
}

/** Liczba testów wymagających aktualizacji (badge Aktualizacji). */
export function countUpdates(tests) {
  return tests.filter(
    (t) => (t.local_ver || 0) > 0 && t.local_ver < t.remote_ver,
  ).length;
}

function withTimeout(promise, ms) {
  let timeoutId;
  const gate = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Timeout: Firestore nie odpowiada (>8s)")),
      ms,
    );
  });
  return { race: Promise.race([promise, gate]), clear: () => clearTimeout(timeoutId) };
}

/**
 * Pobranie rejestru z chmury z fallbackiem do cache localStorage.
 * @param {object} deps — { fetchRemote(): snap, isOnline(): bool, storage }
 * @returns {{ tests: array, fromCache: bool, empty: bool }}
 */
export async function fetchRegistry({ fetchRemote, isOnline, storage = localStorage } = {}) {
  const online = isOnline ? isOnline() : true;
  if (!online) {
    throw new Error("Brak połączenia internetowego (navigator.onLine)");
  }
  const { race, clear } = withTimeout(fetchRemote(), FETCH_TIMEOUT_MS);
  let snap;
  try {
    snap = await race;
  } finally {
    clear();
  }
  if (snap.empty) return { tests: [], fromCache: false, empty: true };

  const tests = [];
  snap.forEach((doc) => {
    const t = doc.data();
    t.id = doc.id;
    t.local_ver = 0; // uzupełni mergeLocalVersions
    t.remote_ver = Number(t.version) || 0; // zabezpieczenie przed NaN
    tests.push(t);
  });
  try {
    storage.setItem(CACHE_KEY, JSON.stringify(tests));
  } catch (e) {
    console.warn("Nie można zapisać cache rejestru:", e);
  }
  return { tests, fromCache: false, empty: false };
}

export function loadCachedRegistry(storage = localStorage) {
  try {
    const saved = storage.getItem(CACHE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    console.error("Błąd parsowania cache lokalnego:", e);
    return null;
  }
}

/**
 * Merge wersji lokalnych + backfill testów z dysku spoza rejestru.
 * @param {array} tests — rejestr (mutowany w miejscu jak wcześniej: local_ver/isLocalDev)
 * @param {object} localVersions — { testId: { version, isLocalDev, name, description } }
 * @param {object} settings — { showLocalTests }
 */
export function mergeLocalVersions(tests, localVersions, settings = {}, { backfill = true } = {}) {
  tests.forEach((t) => {
    const local = localVersions[t.id];
    if (local) {
      t.local_ver = Number(local.version);
      t.isLocalDev = local.isLocalDev || false;
    } else {
      t.local_ver = 0;
      t.isLocalDev = false;
    }
  });

  if (!backfill) return tests;

  // Backfill: testy z dysku spoza rejestru (znacznik _isBackfill do czyszczenia).
  const merged = tests.filter((t) => !t._isBackfill);
  Object.keys(localVersions).forEach((testId) => {
    if (testId === "__scannedDir") return;
    const local = localVersions[testId];
    if ((local.isLocalDev || false) && !settings.showLocalTests) return;
    if (!merged.find((t) => t.id === testId)) {
      if (local.version >= 0) {
        merged.push({
          id: testId,
          name: local.name || `Test lokalny (${testId})`,
          description: local.description || "Pobrano wcześniej.",
          version: local.version || 0,
          local_ver: Number(local.version || 0),
          remote_ver: Number(local.version || 0),
          isLocalDev: local.isLocalDev || false,
          download_url: "",
          _isBackfill: true,
        });
      }
    }
  });
  return merged;
}

/**
 * Query: filtr tekstowy + @tagi (AND>OR) + sort wg statusu instalacji.
 * @param {array} tests
 * @param {string} filterText
 * @param {object} tags — { parseTagSearchQuery, getTagsForTest, matchesTagGroups }
 */
export function queryTests(tests, filterText, tags) {
  let out = [...tests];
  if (filterText) {
    const { textFilters, tagGroups } = tags.parseTagSearchQuery(filterText);
    out = out.filter((t) => {
      const nameMatch =
        textFilters.length === 0 ||
        textFilters.every((word) => (t.name || "").toLowerCase().includes(word));
      if (!nameMatch) return false;
      if (tagGroups.length === 0) return true;
      return tags.matchesTagGroups(tags.getTagsForTest(t.id), tagGroups);
    });
  }
  return sortByInstallStatus(out);
}

/**
 * Pełny load: rejestr (chmura → cache) + merge wersji. Osobno, żeby widoki
 * zachowały własne guardy (isLoading) i komunikaty.
 */
export async function loadCatalog({ forceRefresh, cached, fetchRemote, isOnline, getLocalVersions, getSettings, storage = localStorage, backfill = true, cloudEnabled = true }) {
  let tests = cached && cached.length && !forceRefresh ? [...cached] : null;
  if (!tests) {
    if (!cloudEnabled) {
      tests = []; // Web: sama metryka lokalna + backfill (nigdy Firestore)
    } else {
      try {
        const res = await fetchRegistry({ fetchRemote, isOnline, storage });
        if (res.empty) return { tests: [], empty: true, offline: false, scannedDir: "nieznana" };
        tests = res.tests;
      } catch (e) {
        console.warn("Błąd ładowania danych z chmury (prawdopodobnie brak Internetu):", e);
        tests = loadCachedRegistry(storage) || [];
        if (!tests.length) {
          // Ścieżka lokalna do panelu offline (odczyt z dysku działa bez sieci).
          let scannedDir = "nieznana";
          try {
            scannedDir = (await getLocalVersions()).__scannedDir || "nieznana";
          } catch (err) {
            console.error("Błąd pobierania ścieżki:", err);
          }
          return { tests: [], empty: true, offline: true, scannedDir };
        }
      }
    }
  }
  const localVersions = await getLocalVersions();
  return {
    tests: mergeLocalVersions(tests, localVersions, getSettings(), { backfill }),
    empty: false,
    offline: false,
    scannedDir: localVersions.__scannedDir || "nieznana",
  };
}
