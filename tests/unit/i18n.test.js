import { describe, it, expect, vi } from 'vitest';
import { pl } from '../../src/i18n/locales/pl.js';
import { en } from '../../src/i18n/locales/en.js';
import { detectLocale, getLocale, initI18n } from '../../src/i18n/index.js';

function flatten(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys = keys.concat(flatten(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

describe('i18n key parity', () => {
  it('pl and en have the same keys', () => {
    const plKeys = new Set(flatten(pl));
    const enKeys = new Set(flatten(en));
    const pluralSuffixes = ['_few', '_many', '_other', '_one', '_zero', '_two'];
    const isPluralKey = (k) => pluralSuffixes.some(s => k.endsWith(s));
    const missingInEn = [...plKeys].filter(k => !enKeys.has(k) && !isPluralKey(k));
    const missingInPl = [...enKeys].filter(k => !plKeys.has(k) && !isPluralKey(k));
    console.log('pl keys:', plKeys.size, 'en keys:', enKeys.size);
    console.log('missing in en:', missingInEn);
    console.log('missing in pl:', missingInPl);
    expect(missingInEn).toHaveLength(0);
    expect(missingInPl).toHaveLength(0);
  });
});

describe('i18n bootstrap — język testów w Web', () => {
  it('zapisuje wykryty angielski, żeby okno testu dostało en', () => {
    localStorage.clear();
    vi.stubGlobal('navigator', { language: 'en-US' });

    expect(detectLocale()).toBe('en');
    initI18n();

    expect(getLocale()).toBe('en');
    expect(localStorage.getItem('nous-language')).toBe('en');

    vi.unstubAllGlobals();
  });

  it('zapisany polski ma pierwszeństwo przed angielską przeglądarką', () => {
    localStorage.setItem('nous-language', 'pl');
    vi.stubGlobal('navigator', { language: 'en-US' });

    expect(detectLocale()).toBe('pl');
    initI18n();

    expect(getLocale()).toBe('pl');
    expect(localStorage.getItem('nous-language')).toBe('pl');

    vi.unstubAllGlobals();
    localStorage.clear();
  });
});