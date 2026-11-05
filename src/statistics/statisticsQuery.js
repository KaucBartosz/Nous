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

const METRIC_LABELS = {
  score: "Wynik (score)",
  ilosc_poprawnych_nacisniec: "Zdobyte punkty",
  ilosc_blednych_nacisniec: "Błędy",
  ogolna_ilosc_nacisniec: "Naciśnięcia łącznie",
  sredni_czas_reakcji: "Średni czas reakcji (ms)",
  sredni_czas_ms: "Średni czas reakcji (ms)",
  czas_reakcji: "Czas reakcji",
  czas_ms: "Czas (ms)",
  poprawne: "Zdobyte punkty",
  poprawne_reakcje: "Zdobyte punkty",
  punkty: "Zdobyte punkty",
  zdobyte_punkty: "Zdobyte punkty",
  bledne: "Błędy",
  bledne_reakcje: "Błędy",
  bledy: "Błędy",
  wszystkie: "Wszystkie próby",
  wszystkie_proby: "Wszystkie próby",
  wszystkie_kliki: "Wszystkie kliknięcia",
  skutecznosc: "Skuteczność",
  skutecznosc_proc: "Skuteczność (%)",
  accuracy_percent: "Skuteczność (%)",
  pominiete: "Pominięte",
  pominiete_cele: "Pominięte cele",
  poziom_trudnosci: "Poziom trudności",
  max_dlugosc_sekwencji: "Maks. długość sekwencji",
  max_sekwencja: "Maks. sekwencja",
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

export function metricLabel(key) {
  const base = metricBaseName(key);
  if (METRIC_LABELS[base]) return METRIC_LABELS[base];
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
  const out = [];
  const seen = new Set();
  for (const [key, rawValue] of Object.entries(flat)) {
    const segments = key.split(" - ");
    if (segments.some((seg) => STATS_IGNORE_KEYS.has(seg.trim()))) continue;
    let value = rawValue;
    if (typeof value === "string") {
      const num = Number(value.replace(",", "."));
      if (!Number.isNaN(num) && value.trim() !== "") value = num;
    }
    if (!isNumeric(value)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: metricLabel(key), value: Number(value) });
  }
  return out;
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
    const found = metrics.find(
      (m) => m.key === key || m.key.endsWith(` - ${key}`),
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
  const subjects = Array.isArray(subjectIds) ? subjectIds : [];
  return (results || [])
    .filter((r) => {
      if (target && normalizeTestId(testIdOf(r)) !== target) return false;
      if (subjects.length > 0) {
        if (!subjects.includes(subjectIdOf(r))) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function compareRuns(runA, runB, selectedKeys = []) {
  const mapA = new Map(extractMetrics(runA).map((m) => [m.key, m.value]));
  const mapB = new Map(extractMetrics(runB).map((m) => [m.key, m.value]));
  const keys =
    selectedKeys && selectedKeys.length > 0
      ? selectedKeys
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
  const stats = new Map();
  (runs || []).forEach((run) => {
    extractMetrics(run).forEach((m) => {
      if (selectedKeys.length > 0 && !selectedKeys.includes(m.key)) return;
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
  return (runs || [])
    .map((r) => {
      const m = extractMetrics(r).find((x) => x.key === metricKey);
      return {
        timestamp: r.timestamp,
        subjectId: subjectIdOf(r),
        value: m ? m.value : null,
      };
    })
    .filter((x) => x.value !== null)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
