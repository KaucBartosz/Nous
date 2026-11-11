// src/results/resultExporter.js — ResultExporter (C3): 1 eksporter zamiast 4 wariantów CSV.
// Polityka: separator `;`, BOM, quoting przy `;`/`\n` (bajtowo zgodna ze starą).
import { flattenObject } from "../modules/utils.js";
import { normalizeResult } from "./resultPackage.js";
import { t } from "../i18n/index.js";

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

/**
 * Jedyny escaper CSV w kodzie (były 3 kopie).
 * Decyzja 2b/b: reguła maina (cytuj też przy `"`) — poprawniejsza niż stara
 * (sam cudzysłów bez `;` psuł CSV).
 */
export function escapeCsvCell(value) {
  const s = String(value);
  return s.includes(";") || s.includes("\n") || s.includes('"')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * Kopiuje obiekt bez wskazanych kluczy (metadane protokołu nie trafiają do CSV).
 */
export function omitKeys(source, keys = []) {
  if (!source || typeof source !== "object") return {};
  if (keys.length === 0) return source;
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key)) out[key] = value;
  }
  return out;
}

/**
 * Spłaszcza Wynik do wiersza {etykieta: wartość}.
 * @param {boolean} deep — true: rekurencyjny flatten, false: tylko pierwszy poziom
 * @param {boolean} includeDemographics — Web pomija metryczkę w pliku dla badanego
 */
export function resultRow(
  pkgLike,
  { includeResearcher = true, includeDemographics = true, ignoreKeys = [], deep = true } = {},
) {
  const pkg = normalizeResult(pkgLike);
  const flat = {};
  flat[t("csv.date")] = new Date(pkg.timestamp).toLocaleString();
  flat[t("csv.testId")] = pkg.test_id;
  flat[t("csv.subjectId")] = pkg.subject_id || "-";
  // Decyzja 2b/b: brakujący badacz to "-" jak badany (wcześniej literalne "null").
  if (includeResearcher) flat[t("csv.researcherUid")] = pkg.researcher_uid ?? "-";

  if (includeDemographics) {
    const demo = pkg.demographics || {};
    const dData = demo.data || demo;
    if (dData && typeof dData === "object") {
      // Decyzja 2b/b: metryczkę spłaszczamy jak wyniki (ten sam ` - `),
      // zamiast wpisywać obiekty (kończyły jako "[object Object]").
      const demoFlat = {};
      flattenObject(dData, demoFlat, t("csv.demographics"));
      Object.assign(flat, demoFlat);
    }
  }

  // Klucze protokołu odfiltrowane PRZED spłaszczeniem — inaczej `deep`
  // omijał filtr i obiekty trafiały do CSV jako "[object Object]".
  const resData = omitKeys(pkg.wyniki || {}, ignoreKeys);
  if (deep) {
    const flatWyniki = {};
    flattenObject(resData, flatWyniki, t("csv.result"));
    Object.assign(flat, flatWyniki);
  } else {
    for (const [key, value] of Object.entries(resData)) {
      if (value !== undefined && value !== null) {
        flat[`${t("csv.result")} - ${key}`] = value;
      }
    }
  }
  return flat;
}

/** CSV klucz-wartość (pojedynczy wynik): nagłówek `Parametr;Wartość`. */
export function toKeyValueCSV(flat) {
  let out = `${CSV_BOM}${t("csv.parameter")};${t("csv.value")}\r\n`;
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
