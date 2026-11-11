// i18n.js — język testu BBTP (pl/en).
//
// Język pochodzi z hosta: desktop (Nous) podaje go przez preload_test.js,
// Web przez test-lang.js (wybór języka Nous → localStorage 'nous-language').
//
// Brak i18n u którejkolwiek strony = zawsze polski (język źródłowy):
// - host istnieje, ale nie ma getLanguage → PL,
// - brak hosta i brak zapisanego wyboru → PL (bez zgadywania z przeglądarki).
// Angielski tylko wtedy, gdy host jawnie podał 'en'.
//
// Ten plik jest identyczny we wszystkich testach — zmienia się tylko strings.js.

import { STRINGS } from './strings.js';

const FALLBACK_LANG = 'pl';

const PLURAL_SUFFIX = {
  pl: (n) => {
    if (n === 1) return 'one';
    const m10 = Math.abs(n) % 10;
    const m100 = Math.abs(n) % 100;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
    return 'many';
  },
  en: (n) => (n === 1 ? 'one' : 'other'),
};

function detectLanguage() {
  if (window.electronTest) {
    const fromHost = typeof window.electronTest.getLanguage === 'function'
      ? window.electronTest.getLanguage()
      : null;
    return fromHost === 'en' ? 'en' : FALLBACK_LANG;
  }
  try {
    const saved = localStorage.getItem('nous-language');
    if (saved === 'pl' || saved === 'en') return saved;
  } catch (e) {}
  return FALLBACK_LANG;
}

export const lang = detectLanguage();

/**
 * Tłumaczy klucz z katalogu STRINGS. Parametry: {{zmienna}}.
 * Przy `count` wybiera formę pluralną (`klucz_one/_few/_many` lub `_one/_other`).
 */
export function t(key, params = {}) {
  const dict = STRINGS[lang] || STRINGS.pl;
  let str = dict[key];
  if (str === undefined) str = STRINGS.pl[key];
  if (str === undefined) return key;
  if (params.count !== undefined) {
    const plural = dict[`${key}_${PLURAL_SUFFIX[lang](params.count)}`];
    if (plural !== undefined) str = plural;
  }
  return str.replace(/\{\{(\w+)\}\}/g, (m, name) =>
    params[name] !== undefined ? String(params[name]) : m);
}
