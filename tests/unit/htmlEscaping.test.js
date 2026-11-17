import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Przechwytujemy spec przekazany do notify.toast, ale delegujemy do prawdziwej
// implementacji, żeby móc aserować zarówno string messageHtml, jak i realny DOM.
const { toastSpecs } = vi.hoisted(() => ({ toastSpecs: [] }));

vi.mock('../../src/notify/notify.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    toast: vi.fn((spec) => {
      toastSpecs.push(spec);
      return actual.toast(spec);
    }),
  };
});

import { openTagMenu } from '../../src/modules/tags.js';
import { initAppUpdater } from '../../src/modules/appUpdater.js';
import { setPlatform, resetPlatform } from '../../src/platform/index.js';

const PAYLOAD = '<img src=x onerror=alert(1)>';

describe('escaping parametrów i18n trafiających do HTML sinków', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    toastSpecs.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetPlatform();
  });

  it('menu tagów: markup w testName staje się tekstem, nie elementem <img>', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    openTagMenu('t-escaping-test', PAYLOAD, anchor, () => {});

    const header = document.querySelector('.tag-menu-header');
    expect(header).not.toBeNull();
    expect(header.querySelector('img')).toBeNull();
    expect(header.textContent).toContain(PAYLOAD);
  });

  it('toast aktualizatora: markup w version nie tworzy elementu <img>', () => {
    const handlers = {};
    const fakePlatform = {
      kind: 'electron',
      isMac: false,
      links: { openExternal: vi.fn() },
      updates: {
        getVersion: vi.fn(() => Promise.resolve('1.0.0')),
        check: vi.fn(),
        download: vi.fn(),
        install: vi.fn(),
        onChecking: vi.fn((fn) => { handlers.checking = fn; }),
        onAvailable: vi.fn((fn) => { handlers.available = fn; }),
        onNotAvailable: vi.fn((fn) => { handlers.notAvailable = fn; }),
        onError: vi.fn((fn) => { handlers.error = fn; }),
        onDownloadProgress: vi.fn((fn) => { handlers.progress = fn; }),
        onDownloaded: vi.fn((fn) => { handlers.downloaded = fn; }),
      },
    };
    setPlatform(fakePlatform);

    initAppUpdater();
    // showUpdateToast nie jest eksportowany — wołamy przez publiczny wpis initAppUpdater.
    handlers.available({ version: PAYLOAD });

    expect(toastSpecs).toHaveLength(1);
    expect(toastSpecs[0].messageHtml).not.toContain('<img');
    expect(toastSpecs[0].messageHtml).toContain('&lt;img');

    const toastEl = document.getElementById('update-toast');
    expect(toastEl).not.toBeNull();
    expect(toastEl.querySelector('img')).toBeNull();
    expect(toastEl.querySelector('.toast-message').textContent).toContain(PAYLOAD);
  });
});
