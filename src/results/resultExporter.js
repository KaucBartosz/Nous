// src/results/resultExporter.js — ResultExporter (C3): 1 eksporter zamiast 4 wariantów CSV.
// Polityka: separator `;`, BOM, quoting przy `;`/`\n` (bajtowo zgodna ze starą).
import { flattenObject } from "../modules/utils.js";
import { normalizeResult } from "./resultPackage.js";

export const CSV_SEPARATOR = ";";
export const CSV_MIME = "text/csv;charset=utf-8;";
export const CSV_BOM = "﻿";

/** Klucze pomijane w eksporcie Web (metadane protokołu, nie wyniki). */
export const WEB_RESULT_IGNORE_KEYS = [
  "testId",
  "subjectId",
  "timestamp",
  "test_id",
  "subject_id",
  "researcher_uid",
  "demographics",
  "__hpm_context",
  "participant",
  "psychopyVersion",
  "frameRate",
];

/** Jedyny escaper CSV w kodzie (były 3 kopie). */
export function escapeCsvCell(value) {
  const s = String(value);
  return s.includes(";") || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * Spłaszcza Wynik do wiersza {etykieta: wartość}.
 * @param {boolean} deep — true: rekurencyjny flatten (historia), false: płasko + ignoreKeys (Web)
 */
export function resultRow(pkgLike, { includeResearcher = true, ignoreKeys = [], deep = true } = {}) {
  const pkg = normalizeResult(pkgLike);
  const flat = {};
  flat["Data"] = new Date(pkg.timestamp).toLocaleString();
  flat["Test ID"] = pkg.test_id;
  flat["ID Badanego"] = pkg.subject_id || "-";
  if (includeResearcher) flat["Badacz UID"] = pkg.researcher_uid;

  const demo = pkg.demographics || {};
  const dData = demo.data || demo;
  if (dData && typeof dData === "object") {
    for (const k of Object.keys(dData)) flat[`Metryczka - ${k}`] = dData[k];
  }

  const resData = pkg.wyniki || {};
  if (deep) {
    const flatWyniki = {};
    flattenObject(resData, flatWyniki, "Wynik");
    Object.assign(flat, flatWyniki);
  } else {
    for (const [key, value] of Object.entries(resData)) {
      if (!ignoreKeys.includes(key) && value !== undefined && value !== null) {
        flat[`Wynik - ${key}`] = value;
      }
    }
  }
  return flat;
}

/** CSV klucz-wartość (pojedynczy wynik): nagłówek `Parametr;Wartość`. */
export function toKeyValueCSV(flat) {
  let out = `${CSV_BOM}Parametr;Wartość\r\n`;
  for (const [key, value] of Object.entries(flat)) {
    out += `${key};${escapeCsvCell(value)}\r\n`;
  }
  return out;
}

/** CSV macierzowy (wiele wyników): nagłówek = unia kluczy, braki = "". */
export function toMatrixCSV(flats) {
  const keys = [];
  const seen = new Set();
  flats.forEach((f) =>
    Object.keys(f).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }),
  );
  let out = `${CSV_BOM}${keys.join(CSV_SEPARATOR)}\r\n`;
  flats.forEach((flat) => {
    out +=
      keys
        .map((k) => (flat[k] !== undefined ? escapeCsvCell(flat[k]) : ""))
        .join(CSV_SEPARATOR) + "\r\n";
  });
  return out;
}

/** Pobieranie pliku przez Blob (było kopiowane w 2 miejscach). */
export function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
