import { describe, it, expect } from 'vitest';
import { pl } from '../../src/i18n/locales/pl.js';
import { en } from '../../src/i18n/locales/en.js';

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