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

/** Jeden CSV na wynik w układzie key-value — BAJTOWO jak pojedyncze pobranie
 * tego samego wyniku (src/results/resultExporter.js: toKeyValueCSV(resultRow)).
 * Decyzja: ZIP = N x single (wariant A). Kopia zamiast importu — main nie
 * importuje ESM z src/; prawdą jest test parytetu serializacji. */
function buildBulkCsv(res) {
  const flat = buildBulkRow(res);
  let out = `${CSV_BOM}Parametr;Wartość\r\n`;
  for (const [key, value] of Object.entries(flat)) {
    out += `${key};${escapeCell(value)}\r\n`;
  }
  return out;
}

/**
 * Fabryka C6: handler download-bulk-zip przeniesiony 1:1 z main.js.
 * ZIP zapisuje CICHO do folderu Downloads (jak CSV w rendererze) —
 * bez natywnego okna zapisu. dialog/AdmZip/okno wstrzyknięte
 * (wzorzec jak main/templates.js).
 */
function createBulkExport({ AdmZip, path, getDownloadsDir }) {
  async function downloadBulkZip(getMainWindow, { results, filename, format }) {
    try {
      const zip = new AdmZip();

      results.forEach((res) => {
        const dateStr = new Date(res.timestamp || res.synced_at).toISOString().replace(/[:.]/g, '-');
        const testId = res.test_id || res.testId || 'unknown';
        const subjectId = res.subject_id || 'unknown';
        const baseName = `Wynik_${testId}_${subjectId}_${dateStr}`;

        if (format === 'csv') {
          const csvContent = buildBulkCsv(res);
          zip.addFile(`${baseName}.csv`, Buffer.from(csvContent, 'utf8'));
        } else {
          const jsonStr = JSON.stringify(res, null, 2);
          zip.addFile(`${baseName}.json`, Buffer.from(jsonStr, 'utf8'));
        }
      });

      // SEC: sama nazwa pliku (bez podkatalogów z ładunku).
      const safeName = path.basename(filename || `Wyniki_${Date.now()}.zip`);
      const filePath = path.join(getDownloadsDir(), safeName);
      zip.writeZip(filePath);
      return { success: true, filePath };
    } catch (e) {
      console.error("Bulk Zip Error:", e);
      return { success: false, error: e.message };
    }
  }

  function registerIpc(ipcMain, getMainWindow) {
    ipcMain.handle('download-bulk-zip', async (event, payload) =>
      downloadBulkZip(getMainWindow, payload),
    );
  }

  return { buildBulkRow, buildBulkCsv, escapeCell, CSV_BOM, downloadBulkZip, registerIpc };
}

module.exports = { createBulkExport, buildBulkRow, buildBulkCsv, escapeCell, CSV_BOM };
