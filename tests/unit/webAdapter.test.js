import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

// WebAdapter to zwykły skrypt (nie moduł) — nie da się go zaimportować.
// Wykonujemy jego treść w kontrolowanym sandboxie z minimalnymi fejkami DOM.
// vitest działa z katalogu głównego projektu.
const SRC = readFileSync(resolve(process.cwd(), 'web/web-adapter.js'), 'utf8');

function runAdapter({ withOpener = false, language = 'pl-PL' } = {}) {
  const createdAnchors = [];
  const errorCalls = [];
  const postMessages = [];

  const document = {
    createElement: vi.fn(() => {
      const a = { href: '', download: '', click: vi.fn() };
      createdAnchors.push(a);
      return a;
    }),
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };

  const window = { location: { origin: 'https://example.test' }, close: vi.fn() };
  if (withOpener) {
    window.opener = {
      closed: false,
      postMessage: vi.fn((...args) => postMessages.push(args)),
    };
  }
  // Bez opener i bez electronTest/electronAPI — ścieżka awaryjna.

  const localStorage = { getItem: vi.fn(() => null) };
  const navigator = { language };
  const fakeUrl = 'blob:fake-csv-url';
  const URL = {
    createObjectURL: vi.fn(() => fakeUrl),
    revokeObjectURL: vi.fn(),
  };
  class Blob {
    constructor(parts, opts) {
      this.parts = parts;
      this.opts = opts;
    }
  }
  const setTimeoutFn = vi.fn(() => 0);
  const consoleMock = {
    log: vi.fn(),
    error: vi.fn((...args) => errorCalls.push(args)),
  };

  const sandbox = {
    window,
    document,
    localStorage,
    navigator,
    Blob,
    URL,
    setTimeout: setTimeoutFn,
    console: consoleMock,
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return { window, createdAnchors, errorCalls, postMessages };
}

describe('WebAdapter.sendResults', () => {
  it('bez opener zapisuje CSV lokalnie: click() i nazwa Wynik_<id>_<czas>.csv', () => {
    const ctx = runAdapter({ withOpener: false, language: 'pl-PL' });
    expect(typeof ctx.window.electronTest.sendResults).toBe('function');

    ctx.window.electronTest.sendResults({ testId: 'ABC', wyniki: { x: 1 } });

    const anchor = ctx.createdAnchors[0];
    expect(anchor).toBeDefined();
    expect(anchor.click).toHaveBeenCalledTimes(1);
    expect(anchor.download).toMatch(/^Wynik_ABC_\d+\.csv$/);
    expect(ctx.errorCalls).toHaveLength(0);
  });

  it('z openerem wysyła postMessage i nie pobiera CSV lokalnie', () => {
    const ctx = runAdapter({ withOpener: true, language: 'pl-PL' });

    ctx.window.electronTest.sendResults({ testId: 'ABC', wyniki: { x: 1 } });

    expect(ctx.postMessages).toHaveLength(1);
    expect(ctx.postMessages[0][0]).toMatchObject({ type: 'test-results' });
    expect(ctx.createdAnchors).toHaveLength(0);
    expect(ctx.errorCalls).toHaveLength(0);
  });
});
