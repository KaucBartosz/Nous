import { describe, it, expect, vi } from 'vitest';
import { normalizeResult, testIdOf, subjectIdOf } from '../../src/results/resultPackage.js';
import {
  escapeCsvCell,
  resultRow,
  toKeyValueCSV,
  toMatrixCSV,
  WEB_RESULT_IGNORE_KEYS,
} from '../../src/results/resultExporter.js';
import {
  resolveStatusLabel,
  dayKeyOf,
  hasActiveFilters,
  matchesFilters,
  filterResults,
  paginate,
  emptyFilters,
} from '../../src/results/historyQuery.js';
import {
  buildLocalKeys,
  cloudKeyOf,
  isAlreadyImported,
  cloudRecordToLocal,
  decryptCloudRecords,
  importPreparedList,
  prepareGuestImport,
} from '../../src/results/cloudResults.js';

const pkg = () => ({
  test_id: 'stroop',
  timestamp: '2024-05-01T10:00:00.000Z',
  subject_id: 'P1',
  researcher_uid: 'u1',
  demographics: { data: { wiek: 30 } },
  wyniki: { poprawne: 10, sredni_czas: 350 },
});

describe('resultPackage', () => {
  it('testIdOf/subjectIdOf wspierają snake_case, camelCase i Nieznany', () => {
    expect(testIdOf({ test_id: 'a' })).toBe('a');
    expect(testIdOf({ testId: 'b' })).toBe('b');
    expect(testIdOf({})).toBe('Nieznany');
    expect(subjectIdOf({ subject_id: 's' })).toBe('s');
    expect(subjectIdOf({ wyniki: { subjectId: 'w' } })).toBe('w');
    expect(subjectIdOf({ data: { subjectId: 'd' } })).toBe('d');
    expect(subjectIdOf({})).toBe('Nieznany');
  });

  it('normalizeResult scala wyniki/data i statusy', () => {
    const n = normalizeResult({ testId: 't', data: { a: 1 }, syncStatus: 'SYNCED' });
    expect(n.test_id).toBe('t');
    expect(n.wyniki).toEqual({ a: 1 });
    expect(n.sync_status).toBe('SYNCED');
    expect(n.firestore_id).toBeNull();
  });
});

describe('resultExporter', () => {
  it('escapeCsvCell cytuje tylko przy ; i nowej linii, podwaja cudzysłowy', () => {
    expect(escapeCsvCell('abc')).toBe('abc');
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('say "hi";ok')).toBe('"say ""hi"";ok"');
    expect(escapeCsvCell(10)).toBe('10');
  });

  it('resultRow deep: kolejność i klucze jak stara historia (single)', () => {
    const row = resultRow(pkg());
    expect(Object.keys(row)).toEqual([
      'Data', 'Test ID', 'ID Badanego', 'Badacz UID',
      'Metryczka - wiek', 'Wynik - poprawne', 'Wynik - sredni_czas',
    ]);
    expect(row['Test ID']).toBe('stroop');
    expect(row['ID Badanego']).toBe('P1');
  });

  it('resultRow shallow + ignoreKeys jak stary Web (results.js)', () => {
    const row = resultRow(
      { ...pkg(), wyniki: { testId: 'x', poprawne: 5, nosie: null } },
      { includeResearcher: false, deep: false, ignoreKeys: WEB_RESULT_IGNORE_KEYS },
    );
    expect(row).not.toHaveProperty('Badacz UID');
    expect(row['Wynik - poprawne']).toBe(5);
    expect(row).not.toHaveProperty('Wynik - testId');
    expect(row).not.toHaveProperty('Wynik - nosie');
  });

  it('toKeyValueCSV bajtowo: BOM + nagłówek + wiersze', () => {
    const csv = toKeyValueCSV({ A: 'x', B: 'y;z' });
    expect(csv).toBe('﻿Parametr;Wartość\r\nA;x\r\nB;"y;z"\r\n');
  });

  it('toMatrixCSV: unia kluczy, braki jako pusty string', () => {
    const csv = toMatrixCSV([{ a: 1, b: 2 }, { b: 3, c: 'x;y' }]);
    expect(csv).toBe('﻿a;b;c\r\n1;2;\r\n;3;"x;y"\r\n');
  });
});

describe('historyQuery', () => {
  it('resolveStatusLabel: 6 gałęzi jak stara historia', () => {
    expect(resolveStatusLabel({ researcher_uid: 'LOCAL::a' })).toBe('Konto lokalne');
    expect(resolveStatusLabel({ sync_status: 'LOCAL' })).toBe('Konto lokalne');
    expect(resolveStatusLabel({ researcher_uid: 'GUEST' })).toBe('Tryb Gościa');
    expect(resolveStatusLabel({ sync_status: 'SYNCED' })).toBe('Zsynchronizowano');
    expect(resolveStatusLabel({ sync_status: 'PENDING' })).toBe('Oczekuje');
    expect(resolveStatusLabel({})).toBe('Lokalne');
    expect(resolveStatusLabel({ syncStatus: 'SYNCED' })).toBe('Zsynchronizowano');
  });

  it('dayKeyOf format day:R:M:D', () => {
    expect(dayKeyOf('2024-05-01T10:00:00.000Z').startsWith('day:2024:4:')).toBe(true);
  });

  it('matchesFilters: data/test/podmiot/status', () => {
    const r = { timestamp: '2024-05-01T10:00:00.000Z', test_id: 't', subject_id: 's', sync_status: 'SYNCED' };
    const f = emptyFilters();
    expect(hasActiveFilters(f)).toBe(false);
    expect(filterResults([r], f)).toEqual([r]);
    f.test_id.add('t');
    expect(matchesFilters(r, f)).toBe(true);
    f.test_id.add('inny');
    f.test_id.delete('t');
    expect(matchesFilters(r, f)).toBe(false);
  });

  it('paginate: wycinek + liczba stron jak Math.ceil', () => {
    const list = [1, 2, 3, 4, 5];
    expect(paginate(list, 1, 2)).toEqual({ items: [1, 2], totalPages: 3 });
    expect(paginate(list, 3, 2)).toEqual({ items: [5], totalPages: 3 });
  });
});

describe('cloudResults', () => {
  it('buildLocalKeys + isAlreadyImported jak stary render chmury', () => {
    const keys = buildLocalKeys([
      { firestore_id: 'fs1', timestamp: 't', test_id: 'a', subject_id: 's' },
    ]);
    expect(isAlreadyImported({ firestore_id: 'fs1' }, keys)).toBe(true);
    expect(isAlreadyImported({ timestamp: 't', test_id: 'a', subject_id: 's' }, keys)).toBe(true);
    expect(isAlreadyImported({ firestore_id: 'fsX', timestamp: 't', test_id: 'a', subject_id: 'X' }, keys)).toBe(false);
    expect(cloudKeyOf({ timestamp: 't', test_id: 'a', subject_id: 's' })).toBe('t_a_s');
  });

  it('cloudRecordToLocal mapuje jak stare importy', () => {
    const local = cloudRecordToLocal(
      { test_id: 't', subject_id: 's', timestamp: 'ts', demographics: { d: 1 }, data: { w: 2 }, firestore_id: 'fs' },
      'uid',
    );
    expect(local).toEqual({
      test_id: 't', subject_id: 's', timestamp: 'ts', researcher_uid: 'uid',
      demographics: { d: 1 }, wyniki: { w: 2 }, firestore_id: 'fs', sync_status: 'SYNCED',
    });
  });

  it('decryptCloudRecords: równolegle, kolejność i markery jak stare', async () => {
    const items = [
      { is_encrypted: true, iv: 'iv1', data: 'enc1' },
      { is_encrypted: true, iv: 'iv2', data: 'enc2' },
      { plain: true },
    ];
    const out = await decryptCloudRecords(items, {
      hasKey: () => true,
      decrypt: async (d) => ({ data: { dec: d }, demographics: { m: 1 } }),
    });
    expect(out[0].data).toEqual({ dec: 'enc1' });
    expect(out[0].is_encrypted).toBe(false);
    expect(out[2]).toEqual({ plain: true });

    const locked = await decryptCloudRecords([{ is_encrypted: true, iv: 'x', data: 'e' }], {
      hasKey: () => false, decrypt: vi.fn(),
    });
    expect(locked[0].data).toEqual({ score: 'Zaszyfrowane (Brak Klucza Chmury)' });
  });

  it('importPreparedList liczy zapisane, nie zabija reszty przy błędzie', async () => {
    const save = vi.fn(async (item) => {
      if (item.bad) throw new Error('nope');
      return 'id';
    });
    const n = await importPreparedList([{ a: 1 }, { bad: true }, { a: 3 }], 'u', save);
    expect(n).toBe(2);
    expect(save).toHaveBeenCalledTimes(3);
  });

  it('prepareGuestImport: move mutuje właściciela, duplicate nowe ID bez firestore', () => {
    const guests = [{ id: 'g1', firestore_id: 'fs', researcher_uid: 'GUEST' }];
    const moved = prepareGuestImport(guests, 'u', 'move');
    expect(moved[0].researcher_uid).toBe('u');
    expect(moved[0].id).toBe('g1');
    const dup = prepareGuestImport(guests, 'u', 'duplicate');
    expect(dup[0].id).not.toBe('g1');
    expect(dup[0].firestore_id).toBeUndefined();
    expect(guests[0].researcher_uid).toBe('GUEST');
  });
});
