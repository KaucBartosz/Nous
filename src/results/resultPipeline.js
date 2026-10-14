// src/results/resultPipeline.js — ResultPipeline (A6): 1 orkiestracja zapisu Wyniku.
// Kolejność: save (DB) → export (Web: natychmiastowy CSV) → sync (w tle).
// Błąd synchronizacji nie cofa zapisu (jak wcześniej `.catch`).
// UI (modal, lista) zostaje w modules/results.js — pipeline zwraca fakty.
import {
  resultRow,
  toKeyValueCSV,
  downloadFile,
  WEB_RESULT_IGNORE_KEYS,
} from "./resultExporter.js";

/** Web nie ma historii — plik .csv generowany od razu po badaniu. */
export function needsInstantCsv(platformKind) {
  return platformKind === "web";
}

/** Czyste zbudowanie CSV Web (bez DOM — testowalne). */
export function webResultCsv(pkg) {
  const flat = resultRow(pkg, {
    includeResearcher: false,
    deep: false,
    ignoreKeys: WEB_RESULT_IGNORE_KEYS,
  });
  return {
    filename: `Wynik_${pkg.test_id}_${Date.now()}.csv`,
    csv: toKeyValueCSV(flat),
  };
}

export function downloadWebResultCsv(pkg) {
  const { filename, csv } = webResultCsv(pkg);
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
  return filename;
}

/**
 * @param {object} pkg — pakiet wyniku
 * @param {object} deps — { researcherUid, platformKind, saveResult, syncNow, onSyncError }
 * @returns {{ csvDownloaded: boolean }}
 */
export async function savePipeline(
  pkg,
  { researcherUid, platformKind, saveResult, syncNow, onSyncError } = {},
) {
  await saveResult(pkg, researcherUid);

  let csvDownloaded = false;
  if (needsInstantCsv(platformKind)) {
    downloadWebResultCsv(pkg);
    csvDownloaded = true;
  }

  try {
    const pending = syncNow();
    if (pending && typeof pending.catch === "function") {
      pending.catch((err) => onSyncError?.(err));
    }
  } catch (err) {
    onSyncError?.(err);
  }
  return { csvDownloaded };
}
