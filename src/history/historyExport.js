// src/history/historyExport.js — pakowanie eksportu Historii (F3a).
// Własność: CSV z danych (nie ze scrapowania DOM) + pliki pojedynczych
// wyników + choreografia przycisku pobierania. Stan widoku (filtry,
// strona, selekcja) wchodzi jawnymi parametrami — zero mutacji z ukrycia.
import {
  resultRow,
  toKeyValueCSV,
  toMatrixCSV,
  downloadFile,
} from "../results/resultExporter.js";
import { filterResults, paginate } from "../results/historyQuery.js";

/** CSV macierzowy z listy wyników (pusta lista → ""). */
export function csvOfResults(results) {
  if (!results || results.length === 0) return "";
  return toMatrixCSV(results.map((r) => resultRow(r, { deep: true })));
}

/** Pobranie CSV; false gdy brak danych (wołający pokazuje Notify). */
export function downloadResultsAsCSV(results, filename) {
  const csv = csvOfResults(results);
  if (!csv) return false;
  downloadFile(filename, csv, "text/csv;charset=utf-8;");
  return true;
}

/** Wiersze bieżącej strony widoku (filtr + paginacja jak render). */
export function pageCsvItems(all, filters, page, pageSize) {
  return paginate(filterResults(all, filters), page, pageSize).items;
}

/** Eksport bieżącego widoku; false gdy strona pusta. */
export function exportHistoryToCSV({ all, filters, page, pageSize }) {
  const items = pageCsvItems(all, filters, page, pageSize);
  if (items.length === 0) return false;
  return downloadResultsAsCSV(items, "historia_wynikow.csv");
}

/** Plik pojedynczego wyniku (format z radio dl-format, domyślnie json). */
export function singleResultFile(result, format = "json") {
  const test_id = result.test_id || result.testId;
  const stamp = new Date(result.timestamp).getTime();
  if (format === "csv") {
    return {
      filename: `wynik_${test_id}_${stamp}.csv`,
      content: toKeyValueCSV(resultRow(result, { deep: true })),
      mime: "text/csv;charset=utf-8;",
    };
  }
  return {
    filename: `wynik_${test_id}_${stamp}.json`,
    content: JSON.stringify(result, null, 2),
    mime: "application/json",
  };
}

export function downloadSingleResult(result) {
  const formatEl = document.querySelector('input[name="dl-format"]:checked');
  const format = formatEl ? formatEl.value : "json";
  const { filename, content, mime } = singleResultFile(result, format);
  downloadFile(filename, content, mime);
}

/**
 * Choreografia przycisku ZIP (busy + pasek + restore po 1s).
 * Zwraca null gdy elementów brak (wołający wychodzi jak wcześniej).
 */
export function beginDownloadButton(ids, busyLabel) {
  const btn = document.getElementById(ids.button);
  const btnText = document.getElementById(ids.text);
  const btnProgress = document.getElementById(ids.progress);
  if (!btn || !btnText || !btnProgress) return null;

  btn.classList.add("downloading");
  btn.disabled = true;
  const originalContent = btnText.innerHTML;
  btnText.innerHTML =
    `<span class="material-icons spin" style="font-size:16px;">sync</span> ${busyLabel}`;
  return {
    progress(pct) {
      btnProgress.style.width = pct;
    },
    restore() {
      setTimeout(() => {
        btn.classList.remove("downloading");
        btn.disabled = false;
        btnText.innerHTML = originalContent;
        btnProgress.style.width = "0%";
      }, 1000);
    },
  };
}

/** Format z radio dl-format (wspólny dla obu ścieżek ZIP). */
export function selectedDownloadFormat() {
  const formatEl = document.querySelector('input[name="dl-format"]:checked');
  return formatEl ? formatEl.value : "json";
}

/** Prefix przycisku ZIP wg widocznego kontenera (cloud/guest/local). */
export function downloadButtonPrefix({ cloudHidden, guestHidden }) {
  if (!cloudHidden) return "cloud";
  if (!guestHidden) return "guest";
  return "local";
}
