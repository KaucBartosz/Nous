import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sortByInstallStatus,
  escapeHtml,
  debounce,
  getLocalVersionsCached,
  invalidateLocalVersionsCache,
  flattenObject,
  updateUpdatesBadge
} from '../../src/modules/utils.js';

// ==========================================================
// sortByInstallStatus Tests
// ==========================================================
describe('sortByInstallStatus', () => {
  it('sorts tests needing update first', () => {
    const tests = [
      { id: 1, name: 'Test A', local_ver: 1, remote_ver: 2 }, // needs update
      { id: 2, name: 'Test B', local_ver: 2, remote_ver: 2 }, // installed, current
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].id).toBe(1); // needs update should be first
    expect(result[1].id).toBe(2);
  });

  it('sorts installed tests before not-installed tests', () => {
    const tests = [
      { id: 1, name: 'Test A', local_ver: 0, remote_ver: 1 }, // not installed
      { id: 2, name: 'Test B', local_ver: 1, remote_ver: 1 }, // installed
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].id).toBe(2); // installed should be first
    expect(result[1].id).toBe(1);
  });

  it('sorts tests needing update before installed tests', () => {
    const tests = [
      { id: 1, name: 'Test A', local_ver: 1, remote_ver: 1 }, // installed, current
      { id: 2, name: 'Test B', local_ver: 1, remote_ver: 2 }, // needs update
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].id).toBe(2); // needs update first
    expect(result[1].id).toBe(1);
  });

  it('sorts alphabetically within same status group', () => {
    const tests = [
      { id: 1, name: 'Zebra Test', local_ver: 0, remote_ver: 1 },
      { id: 2, name: 'Alpha Test', local_ver: 0, remote_ver: 1 },
      { id: 3, name: 'Beta Test', local_ver: 0, remote_ver: 1 },
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].name).toBe('Alpha Test');
    expect(result[1].name).toBe('Beta Test');
    expect(result[2].name).toBe('Zebra Test');
  });

  it('handles empty array', () => {
    const result = sortByInstallStatus([]);
    expect(result).toEqual([]);
  });

  it('handles tests without local_ver (defaults to 0)', () => {
    const tests = [
      { id: 1, name: 'Test A', remote_ver: 1 }, // no local_ver
      { id: 2, name: 'Test B', local_ver: 1, remote_ver: 1 },
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].id).toBe(2); // installed first
    expect(result[1].id).toBe(1); // not installed
  });

  it('handles tests without name', () => {
    const tests = [
      { id: 1, local_ver: 0, remote_ver: 1 }, // no name
      { id: 2, name: 'Test B', local_ver: 0, remote_ver: 1 },
    ];

    // Should not throw
    const result = sortByInstallStatus([...tests]);
    expect(result).toHaveLength(2);
  });

  it('prioritizes: needs-update > installed > not-installed', () => {
    const tests = [
      { id: 'not-installed', name: 'C', local_ver: 0, remote_ver: 1 },
      { id: 'needs-update', name: 'B', local_ver: 1, remote_ver: 3 },
      { id: 'installed', name: 'A', local_ver: 2, remote_ver: 2 },
    ];

    const result = sortByInstallStatus([...tests]);

    expect(result[0].id).toBe('needs-update');
    expect(result[1].id).toBe('installed');
    expect(result[2].id).toBe('not-installed');
  });
});

// ==========================================================
// escapeHtml Tests
// ==========================================================
describe('escapeHtml', () => {
  it('escapes < and > characters', () => {
    expect(escapeHtml('<script>')).toBe('\x26lt;script\x26gt;');
  });

  it('escapes > character', () => {
    expect(escapeHtml('test>value')).toBe('test\x26gt;value');
  });

  it('escapes & character', () => {
    expect(escapeHtml('foo & bar')).toBe('foo \x26amp; bar');
  });

  it('does not escape " character (textContent behavior)', () => {
    // textContent does not escape double quotes
    expect(escapeHtml('say "hello"')).toBe('say "hello"');
  });

  it('does not escape \' character (textContent behavior)', () => {
    // textContent does not escape single quotes
    expect(escapeHtml("it's")).toBe("it's");
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('handles normal text without changes', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });

  it('handles numbers', () => {
    expect(escapeHtml(123)).toBe('123');
  });

  it('escapes all special characters in one string', () => {
    const input = '<div class="test">A & B</div>';
    // textContent escapes <, >, & but not quotes
    const expected = '\x26lt;div class="test"\x26gt;A \x26amp; B\x26lt;/div\x26gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('prevents XSS injection', () => {
    const malicious = '<script>alert("XSS")</script>';
    const result = escapeHtml(malicious);
    expect(result).not.toContain('<script>');
    // textContent escapes <, >, & but not quotes
    expect(result).toBe('\x26lt;script\x26gt;alert("XSS")\x26lt;/script\x26gt;');
  });
});

// ==========================================================
// debounce Tests
// ==========================================================
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only executes once after multiple rapid calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments correctly', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn('arg1', 'arg2', 3);

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 3);
  });

  it('uses last call arguments', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');

    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith('third');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent call', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn();
    vi.advanceTimersByTime(100); // 100ms passed
    debouncedFn(); // Reset timer

    vi.advanceTimersByTime(100); // Only 100ms from second call
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100); // Now 200ms from second call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses default delay of 200ms', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn); // No delay specified

    debouncedFn();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can execute multiple times if calls are spaced out', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 200);

    debouncedFn('first');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    debouncedFn('second');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ==========================================================
// getLocalVersionsCached Tests
// ==========================================================
describe('getLocalVersionsCached', () => {
  beforeEach(() => {
    invalidateLocalVersionsCache();
    vi.useFakeTimers();
    // Reset mock before each test
    window.electronAPI.getLocalVersions.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns cached data if TTL not expired', async () => {
    const mockVersions = { test1: { version: 1 }, test2: { version: 2 } };
    window.electronAPI.getLocalVersions.mockResolvedValue(mockVersions);

    // First call - fetches from API
    const result1 = await getLocalVersionsCached();
    expect(result1).toEqual(mockVersions);

    // Second call - returns cached data
    const result2 = await getLocalVersionsCached();
    expect(result2).toEqual(mockVersions);
    expect(window.electronAPI.getLocalVersions).toHaveBeenCalledTimes(1);
  });

  it('fetches fresh data if cache expired (TTL)', async () => {
    const mockVersions1 = { test1: { version: 1 } };
    const mockVersions2 = { test1: { version: 2 } };
    
    window.electronAPI.getLocalVersions
      .mockResolvedValueOnce(mockVersions1)
      .mockResolvedValueOnce(mockVersions2);

    // First call
    const result1 = await getLocalVersionsCached();
    expect(result1).toEqual(mockVersions1);

    // Advance time past TTL (5 seconds + 1ms)
    vi.advanceTimersByTime(5001);

    // Second call - should fetch fresh data
    const result2 = await getLocalVersionsCached();
    expect(result2).toEqual(mockVersions2);
    expect(window.electronAPI.getLocalVersions).toHaveBeenCalledTimes(2);
  });

  it('returns cached data on error', async () => {
    const mockVersions = { test1: { version: 1 } };
    window.electronAPI.getLocalVersions
      .mockResolvedValueOnce(mockVersions)
      .mockRejectedValueOnce(new Error('Network error'));

    // First call - successful
    await getLocalVersionsCached();

    // Advance time past TTL
    vi.advanceTimersByTime(5001);

    // Second call - error, should return cached data
    const result = await getLocalVersionsCached();
    expect(result).toEqual(mockVersions);
  });

  it('returns empty object when no electronAPI', async () => {
    const originalAPI = window.electronAPI;
    window.electronAPI = undefined;

    const result = await getLocalVersionsCached();
    expect(result).toEqual({});

    window.electronAPI = originalAPI;
  });

  it('returns empty object on first call error with no cache', async () => {
    window.electronAPI.getLocalVersions.mockRejectedValueOnce(new Error('API Error'));

    const result = await getLocalVersionsCached();
    expect(result).toEqual({});
  });
});

// ==========================================================
// invalidateLocalVersionsCache Tests
// ==========================================================
describe('invalidateLocalVersionsCache', () => {
  beforeEach(() => {
    invalidateLocalVersionsCache();
    vi.useFakeTimers();
    // Reset mock before each test
    window.electronAPI.getLocalVersions.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invalidates cache forcing fresh fetch', async () => {
    const mockVersions1 = { test1: { version: 1 } };
    const mockVersions2 = { test2: { version: 2 } };

    window.electronAPI.getLocalVersions
      .mockResolvedValueOnce(mockVersions1)
      .mockResolvedValueOnce(mockVersions2);

    // First call
    const result1 = await getLocalVersionsCached();
    expect(result1).toEqual(mockVersions1);

    // Invalidate cache
    invalidateLocalVersionsCache();

    // Should fetch fresh data even without TTL expiry
    const result2 = await getLocalVersionsCached();
    expect(result2).toEqual(mockVersions2);
    expect(window.electronAPI.getLocalVersions).toHaveBeenCalledTimes(2);
  });

  it('resets cache to null', async () => {
    window.electronAPI.getLocalVersions
      .mockResolvedValueOnce({ test: { version: 1 } })
      .mockResolvedValueOnce({ test: { version: 2 } });

    await getLocalVersionsCached();
    invalidateLocalVersionsCache();

    // After invalidation, should fetch again
    await getLocalVersionsCached();
    expect(window.electronAPI.getLocalVersions).toHaveBeenCalledTimes(2);
  });
});

// ==========================================================
// flattenObject Tests
// ==========================================================
describe('flattenObject', () => {
  it('flattens deeply nested objects with dash separators', () => {
    const obj = { ObjectA: 1, LevelB: { ItemC: 2, InnerD: { ValueE: 3 } } };
    const target = {};
    flattenObject(obj, target, 'Prefix');
    expect(target).toEqual({ 
      'Prefix - ObjectA': 1, 
      'Prefix - LevelB - ItemC': 2, 
      'Prefix - LevelB - InnerD - ValueE': 3 
    });
  });

  it('handles empty objects', () => {
    const target = {};
    flattenObject({}, target, 'Pref');
    expect(target).toEqual({});
  });

  it('keeps flat objects and formats keys properly', () => {
    const obj = { A: 1, B: 2 };
    const target = {};
    flattenObject(obj, target, '');
    expect(target).toEqual({ ' - A': 1, ' - B': 2 });
  });

  it('stringifies arrays as JSON', () => {
    const obj = { Arr: [1, 2, 3] };
    const target = {};
    flattenObject(obj, target, 'Pref');
    expect(target).toEqual({ 'Pref - Arr': '[1,2,3]' });
  });
});

// ==========================================================
// updateUpdatesBadge Tests
// ==========================================================
describe('updateUpdatesBadge', () => {
  beforeEach(() => {
    document.body.innerHTML = '<span id="updates-badge" class="nav-badge hidden">0</span>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows badge when count > 0', () => {
    updateUpdatesBadge(5);
    const badge = document.getElementById('updates-badge');
    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('hidden')).toBe(false);
  });

  it('hides badge when count === 0', () => {
    updateUpdatesBadge(0);
    const badge = document.getElementById('updates-badge');
    expect(badge.textContent).toBe('0');
    expect(badge.classList.contains('hidden')).toBe(true);
  });

  it('does not throw when badge is missing', () => {
    document.body.innerHTML = '';
    expect(() => updateUpdatesBadge(5)).not.toThrow();
  });
});