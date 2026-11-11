// main/bulkExport.js — BulkExport (C, decyzja 2b wariant b).
// Czysty CommonJS: buduje wiersz CSV jak ResultExporter (`src/results/resultExporter.js`).
// Main nie może importować ESM z src/ (proces Electrona), więc logika jest tu
// zduplikowana CELOWO — prawdą jest TEST PARYTETU (tests/unit/bulkExport.test.js):
// buildBulkRow(f) deep-equals resultRow(f) na tych samych fixturach.
// Reguły (2b/b): nagłówki ` - `, `Badacz UID`, braki `-`, quoting przy `;` `\n` `"`.

const CSV_BOM = "﻿";

// Main nie zna języka interfejsu — etykiety kolumn podaje renderer (i18n).
// Fallback PL = dotychczasowe nagłówki dla wywołań bez UI.
const DEFAULT_LABELS = {
  date: "Data",
  testId: "Test ID",
  subjectId: "ID Badanego",
  researcherUid: "Badacz UID",
  demographics: "Metryczka",
  result: "Wynik",
  parameter: "Parametr",
  value: "Wartość",
};

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
function buildBulkRow(res, labels = DEFAULT_LABELS) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const resData = res.wyniki || res.data || {};
  const flat = {};
  flat[L.date] = new Date(res.timestamp || new Date().toISOString()).toLocaleString();
  flat[L.testId] = res.test_id || res.testId || "test";
  const subj =
    res.subject_id ?? (resData && resData.subjectId) ?? res.subjectId ?? null;
  flat[L.subjectId] = subj || "-";
  flat[L.researcherUid] = res.researcher_uid ?? "-";

  const demo = res.demographics || {};
  const dData = demo.data || demo;
  if (dData && typeof dData === "object") flattenDeep(dData, flat, L.demographics);

  if (resData && typeof resData === "object") flattenDeep(resData, flat, L.result);
  return flat;
}

/** Jeden CSV na wynik w układzie key-value — BAJTOWO jak pojedyncze pobranie
 * tego samego wyniku (src/results/resultExporter.js: toKeyValueCSV(resultRow)).
 * Decyzja: ZIP = N x single (wariant A). Kopia zamiast importu — main nie
 * importuje ESM z src/; prawdą jest test parytetu serializacji. */
function buildBulkCsv(res, labels = DEFAULT_LABELS) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const flat = buildBulkRow(res, labels);
  let out = `${CSV_BOM}${L.parameter};${L.value}\r\n`;
  for (const [key, value] of Object.entries(flat)) {
    out += `${key};${escapeCell(value)}\r\n`;
  }
  return out;
}

/**
 * Fabryka C6: handler download-bulk-zip przeniesiony 1:1 z main.js.
 * Dwa tryby (decyzja użytkownika w Ustawieniach):
 * - destDir == null (domyślnie): natywne okno zapisu, default w Downloads;
 * - destDir ustawiony ("Ciche pobieranie"): zapis wprost, bez okna.
 * dialog/AdmZip/path/folder-downloads wstrzyknięte (wzorzec jak main/templates.js).
 */
function createBulkExport({ dialog, AdmZip, path, getDownloadsDir }) {
  async function downloadBulkZip(
    getMainWindow,
    { results, filename, format, destDir = null, dialogTitle, labels },
  ) {
    try {
      const zip = new AdmZip();

      results.forEach((res) => {
        const dateStr = new Date(res.timestamp || res.synced_at).toISOString().replace(/[:.]/g, '-');
        const testId = res.test_id || res.testId || 'unknown';
        const subjectId = res.subject_id || 'unknown';
        // Nazwy plików w archiwum są neutralne językowo (to dane, nie UI).
        const baseName = `Result_${testId}_${subjectId}_${dateStr}`;

        if (format === 'csv') {
          const csvContent = buildBulkCsv(res, labels);
          zip.addFile(`${baseName}.csv`, Buffer.from(csvContent, 'utf8'));
        } else {
          const jsonStr = JSON.stringify(res, null, 2);
          zip.addFile(`${baseName}.json`, Buffer.from(jsonStr, 'utf8'));
        }
      });

      // SEC: sama nazwa pliku (bez podkatalogów z ładunku).
      const safeName = path.basename(filename || `Results_${Date.now()}.zip`);

      if (destDir) {
        const filePath = path.join(destDir, safeName);
        zip.writeZip(filePath);
        return { success: true, filePath };
      }

      const { filePath } = await dialog.showSaveDialog(getMainWindow(), {
        // Tytuł z renderera (i18n); fallback EN dla wywołań bez UI.
        title: dialogTitle || 'Save result package (ZIP)',
        defaultPath: path.join(getDownloadsDir(), safeName),
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
      });

      if (filePath) {
        zip.writeZip(filePath);
        return { success: true, filePath };
      }
      return { success: false, cancelled: true };
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
