import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sortRows,
  bindSortableHeaders,
  syncSortIndicators,
} from '../../src/modules/tableSort.js';

describe('sortRows', () => {
  const rows = [
    { name: 'b', version: 2 },
    { name: 'a', version: 10 },
    { name: 'c', version: 1 },
  ];

  it('sortuje liczby numerycznie w obie strony', () => {
    expect(sortRows(rows, 'version', 'asc', (r, k) => r[k]).map((r) => r.version))
      .toEqual([1, 2, 10]);
    expect(sortRows(rows, 'version', 'desc', (r, k) => r[k]).map((r) => r.version))
      .toEqual([10, 2, 1]);
  });

  it('sortuje tekst i nie mutuje tablicy wejściowej', () => {
    expect(sortRows(rows, 'name', 'asc', (r, k) => r[k]).map((r) => r.name))
      .toEqual(['a', 'b', 'c']);
    expect(rows[0].name).toBe('b');
  });
});

describe('bindSortableHeaders', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <table><thead><tr>
        <th data-sort="name">Nazwa</th>
        <th data-sort="date"><button class="filter-btn">F</button></th>
      </tr></thead></table>`;
  });

  it('klik nagłówka przełącza kierunek i woła onChange', () => {
    const onChange = vi.fn();
    bindSortableHeaders(document, () => ({ key: 'name', dir: 'asc' }), onChange);
    const th = document.querySelector('th[data-sort="name"]');

    th.click();
    expect(onChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('klik przycisku filtra wewnątrz th nie sortuje', () => {
    const onChange = vi.fn();
    bindSortableHeaders(document, () => ({ key: 'name', dir: 'asc' }), onChange);
    document.querySelector('.filter-btn').click();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('syncSortIndicators ustawia aria-sort tylko na aktywnym nagłówku', () => {
    const table = document.querySelector('table');
    bindSortableHeaders(table, () => ({ key: 'name', dir: 'asc' }), vi.fn());
    syncSortIndicators(table, { key: 'name', dir: 'asc' });

    const name = document.querySelector('th[data-sort="name"]');
    const date = document.querySelector('th[data-sort="date"]');
    expect(name.getAttribute('aria-sort')).toBe('ascending');
    expect(name.dataset.sortDir).toBe('asc');
    expect(date.getAttribute('aria-sort')).toBe('none');
  });
});
