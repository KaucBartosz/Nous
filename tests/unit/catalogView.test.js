import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bindSearchInput,
  resetSearchBindings,
  bindCatalogProgress,
  updateStatusLabel,
  buildUpdateStatusCell,
  buildUpdateActionCell,
} from '../../src/catalog/catalogView.js';

describe('catalogView.bindSearchInput', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetSearchBindings();
    vi.useFakeTimers();
  });

  it('wiąże raz (debounce), drugie wołanie to no-op', async () => {
    document.body.innerHTML = '<input id="s1" />';
    const onSearch = vi.fn();
    expect(bindSearchInput('s1', onSearch)).toBe(true);
    expect(bindSearchInput('s1', onSearch)).toBe(false);

    document.getElementById('s1').value = 'abc';
    document.getElementById('s1').dispatchEvent(new Event('input', { bubbles: true }));
    expect(onSearch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(onSearch).toHaveBeenCalledWith('abc');
  });

  it('false gdy brak elementu (wołający ponowi przy następnej inicjalizacji)', () => {
    expect(bindSearchInput('nie-ma', vi.fn())).toBe(false);
  });
});

describe('catalogView.bindCatalogProgress', () => {
  it('postęp ląduje na przycisku o prefiksie, instalacja woła callback', () => {
    document.body.innerHTML = '<button id="force-update-t1"></button>';
    const handlers = {};
    const platform = {
      tests: {
        onProgress: (cb) => { handlers.progress = cb; },
        onInstalled: (cb) => { handlers.installed = cb; },
      },
    };
    const onInstalled = vi.fn();
    bindCatalogProgress(platform, { progressIdPrefix: 'force-update-', onInstalled });

    handlers.progress({ test_id: 't1', percent: 42 });
    expect(document.getElementById('force-update-t1').querySelector('.progress-text').textContent).toBe('42%');
    handlers.installed({ id: 't1' });
    expect(onInstalled).toHaveBeenCalledWith({ id: 't1' });
  });
});

describe('catalogView status + akcje aktualizacji', () => {
  it('etykiety jak stary widok updates', () => {
    expect(updateStatusLabel({ local_ver: 0, remote_ver: 2 }).text).toBe('Nie zainstalowano');
    expect(updateStatusLabel({ local_ver: 1, remote_ver: 2 }).text).toBe('Aktualizacja! (v1 → v2)');
    expect(updateStatusLabel({ local_ver: 2, remote_ver: 2 }).text).toBe('Aktualne');
    expect(buildUpdateStatusCell({ local_ver: 1, remote_ver: 2 }).textContent)
      .toBe('Aktualizacja! (v1 → v2)');
  });

  it('missing → sam [Pobierz#force-update-id]', () => {
    const onDownload = vi.fn();
    const cell = buildUpdateActionCell(
      { id: 'a', local_ver: 0, remote_ver: 2 },
      { onDownload, onDelete: vi.fn() },
    );
    expect(cell.querySelector('#force-update-a')).not.toBeNull();
    expect(cell.querySelector('#delete-test-a')).toBeNull();
    cell.querySelector('#force-update-a').click();
    expect(onDownload).toHaveBeenCalledWith({ id: 'a', local_ver: 0, remote_ver: 2 });
  });

  it('outdated → [Aktualizuj] + [Usuń]', () => {
    const onDownload = vi.fn();
    const onDelete = vi.fn();
    const cell = buildUpdateActionCell(
      { id: 'b', local_ver: 1, remote_ver: 2, download_url: 'u' },
      { onDownload, onDelete },
    );
    cell.querySelector('#force-update-b').click();
    expect(onDownload).toHaveBeenCalled();
    cell.querySelector('#delete-test-b').click();
    expect(onDelete).toHaveBeenCalledWith('b');
  });

  it('uptodate → [Aktualne disabled] + [Usuń]', () => {
    const cell = buildUpdateActionCell(
      { id: 'c', local_ver: 2, remote_ver: 2 },
      { onDownload: vi.fn(), onDelete: vi.fn() },
    );
    expect(cell.querySelector('#force-update-c')).toBeNull();
    const disabled = cell.querySelector('button[disabled]');
    expect(disabled.textContent).toBe('Aktualne');
    expect(cell.querySelector('#delete-test-c')).not.toBeNull();
  });
});
