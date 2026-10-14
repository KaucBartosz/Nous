import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  countBy,
  buildFilterValues,
  updateFilterBadges,
  updateClearFiltersBar,
  createFilterUi,
} from '../../src/history/historyFilters.js';
import { emptyHistoryFilters } from '../../src/history/historyState.js';

const r = (id, test, subject, ts) => ({
  id, test_id: test, subject_id: subject, timestamp: ts, researcher_uid: 'u1',
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('countBy/buildFilterValues', () => {
  it('countBy grupuje i sortuje po polsku', () => {
    expect(countBy([{ v: 'b' }, { v: 'a' }, { v: 'b' }], (x) => x.v))
      .toEqual([['a', 1], ['b', 2]]);
  });

  it('buildFilterValues: drzewo dat + typy płaskie + nieznany → []', () => {
    const all = [
      r('1', 'stroop', 'P1', '2024-05-01T10:00:00.000Z'),
      r('2', 'stroop', 'P2', '2024-05-01T12:00:00.000Z'),
      r('3', 'bystre', 'P1', '2023-01-15T10:00:00.000Z'),
    ];
    const tree = buildFilterValues(all, 'date');
    expect(tree[2024][4].days[1].count).toBe(2);
    expect(buildFilterValues(all, 'test_id')).toEqual([['bystre', 1], ['stroop', 2]]);
    expect(buildFilterValues(all, 'subject_id')).toEqual([['P1', 2], ['P2', 1]]);
    expect(buildFilterValues(all, 'status').length).toBeGreaterThan(0);
    expect(buildFilterValues(all, 'nie-ma')).toEqual([]);
  });
});

describe('updateFilterBadges', () => {
  it('liczy per kolumna, chowa puste, zapala aktywne', () => {
    document.body.innerHTML = `
      <table><tr>
        <th class="filterable-header" data-filter-column="date">
          <span>D</span><button class="filter-btn"></button><span class="filter-badge hidden"></span>
        </th>
        <th class="filterable-header" data-filter-column="test">
          <span>T</span><button class="filter-btn"></button><span class="filter-badge hidden"></span>
        </th>
      </tr></table>
      <div id="active-filters-bar" class="hidden"></div>`;
    const filters = emptyHistoryFilters();
    filters.test_id.add('stroop');
    filters.test_id.add('bystre');
    updateFilterBadges(filters);

    const badges = document.querySelectorAll('.filter-badge');
    expect(badges[0].textContent).toBe('0');
    expect(badges[0].classList.contains('hidden')).toBe(true);
    expect(badges[1].textContent).toBe('2');
    expect(badges[1].classList.contains('hidden')).toBe(false);
    expect(document.getElementById('active-filters-bar').classList.contains('hidden')).toBe(false);
  });

  it('updateClearFiltersBar chowa pasek bez filtrów', () => {
    document.body.innerHTML = '<div id="active-filters-bar"></div>';
    updateClearFiltersBar(emptyHistoryFilters());
    expect(document.getElementById('active-filters-bar').classList.contains('hidden')).toBe(true);
  });
});

describe('createFilterUi', () => {
  const mountBtn = (type, label) => {
    document.body.innerHTML = `
      <table><tr><th><span>${label}</span><button class="filter-btn" data-filter-type="${type}"></button></th></tr></table>`;
    return document.querySelector('.filter-btn');
  };

  it('openFor: opcje płaskie, toggle mutuje filtry i woła apply', () => {
    const btn = mountBtn('test_id', 'Test');
    const filters = emptyHistoryFilters();
    const applyFilters = vi.fn();
    const ui = createFilterUi({
      getResults: () => [r('1', 'stroop', 'P1', '2024-05-01T10:00:00.000Z')],
      getFilters: () => filters,
      applyFilters,
    });
    ui.openFor('test_id', btn);
    const dropdown = document.querySelector('.filter-dropdown');
    expect(dropdown).not.toBeNull();
    expect(dropdown.textContent).toContain('stroop');

    const cb = dropdown.querySelector('.filter-option input[type="checkbox"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(filters.test_id.has('stroop')).toBe(true);
    expect(applyFilters).toHaveBeenCalledTimes(1);
    ui.close();
    expect(document.querySelector('.filter-dropdown')).toBeNull();
  });

  it('select-all / deselect-all wołają apply bez mutacji zestawu', () => {
    const btn = mountBtn('status', 'Status');
    const filters = emptyHistoryFilters();
    const applyFilters = vi.fn();
    const ui = createFilterUi({
      getResults: () => [r('1', 'stroop', 'P1', '2024-05-01T10:00:00.000Z')],
      getFilters: () => filters,
      applyFilters,
    });
    ui.openFor('status', btn);
    document.querySelector('.filter-select-all').click();
    expect(applyFilters).toHaveBeenCalledTimes(1);
    document.querySelector('.filter-deselect-all').click();
    expect(applyFilters).toHaveBeenCalledTimes(2);
    ui.close();
  });

  it('daty: toggle dnia dodaje klucz day:Y:M:D', () => {
    const btn = mountBtn('date', 'Data');
    const filters = emptyHistoryFilters();
    const applyFilters = vi.fn();
    const ui = createFilterUi({
      getResults: () => [r('1', 'stroop', 'P1', '2024-05-01T10:00:00.000Z')],
      getFilters: () => filters,
      applyFilters,
    });
    ui.openFor('date', btn);
    const dayCb = document.querySelector('.filter-date-day input[type="checkbox"]');
    expect(dayCb.value).toBe('day:2024:4:1');
    dayCb.checked = true;
    dayCb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(filters.date.has('day:2024:4:1')).toBe(true);
    expect(applyFilters).toHaveBeenCalled();
    ui.close();
  });

  it('bind: klik przycisku otwiera, drugi zamyka; clear woła onClear', () => {
    // Cały DOM najpierw (innerHTML += odtwarza węzły — referencje po nim).
    document.body.innerHTML = `
      <table><tr><th><span>Test</span><button class="filter-btn" data-filter-type="test_id"></button></th></tr></table>
      <button id="btn-clear-all-filters">Wyczyść</button>`;
    const btn = document.querySelector('.filter-btn');
    const onClear = vi.fn();
    const ui = createFilterUi({
      getResults: () => [],
      getFilters: emptyHistoryFilters,
      applyFilters: vi.fn(),
    });
    ui.bind({ onClear });
    btn.click();
    expect(document.querySelector('.filter-dropdown')).not.toBeNull();
    btn.click();
    expect(document.querySelector('.filter-dropdown')).toBeNull();
    document.getElementById('btn-clear-all-filters').click();
    expect(onClear).toHaveBeenCalled();
  });
});
