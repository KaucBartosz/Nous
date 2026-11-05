// src/statistics/statisticsQuery.js — czysta logika statystyk (bez DOM).
import { flattenObject } from "../modules/utils.js";
import { testIdOf, subjectIdOf } from "../results/resultPackage.js";

const STATS_IGNORE_KEYS = new Set([
  "testId",
  "test_id",
  "subjectId",
  "subject_id",
  "timestamp",
  "researcher_uid",
  "demographics",
  "__hpm_context",
  "participant",
  "psychopyVersion",
  "frameRate",
]);

const TEST_ID_ALIASES = {
  syg: "Sygnalizacja",
  semafor: "Semafor",
  pingpong: "PingPong",
  samochodzik: "Samochodzik",
  stop: "Stop",
  bystreoczko: "BystreOczko",
};

/**
 * Mapa synonimów metryk z testów JS (BBTP) do jednolitego klucza kanonicznego.
 * Zapobiega powielaniu tych samych pojęć (np. bledne vs ilosc_blednych_nacisniec).
 */
const CANONICAL_METRIC_MAP = {
  score: "score",

  // Punkty / poprawne
  poprawne: "poprawne",
  poprawne_reakcje: "poprawne",
  poprawnetrafienia: "poprawne",
  punkty: "poprawne",
  zdobyte_punkty: "poprawne",
  ilosc_poprawnych_nacisniec: "poprawne",

  // Błędy
  bledne: "bledne",
  bledne_reakcje: "bledne",
  bledy: "bledne",
  ilosc_blednych_nacisniec: "bledne",
  bledne_lacznie: "bledne",
  bledne_klikniecia: "bledne",

  // Wszystkie próby / kliknięcia
  wszystkie: "wszystkie_proby",
  wszystkie_proby: "wszystkie_proby",
  wszystkie_kliki: "wszystkie_proby",
  ogolna_ilosc_nacisniec: "wszystkie_proby",
  proby: "wszystkie_proby",
  wszystkie_próby: "wszystkie_proby",

  // Czas reakcji (ms)
  sredni_czas_reakcji: "sredni_czas_ms",
  sredni_czas_ms: "sredni_czas_ms",
  avg_hit_rt_ms: "sredni_czas_ms",
  czas_reakcji: "sredni_czas_ms",
  czas_ms: "sredni_czas_ms",

  // Skuteczność
  skutecznosc: "skutecznosc",
  skutecznosc_proc: "skutecznosc",
  accuracy_percent: "skutecznosc",

  // Pominięte
  pominiete: "pominiete",
  pominiete_cele: "pominiete",

  // Poziom trudności
  poziom_trudnosci: "poziom_trudnosci",
  poziom: "poziom_trudnosci",
  trasa: "poziom_trudnosci",

  // Sekwencje
  max_dlugosc_sekwencji: "max_dlugosc_sekwencji",
  max_sekwencja: "max_dlugosc_sekwencji",
};

const METRIC_LABELS = {
  score: "Wynik (score)",
  poprawne: "Zdobyte punkty",
  bledne: "Błędy",
  wszystkie_proby: "Wszystkie próby",
  sredni_czas_ms: "Średni czas reakcji (ms)",
  skutecznosc: "Skuteczność (%)",
  pominiete: "Pominięte",
  poziom_trudnosci: "Poziom trudności",
  max_dlugosc_sekwencji: "Maks. długość sekwencji",
};

export function normalizeTestId(id) {
  if (id === null || id === undefined || id === "") return "Nieznany";
  const key = String(id).trim().toLowerCase();
  return TEST_ID_ALIASES[key] || String(id).trim();
}

export function metricBaseName(key) {
  const parts = String(key).split(" - ");
  return parts[parts.length - 1].trim();
}

export function canonicalMetricKey(key) {
  const base = metricBaseName(key).toLowerCase().trim();
  return CANONICAL_METRIC_MAP[base] || base;
}

export function metricLabel(key) {
  const canonical = canonicalMetricKey(key);
  if (METRIC_LABELS[canonical]) return METRIC_LABELS[canonical];
  const base = metricBaseName(key);
  if (METRIC_LABELS[base.toLowerCase()]) return METRIC_LABELS[base.toLowerCase()];
  return base
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isNumeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function extractMetrics(result) {
  const flat = {};
  flattenObject(result?.wyniki || result?.data || {}, flat);

  if (flat.score === undefined && result?.score !== undefined) {
    flat.score = result.score;
  }

  const map = new Map();

  for (const [rawKey, rawValue] of Object.entries(flat)) {
    const segments = rawKey.split(" - ");
    if (segments.some((seg) => STATS_IGNORE_KEYS.has(seg.trim()))) continue;
    let value = rawValue;
    if (typeof value === "string") {
      const num = Number(value.replace(",", "."));
      if (!Number.isNaN(num) && value.trim() !== "") value = num;
    }
    if (!isNumeric(value)) continue;

    const key = canonicalMetricKey(rawKey);
    const isFromStats = rawKey.startsWith("statystyki - ");

    // Jeśli klucza jeszcze nie ma lub dana wartość pochodzi ze szczegółowych 'statystyki',
    // zapisujemy ją pod kanonicznym kluczem (deduplikacja i ujednolicenie)
    if (!map.has(key) || isFromStats) {
      map.set(key, { key, label: metricLabel(key), value: Number(value) });
    }
  }

  return Array.from(map.values());
}

const SCORE_FALLBACK_KEYS = [
  "zdobyte_punkty",
  "punkty",
  "ilosc_poprawnych_nacisniec",
  "poprawne",
  "poprawne_reakcje",
];

function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const num = Number(value.replace(",", "."));
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

/**
 * Wynik główny wykonania: `score`, a gdy go brak — metryka punktowa
 * (np. `ilosc_poprawnych_nacisniec`), bo część testów nie zapisuje `score`.
 */
export function scoreOf(result) {
  const metrics = extractMetrics(result);
  const match =
    metrics.find((m) => m.key === "score") ||
    metrics.find((m) => /(^| - )score$/i.test(m.key)) ||
    metrics.find((m) => m.key.toLowerCase().endsWith("score"));
  if (match) return match.value;

  const topLevel = asNumber(result?.score);
  if (topLevel !== null) return topLevel;

  for (const key of SCORE_FALLBACK_KEYS) {
    const canonicalKey = canonicalMetricKey(key);
    const found = metrics.find(
      (m) => m.key === key || m.key === canonicalKey || m.key.endsWith(` - ${key}`),
    );
    if (found) return found.value;
  }
  return null;
}

/** Czy dla metryki lepsza jest wartość niższa (błędy, czasy reakcji). */
export function isLowerBetter(key, label = "") {
  const text = `${key} ${label}`.toLowerCase();
  return /błęd|bled|błąd|blad|error|pomini|czas|reakcj|opóźn|latenc|\brt\b/.test(
    text,
  );
}

export function distinctTestIds(results) {
  const set = new Set();
  (results || []).forEach((r) => set.add(normalizeTestId(testIdOf(r))));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
}

export function distinctSubjectIds(results, testId = null) {
  const target = testId ? normalizeTestId(testId) : null;
  const set = new Set();
  (results || []).forEach((r) => {
    if (target && normalizeTestId(testIdOf(r)) !== target) return;
    const sid = subjectIdOf(r);
    if (sid && sid !== "Nieznany") set.add(sid);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pl"));
}

export function filterStatisticsResults(results, { testId = null, subjectIds = [] } = {}) {
  const target = testId ? normalizeTestId(testId) : null;
  const subjects = Array.isArray(subjectIds)
    ? subjectIds.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
    : [];
  return (results || [])
    .filter((r) => {
      if (target && normalizeTestId(testIdOf(r)) !== target) return false;
      if (subjects.length > 0) {
        const sid = String(subjectIdOf(r)).trim().toLowerCase();
        if (!subjects.includes(sid)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function compareRuns(runA, runB, selectedKeys = []) {
  const mapA = new Map(extractMetrics(runA).map((m) => [m.key, m.value]));
  const mapB = new Map(extractMetrics(runB).map((m) => [m.key, m.value]));
  const canonicalSelected = (selectedKeys || []).map(canonicalMetricKey);
  const keys =
    canonicalSelected && canonicalSelected.length > 0
      ? Array.from(new Set(canonicalSelected))
      : Array.from(new Set([...mapA.keys(), ...mapB.keys()]));
  return keys.map((key) => {
    const valueA = mapA.has(key) ? mapA.get(key) : null;
    const valueB = mapB.has(key) ? mapB.get(key) : null;
    let delta = null;
    let deltaPercent = null;
    if (valueA !== null && valueB !== null) {
      delta = valueB - valueA;
      if (valueA !== 0) deltaPercent = (delta / valueA) * 100;
    }
    return {
      key,
      label: metricLabel(key),
      valueA,
      valueB,
      delta,
      deltaPercent,
      lowerIsBetter: isLowerBetter(key, metricLabel(key)),
    };
  });
}

export function aggregateMetrics(runs, selectedKeys = []) {
  const canonicalSelected =
    selectedKeys && selectedKeys.length > 0
      ? new Set(selectedKeys.map(canonicalMetricKey))
      : null;
  const stats = new Map();
  (runs || []).forEach((run) => {
    extractMetrics(run).forEach((m) => {
      if (canonicalSelected && !canonicalSelected.has(m.key)) return;
      if (!stats.has(m.key)) {
        stats.set(m.key, { key: m.key, label: m.label, count: 0, sum: 0, min: null, max: null });
      }
      const s = stats.get(m.key);
      s.count += 1;
      s.sum += m.value;
      if (s.min === null || m.value < s.min) s.min = m.value;
      if (s.max === null || m.value > s.max) s.max = m.value;
    });
  });
  return Array.from(stats.values())
    .map((s) => ({
      key: s.key,
      label: s.label,
      count: s.count,
      avg: s.count > 0 ? s.sum / s.count : null,
      min: s.min,
      max: s.max,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

export function trendForMetric(runs, metricKey) {
  if (!metricKey) return [];
  const target = canonicalMetricKey(metricKey);
  return (runs || [])
    .map((r) => {
      const m = extractMetrics(r).find((x) => x.key === target || x.key === metricKey);
      return {
        timestamp: r.timestamp,
        subjectId: subjectIdOf(r),
        value: m ? m.value : null,
      };
    })
    .filter((x) => x.value !== null)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
