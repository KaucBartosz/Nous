// src/i18n/index.js — lekki runtime i18n (PL/EN) dla Launchera Nous.
//
// Zasady:
// - zero zależności, słowniki bundlowane w aplikacji (brak sieci przy starcie),
// - klucze płaskie z kropką (`nav.library`), słowniki zagnieżdżone spłaszcza się
//   raz przy starcie,
// - interpolacja `{{zmienna}}`,
// - plurale: `t('klucz', { count })` → `klucz_one` / `klucz_few` / `klucz_many`
//   (PL) albo `klucz_one` / `klucz_other` (EN),
// - statyczny HTML: atrybuty `data-i18n`, `data-i18n-placeholder`,
//   `data-i18n-title`, `data-i18n-aria-label`,
// - fallback: brak klucza w EN → PL → nazwa klucza (plus warning w konsoli).
import { pl } from "./locales/pl.js";
import { en } from "./locales/en.js";

const DICTS = { pl, en };
const STORAGE_KEY = "nous-language";
const FALLBACK = "pl";

let currentLocale = FALLBACK;
const listeners = new Set();

/** Spłaszcza słownik zagnieżdżony do płaskich kluczy z kropką. */
function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[full] = value;
    else if (value && typeof value === "object") flatten(value, full, out);
  }
  return out;
}

const FLAT = Object.fromEntries(
  Object.entries(DICTS).map(([locale, dict]) => [locale, flatten(dict)]),
);

/** Sufiks liczby mnogiej: PL (one/few/many) i EN (one/other). */
function pluralSuffix(locale, count) {
  if (locale === "pl") {
    if (count === 1) return "one";
    const mod10 = Math.abs(count) % 10;
    const mod100 = Math.abs(count) % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  return count === 1 ? "one" : "other";
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

/**
 * Tłumaczenie klucza. Przy podaniu `count` wybiera formę pluralną.
 * @param {string} key
 * @param {Record<string, any>} [params]
 */
export function t(key, params = {}) {
  const dict = FLAT[currentLocale] || FLAT[FALLBACK];
  let str = dict[key];

  if (str === undefined) {
    str = FLAT[FALLBACK][key];
    if (str === undefined) {
      console.warn(`[i18n] brak klucza "${key}"`);
      return key;
    }
    console.warn(
      `[i18n] brak klucza "${key}" w "${currentLocale}" — fallback na PL`,
    );
  }

  if (params.count !== undefined) {
    const pluralKey = `${key}_${pluralSuffix(currentLocale, params.count)}`;
    const pluralStr = dict[pluralKey] ?? FLAT[FALLBACK][pluralKey];
    if (pluralStr !== undefined) str = pluralStr;
  }

  return interpolate(str, params);
}

export function getLocale() {
  return currentLocale;
}

/** Tag BCP-47 dla Intl (np. "pl-PL", "en-US"). */
export function localeTag() {
  return currentLocale === "pl" ? "pl-PL" : "en-US";
}

/** Formatowanie liczb zgodne z aktywnym językiem. */
export function formatNumber(value, options) {
  try {
    return new Intl.NumberFormat(localeTag(), options).format(value);
  } catch (e) {
    return String(value);
  }
}

/** Formatowanie daty zgodne z aktywnym językiem. */
export function formatDate(value, options) {
  try {
    return new Date(value).toLocaleDateString(localeTag(), options);
  } catch (e) {
    return String(value);
  }
}

/** Formatowanie daty i czasu zgodne z aktywnym językiem. */
export function formatDateTime(value, options) {
  try {
    return new Date(value).toLocaleString(localeTag(), options);
  } catch (e) {
    return String(value);
  }
}

export function getSupportedLocales() {
  return Object.keys(DICTS);
}

export function isLocaleSupported(locale) {
  return Object.prototype.hasOwnProperty.call(DICTS, locale);
}

/** Subskrypcja zmiany języka. Zwraca funkcję odsłaniającą. */
export function onLocaleChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Ustawia język, aktualizuje `<html lang>`, statyczny HTML i powiadamia
 * subskrybentów (widoki przerysowują dynamiczną treść).
 */
export function setLocale(locale, { persist = true } = {}) {
  if (!isLocaleSupported(locale)) locale = FALLBACK;
  currentLocale = locale;

  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    applyI18n(document);
  }
  if (persist && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (e) {
      console.warn("[i18n] nie udało się zapisać języka:", e);
    }
  }

  for (const callback of listeners) {
    try {
      callback(locale);
    } catch (e) {
      console.error("[i18n] błąd subskrybenta:", e);
    }
  }
  return currentLocale;
}

/**
 * Autodetekcja: zapisany wybór > język przeglądarki (PL → pl, reszta → en).
 */
export function detectLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isLocaleSupported(saved)) return saved;
  } catch (e) {
    // localStorage niedostępny (np. tryb prywatny) — ignorujemy.
  }
  const nav =
    (typeof navigator !== "undefined" && navigator.language) || "";
  return String(nav).toLowerCase().startsWith("pl") ? "pl" : "en";
}

/** Inicjalizacja na starcie aplikacji (sync, najwcześniej jak możliwe). */
export function initI18n() {
  const locale = detectLocale();
  currentLocale = isLocaleSupported(locale) ? locale : FALLBACK;
  if (typeof document !== "undefined") {
    document.documentElement.lang = currentLocale;
    applyI18n(document);
  }
  return currentLocale;
}

/**
 * Przeszukuje drzewo i podmienia tekst/atrybuty elementów z atrybutami
 * `data-i18n*`. Wołane na starcie i przy zmianie języka.
 */
export function applyI18n(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;

  root.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"));
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute(
      "placeholder",
      t(el.getAttribute("data-i18n-placeholder")),
    );
  });
  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute(
      "aria-label",
      t(el.getAttribute("data-i18n-aria-label")),
    );
  });
}
