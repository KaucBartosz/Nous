import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  csvOfResults,
  downloadResultsAsCSV,
  pageCsvItems,
  exportHistoryToCSV,
  singleResultFile,
  downloadSingleResult,
  beginDownloadButton,
  selectedDownloadFormat,
  downloadButtonPrefix,
} from '../../src/history/historyExport.js';
import { emptyFilters } from '../../src/results/historyQuery.js';

const r = (id) => ({
  test_id: 'stroop',
  timestamp: '2024-05-01T10:00:00.000Z',
  subject_id: id,
  researcher_uid: 'u1',
  wyniki: { poprawne: 10 },
});

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('historyExport CSV', () => {
  it('csvOfResults: pusto → "", inaczej macierz z BOM', () => {
    expect(csvOfResults([])).toBe('');
    const csv = csvOfResults([r('P1')]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Wynik - poprawne');
  });

  it('pageCsvItems/exportHistoryToCSV: paginacja widoku, pusta strona → false', () => {
    const all = [r('P1'), r('P2')];
    expect(pageCsvItems(all, emptyFilters(), 1, 50).length).toBe(2);
    expect(pageCsvItems(all, emptyFilters(), 2, 50).length).toBe(0);
    expect(exportHistoryToCSV({ all: [], filters: emptyFilters(), page: 1, pageSize: 50 })).toBe(false);
    expect(exportHistoryToCSV({ all, filters: emptyFilters(), page: 1, pageSize: 50 })).toBe(true);
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it('singleResultFile: csv/json jak stary downloadSingleResult', () => {
    const csv = singleResultFile({ ...r('P1'), testId: 'x' }, 'csv');
    expect(csv.filename).toMatch(/^wynik_stroop_\d+\.csv$/);
    expect(csv.mime).toContain('csv');
    expect(csv.content).toContain('Parametr;Wartość');
    const json = singleResultFile({ ...r('P1') }, 'json');
    expect(json.filename).toMatch(/\.json$/);
    expect(JSON.parse(json.content).subject_id).toBe('P1');
  });

  it('downloadSingleResult czyta radio dl-format (domyślnie json)', () => {
    downloadSingleResult(r('P1'));
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('historyExport przycisk + format', () => {
  it('selectedDownloadFormat: brak radia → json', () => {
    expect(selectedDownloadFormat()).toBe('json');
    document.body.innerHTML = '<input type="radio" name="dl-format" value="csv" checked />';
    expect(selectedDownloadFormat()).toBe('csv');
  });

  it('downloadButtonPrefix: cloud > guest > local (jak stary if)', () => {
    expect(downloadButtonPrefix({ cloudHidden: false, guestHidden: true })).toBe('cloud');
    expect(downloadButtonPrefix({ cloudHidden: true, guestHidden: false })).toBe('guest');
    expect(downloadButtonPrefix({ cloudHidden: true, guestHidden: true })).toBe('local');
    // Parzystość ze starym `!el?.classList.contains('hidden')`: brak kontenera → cloud.
    expect(downloadButtonPrefix({ cloudHidden: undefined, guestHidden: undefined })).toBe('cloud');
  });

  it('beginDownloadButton: null bez elementów; busy + restore po 1s', () => {
    expect(beginDownloadButton({ button: 'x', text: 'y', progress: 'z' }, 'Busy')).toBeNull();

    document.body.innerHTML = `
      <button id="b">Tekst</button><span id="t">Tekst</span><div id="p"></div>`;
    const dl = beginDownloadButton({ button: 'b', text: 't', progress: 'p' }, 'Pobieranie...');
    expect(dl).not.toBeNull();
    expect(document.getElementById('b').disabled).toBe(true);
    expect(document.getElementById('t').innerHTML).toContain('Pobieranie...');
    dl.progress('50%');
    expect(document.getElementById('p').style.width).toBe('50%');
    dl.restore();
    expect(document.getElementById('b').disabled).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(document.getElementById('b').disabled).toBe(false);
    expect(document.getElementById('t').innerHTML).toBe('Tekst');
  });
});

describe('downloadResultsAsCSV', () => {
  it('false bez danych (wołający pokazuje Notify), true po pobraniu', () => {
    expect(downloadResultsAsCSV([], 'x.csv')).toBe(false);
    expect(downloadResultsAsCSV([r('P1')], 'x.csv')).toBe(true);
  });
});
