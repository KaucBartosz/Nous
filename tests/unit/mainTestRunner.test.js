import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import runnerMod from "../../main/testRunner.js";

const { createTestRunner } = runnerMod;

// Fejk okna: łapie opts, handlery i wywołania metod.
function makeWindow() {
  return {
    opts: null,
    loaded: null,
    onceHandlers: {},
    onHandlers: {},
    webContentsHandlers: {},
    shown: 0,
    maximized: 0,
    fullScreens: [],
    destroyed: false,
    fullScreen: false,
    closed: false,
    loadFile(p) {
      this.loaded = p;
    },
    once(ev, fn) {
      this.onceHandlers[ev] = fn;
    },
    on(ev, fn) {
      this.onHandlers[ev] = fn;
    },
    show() {
      this.shown++;
    },
    maximize() {
      this.maximized++;
    },
    setFullScreen(v) {
      this.fullScreens.push(v);
      this.fullScreen = v;
    },
    isDestroyed() {
      return this.destroyed;
    },
    isFullScreen() {
      return this.fullScreen;
    },
    close() {
      this.closed = true;
    },
    webContents: null,
  };
}

function harness({ platform = "win32", masterKey = "mk" } = {}) {
  const wins = [];
  const win = makeWindow();
  win.webContents = { on: vi.fn((ev, fn) => (win.webContentsHandlers[ev] = fn)), send: vi.fn() };
  // function (nie arrow) — produkcja woła `new BrowserWindow(...)`
  const FakeBW = vi.fn(function (opts) {
    win.opts = opts;
    wins.push(win);
    return win;
  });
  FakeBW.fromWebContents = (sender) => sender.__win || null;

  const mainSends = [];
  const mainWindow = {
    webContents: { send: (ch, payload) => mainSends.push([ch, payload]) },
    isMinimized: () => false,
    restore: vi.fn(),
    focus: vi.fn(),
  };
  const runner = createTestRunner({
    BrowserWindow: FakeBW,
    screen: { getPrimaryDisplay: () => ({ size: { width: 1920, height: 1080 } }) },
    path,
    dialog: { showSaveDialog: async () => ({ canceled: true }) },
    fs,
    crypto,
    getMainWindow: () => mainWindow,
    getMasterKey: () => masterKey,
    preloadPath: "/preload_test.js",
    platform,
  });
  return { runner, win, FakeBW, mainWindow, mainSends };
}

describe("main/testRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("win32: okno 1024x768 z parent, loadFile, drugie otwarcie ignorowane", () => {
    const { runner, win, FakeBW } = harness();
    runner.openTestWindow("/t/index.html");
    expect(win.opts).toMatchObject({
      width: 1024,
      height: 768,
      show: true,
      fullscreen: true,
      title: "Badanie w toku...",
    });
    expect(win.opts.parent).toBeDefined();
    expect(win.opts.webPreferences.preload).toBe("/preload_test.js");
    expect(win.loaded).toBe("/t/index.html");
    expect(runner.isTestRunning()).toBe(true);

    runner.openTestWindow("/t/other.html"); // w toku — ignorowane
    expect(FakeBW).toHaveBeenCalledTimes(1);
    expect(win.loaded).toBe("/t/index.html");
  });

  it("closed zeruje stan i powiadamia main", () => {
    const { runner, win, mainSends } = harness();
    runner.openTestWindow("/t/index.html");
    win.onHandlers.closed();
    expect(runner.isTestRunning()).toBe(false);
    expect(mainSends).toEqual([["test-process-stopped", undefined]]);
  });

  it("ESC wychodzi z fullscreen", () => {
    const { runner, win } = harness();
    runner.openTestWindow("/t/index.html");
    win.webContentsHandlers["before-input-event"](null, { key: "Escape", type: "keyDown" });
    expect(win.fullScreens).toEqual([false]);
  });

  it("linux: bez parent/show, fullscreen dopiero po ready-to-show (+ fallback)", () => {
    vi.useFakeTimers();
    const { runner, win } = harness({ platform: "linux" });
    runner.openTestWindow("/t/index.html");
    expect(win.opts).toMatchObject({
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
      show: false,
      parent: undefined,
      fullscreen: false,
    });

    win.onceHandlers["ready-to-show"]();
    expect(win.shown).toBe(1);
    expect(win.maximized).toBe(1);

    vi.advanceTimersByTime(500);
    expect(win.fullScreens).toEqual([true]);

    win.fullScreen = false; // WM nie przełączył — fallback
    vi.advanceTimersByTime(500);
    expect(win.maximized).toBe(2);
  });

  it("test-finished: zamyka okno testu, forwarduje wyniki, focus", () => {
    const { runner, win, mainWindow, mainSends } = harness();
    const sender = { __win: win, send: vi.fn() };
    runner.onTestFinished({ sender }, { score: 1 });
    expect(win.closed).toBe(true);
    expect(mainSends).toEqual([["test-results-forwarded", { score: 1 }]]);
    expect(mainWindow.focus).toHaveBeenCalled();
  });

  it("test-close: zamyka okno z event.sender", () => {
    const { runner, win } = harness();
    runner.onTestClose({ sender: { __win: win } });
    expect(win.closed).toBe(true);
  });

  it("save-local-result: pełny zapis i weryfikacja podpisu", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-save-"));
    const filePath = path.join(dir, "wynik.json");
    const sends = [];
    const dialog = { showSaveDialog: async () => ({ canceled: false, filePath }) };
    const { createTestRunner: crt } = runnerMod;
    const r = crt({
      BrowserWindow: vi.fn(),
      screen: { getPrimaryDisplay: () => ({ size: {} }) },
      path,
      dialog,
      fs,
      crypto,
      getMainWindow: () => null,
      getMasterKey: () => "sekret",
      preloadPath: "/p.js",
    });
    r.onSaveLocalResult({ sender: { send: (ch, msg) => sends.push([ch, msg]) } }, { test_id: "t1", wyniki: { a: 1 } });
    await new Promise((res) => setTimeout(res, 20));

    const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const expected = crypto.createHmac("sha256", "sekret").update(JSON.stringify({ a: 1 })).digest("hex");
    expect(saved.meta.signature).toBe(expected);
    expect(saved.meta.app).toBe("Nous");
    expect(sends).toEqual([["test-status", "Wynik zapisany pomyślnie."]]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("save-local-result: brak klucza → błąd, brak dialogu", () => {
    const dialog = { showSaveDialog: vi.fn() };
    const { createTestRunner: crt } = runnerMod;
    const r = crt({
      BrowserWindow: vi.fn(),
      screen: { getPrimaryDisplay: () => ({ size: {} }) },
      path,
      dialog,
      fs,
      crypto,
      getMainWindow: () => null,
      getMasterKey: () => null,
      preloadPath: "/p.js",
    });
    const sends = [];
    r.onSaveLocalResult({ sender: { send: (ch, msg) => sends.push([ch, msg]) } }, { wyniki: {} });
    expect(sends).toEqual([["test-status", "BŁĄD: Nie można wygenerować klucza podpisu!"]]);
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });
});
