// dialog-i18n.js — polskie etykiety dialogów PsychoJS (boilerplate, identyczny
// we wszystkich testach). Teksty wbudowane w PsychoJS (angielskie) są podmieniane
// na teksty z SHARED — jeden MutationObserver łapie każdy dialog: DlgFromDict
// na starcie i późniejsze komunikaty (cancel, koniec testu).
//
// Podmiana działa po tekście źródłowym, bez dostępu do API PsychoJS. Element
// dostaje data-i18n-dialog po podmianie, więc powtórne wywołanie nic nie zmienia.

const SHARED = {
  pl: {
    'Cancel': 'Anuluj',
    'Cancel Experiment': 'Anuluj eksperyment',
    'Start Experiment': 'Rozpocznij eksperyment',
    'Fields marked with an asterisk (*) are required.': 'Pola oznaczone gwiazdką (*) są wymagane.',
  },
  en: {},
};

const TEXT_ATTRIBUTES = ['aria-label', 'title', 'placeholder'];
const ATTR_FLAG = 'data-i18n-dialog';
const TEXT_FLAG = 'data-i18n-dialog-text';

function localizeElement(el, dict) {
  if (el.nodeType === Node.TEXT_NODE) {
    const parent = el.parentElement;
    const key = el.nodeValue.trim();
    if (!parent || parent.hasAttribute(TEXT_FLAG)) return;
    if (key && dict[key] !== undefined) {
      el.nodeValue = el.nodeValue.replace(key, dict[key]);
      parent.setAttribute(TEXT_FLAG, '');
    }
    return;
  }
  if (el.nodeType !== Node.ELEMENT_NODE) return;
  if (!el.hasAttribute(ATTR_FLAG)) {
    let changed = false;
    for (const attr of TEXT_ATTRIBUTES) {
      const value = el.getAttribute(attr);
      if (value && dict[value] !== undefined) {
        el.setAttribute(attr, dict[value]);
        changed = true;
      }
    }
    if (changed) el.setAttribute(ATTR_FLAG, '');
  }
  for (const child of el.childNodes) localizeElement(child, dict);
}

/**
 * Uruchamia tłumaczenie dialogów PsychoJS. `language` to 'pl' | 'en'.
 * Zwraca funkcję zatrzymującą obserwator (przydatne w smoketestach).
 */
export function localizePsychoJSDialogs(language) {
  const dict = SHARED[language] || SHARED.pl;
  const apply = (root) => localizeElement(root, dict);

  apply(document.body);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) apply(node);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
