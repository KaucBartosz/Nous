import { describe, it, expect } from 'vitest';
import {
  DOWNLOAD_PREFS_KEY,
  defaultDownloadPrefs,
  loadDownloadPrefs,
  saveDownloadPrefs,
  resolveDownloadDir,
  isSilentDownload,
} from '../../src/platform/downloadPrefs.js';

const memStore = () => {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    _data: data,
  };
};

describe('downloadPrefs', () => {
  it('domyślnie: dialog, brak folderu', () => {
    expect(defaultDownloadPrefs()).toEqual({ silent: false, dir: null });
    expect(loadDownloadPrefs(memStore())).toEqual({ silent: false, dir: null });
  });

  it('load: śmieci i obce kształty → domyślne', () => {
    const s = memStore();
    s.setItem(DOWNLOAD_PREFS_KEY, 'nie-json{{{');
    expect(loadDownloadPrefs(s)).toEqual({ silent: false, dir: null });
    s.setItem(DOWNLOAD_PREFS_KEY, JSON.stringify({ silent: 'tak', dir: 42 }));
    expect(loadDownloadPrefs(s)).toEqual({ silent: false, dir: null });
    s.setItem(DOWNLOAD_PREFS_KEY, JSON.stringify({ silent: true, dir: '  ' }));
    expect(loadDownloadPrefs(s)).toEqual({ silent: true, dir: null });
  });

  it('save/load round-trip', () => {
    const s = memStore();
    expect(saveDownloadPrefs({ silent: true, dir: 'D:/Pobrane' }, s)).toBe(true);
    expect(loadDownloadPrefs(s)).toEqual({ silent: true, dir: 'D:/Pobrane' });
  });

  it('resolveDownloadDir: wybrany wygrywa, inaczej domyślny', () => {
    expect(resolveDownloadDir({ silent: true, dir: 'D:/X' }, 'C:/Dl')).toBe('D:/X');
    expect(resolveDownloadDir({ silent: true, dir: null }, 'C:/Dl')).toBe('C:/Dl');
    expect(resolveDownloadDir(null, 'C:/Dl')).toBe('C:/Dl');
  });

  it('isSilentDownload tylko na electron', () => {
    expect(isSilentDownload({ silent: true, dir: null }, 'electron')).toBe(true);
    expect(isSilentDownload({ silent: true, dir: null }, 'web')).toBe(false);
    expect(isSilentDownload({ silent: false, dir: null }, 'electron')).toBe(false);
    expect(isSilentDownload(null, 'electron')).toBe(false);
  });
});
