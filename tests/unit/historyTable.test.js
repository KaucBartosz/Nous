import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreTextOf,
  patientIdOf,
  emptyMessage,
  downloadButtonLabel,
  refreshDownloadButtons,
  renderHistoryRows,
  renderPagination,
} from '../../src/history/historyTable.js';

const r = (over = {}) => ({
  id: 'r1', test_id: 'stroop', timestamp: '2024-05-01T10:00:00.000Z',
  subject_id: 'P1', researcher_uid: 'u1', sync_status: 'SYNCED',
  wyniki: { score: 10 }, ...over,
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('czyste reguły tabeli', () => {
  it('scoreTextOf: czas_reakcji → score → JSON (wyniki wygrywają z data)', () => {
    expect(scoreTextOf(r({ wyniki: { czas_reakcji: 350 } }))).toBe('350 ms');
    expect(scoreTextOf(r({ wyniki: { score: 7 } }))).toBe(7);
    expect(scoreTextOf(r({ wyniki: {} }))).toBe('JSON');
    expect(scoreTextOf(r({ wyniki: null, data: { score: 9 } }))).toBe(9);
  });

  it('patientIdOf: 4 źródła jak stary wiersz', () => {
    expect(patientIdOf(r())).toBe('P1');
    expect(patientIdOf({ wyniki: { subjectId: 'W' } })).toBe('W');
    expect(patientIdOf({ data: { subjectId: 'D' } })).toBe('D');
    expect(patientIdOf({})).toBe('-');
  });

  it('emptyMessage: filtry wygrywają z gościem', () => {
    expect(emptyMessage({ guestView: false, hasFilters: false })).toBe('Brak wyników.');
    expect(emptyMessage({ guestView: true, hasFilters: false })).toBe('Brak wyników w trybie Gościa.');
    expect(emptyMessage({ guestView: true, hasFilters: true }))
      .toBe('Brak wyników pasujących do aktywnych filtrów.');
  });

  it('downloadButtonLabel: warianty local/guest/cloud jak stare', () => {
    const sel = (o) => ({ count: 0, hasFilters: false, filteredCount: 0, ...o });
    expect(downloadButtonLabel('local', sel({ count: 2 }))).toContain('zaznaczone (2)');
    expect(downloadButtonLabel('local', sel({}))).toContain('wszystkie wyniki');
    expect(downloadButtonLabel('guest', sel({}))).toContain('Pobierz wszystkie');
    expect(downloadButtonLabel('cloud', sel({}))).toContain('Pobierz wszystkie');
    expect(downloadButtonLabel('local', sel({ hasFilters: true, filteredCount: 5 })))
      .toContain('przefiltrowane (5)');
    expect(downloadButtonLabel('cloud', sel({ hasFilters: true, filteredCount: 5 })))
      .toContain('Pobierz wszystkie');
  });
});

describe('refreshDownloadButtons', () => {
  it('teksty + widoczność koszy wg selekcji i widoku', () => {
    document.body.innerHTML = `
      <span id="btn-local-download-text"></span>
      <button id="btn-local-delete-selected" class="hidden"></button>
      <button id="btn-guest-delete-selected" class="hidden"></button>`;
    refreshDownloadButtons({ count: 3, hasFilters: false, filteredCount: 0, guestView: false, cloudView: false });
    expect(document.getElementById('btn-local-download-text').innerHTML).toContain('zaznaczone (3)');
    expect(document.getElementById('btn-local-delete-selected').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('btn-guest-delete-selected').classList.contains('hidden')).toBe(true);

    refreshDownloadButtons({ count: 0, hasFilters: false, filteredCount: 0, guestView: true, cloudView: false });
    expect(document.getElementById('btn-local-delete-selected').classList.contains('hidden')).toBe(true);
  });
});

describe('renderHistoryRows', () => {
  const ctx = (over = {}) => ({
    selectedIds: new Set(),
    claim: null,
    canUpload: false,
    onCheck: vi.fn(),
    syncRecord: vi.fn(async () => {}),
    onSyncError: vi.fn(async () => {}),
    onDownload: vi.fn(),
    ...over,
  });

  it('wiersz: checkbox, data, test, pacjent, wynik, status, pobieranie', () => {
    const tbody = document.createElement('tbody');
    renderHistoryRows(tbody, [r()], ctx());
    const tds = tbody.querySelector('tr').querySelectorAll('td');
    expect(tds.length).toBe(7);
    expect(tds[1].textContent).toContain('2024');
    expect(tds[2].textContent).toBe('stroop');
    expect(tds[3].textContent).toBe('P1');
    expect(tds[4].textContent).toBe('10');
    expect(tds[5].textContent).toBe('cloud_done');
    tbody.querySelector('.btn-download-result').click();
  });

  it('claim mode: przycisk Przejmij woła onClaim', async () => {
    const onClaim = vi.fn();
    const tbody = document.createElement('tbody');
    renderHistoryRows(tbody, [r()], ctx({
      claim: { userUid: 'u9', onClaim },
    }));
    tbody.querySelector('button.btn.small.primary').click();
    await Promise.resolve();
    expect(onClaim).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'u9');
  });

  it('PENDING + canUpload: klik sync → animacja + syncRecord; błąd → onSyncError', async () => {
    const syncRecord = vi.fn(async () => {});
    const onSyncError = vi.fn(async () => {});
    const tbody = document.createElement('tbody');
    renderHistoryRows(tbody, [r({ sync_status: 'PENDING' })], ctx({ canUpload: true, syncRecord, onSyncError }));
    const icon = tbody.querySelector('td span.material-icons');
    expect(icon.textContent).toBe('cloud_upload');
    icon.click();
    await new Promise((res) => setTimeout(res, 0));
    expect(syncRecord).toHaveBeenCalled();
    expect(onSyncError).not.toHaveBeenCalled();

    const syncRecordFail = vi.fn(async () => { throw new Error('nope'); });
    const tbody2 = document.createElement('tbody');
    renderHistoryRows(tbody2, [r({ sync_status: 'PENDING' })], ctx({ canUpload: true, syncRecord: syncRecordFail, onSyncError }));
    tbody2.querySelector('td span.material-icons').click();
    await new Promise((res) => setTimeout(res, 0));
    expect(onSyncError).toHaveBeenCalled();
    expect(tbody2.querySelector('td span.material-icons').textContent).toBe('error');
  });

  it('checkbox: zaznaczony ze stanu + change → onCheck', () => {
    const onCheck = vi.fn();
    const tbody = document.createElement('tbody');
    renderHistoryRows(tbody, [r()], ctx({ selectedIds: new Set(['r1']), onCheck }));
    const cb = tbody.querySelector('.result-checkbox');
    expect(cb.checked).toBe(true);
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onCheck).toHaveBeenCalled();
  });
});

describe('renderPagination', () => {
  it('tworzy kontrolki, nawigacja przez onPage, 1 strona → ukryte', () => {
    document.body.innerHTML = '<div id="history-view"><div class="table-container"></div></div>';
    const onPage = vi.fn();
    expect(renderPagination({ page: 1, totalPages: 3, totalItems: 120, onPage })).toBe(true);
    const c = document.getElementById('history-pagination');
    expect(c.textContent).toContain('Strona 1 z 3 (120 wyników)');
    c.querySelectorAll('button')[1].click();
    expect(onPage).toHaveBeenCalledWith(2);

    expect(renderPagination({ page: 1, totalPages: 1, totalItems: 5, onPage })).toBe(false);
    expect(c.style.display).toBe('none');
  });
});
