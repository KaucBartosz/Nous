// main/bulkExport.js — BulkExport (C, decyzja 2b wariant b).
// Czysty CommonJS: buduje wiersz CSV jak ResultExporter (`src/results/resultExporter.js`).
// Main nie może importować ESM z src/ (proces Electrona), więc logika jest tu
// zduplikowana CELOWO — prawdą jest TEST PARYTETU (tests/unit/bulkExport.test.js):
// buildBulkRow(f) deep-equals resultRow(f) na tych samych fixturach.
// Reguły (2b/b): nagłówki ` - `, `Badacz UID`, braki `-`, quoting przy `;` `\n` `"`.

const CSV_BOM = "﻿";

/**
 * Kopia utils.flattenObject (separator ` - `, tablice jako JSON, guard cykli).
 * Kopia zamiast importu — patrz nagłówek pliku.
 */
function flattenDeep(obj, target, prefix, visited = new WeakSet()) {
  if (obj === null || typeof obj !== "object") return;
  if (visited.has(obj)) return;
  visited.add(obj);

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix} - ${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      flattenDeep(value, target, newKey, visited);
    } else {
      target[newKey] = Array.isArray(value) ? JSON.stringify(value) : value;
    }
  }
}

/** Kopia resultExporter.escapeCsvCell (reguła maina — cytuj też przy `"`). */
function escapeCell(value) {
  const s = String(value);
  return s.includes(";") || s.includes("\n") || s.includes('"')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * Wiersz jak resultRow(pkg, { deep: true }): te same klucze w tej samej kolejności.
 * Domyślne jak w normalizeResult/resultRow: test "test", braki "-".
 * (Nazwa pliku ZIP — `Wynik_${testId}_...` — zostaje po staremu, to nie kolumna.)
 */
function buildBulkRow(res) {
  const resData = res.wyniki || res.data || {};
  const flat = {};
  flat["Data"] = new Date(res.timestamp || new Date().toISOString()).toLocaleString();
  flat["Test ID"] = res.test_id || res.testId || "test";
  const subj =
    res.subject_id ?? (resData && resData.subjectId) ?? res.subjectId ?? null;
  flat["ID Badanego"] = subj || "-";
  flat["Badacz UID"] = res.researcher_uid ?? "-";

  const demo = res.demographics || {};
  const dData = demo.data || demo;
  if (dData && typeof dData === "object") flattenDeep(dData, flat, "Metryczka");

  if (resData && typeof resData === "object") flattenDeep(resData, flat, "Wynik");
  return flat;
}

/** Jeden CSV na wynik (nagłówek + 1 wiersz), jak dotąd w download-bulk-zip. */
function buildBulkCsv(res) {
  const flat = buildBulkRow(res);
  const headers = Object.keys(flat);
  let out = CSV_BOM;
  out += headers.join(";") + "\r\n";
  out +=
    headers.map((h) => escapeCell(flat[h] === undefined ? "" : flat[h])).join(";") +
    "\r\n";
  return out;
}

module.exports = { buildBulkRow, buildBulkCsv, escapeCell, CSV_BOM };
