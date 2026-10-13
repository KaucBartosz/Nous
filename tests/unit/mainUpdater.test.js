import { describe, it, expect, vi } from "vitest";
import updaterMod from "../../main/updater.js";

const { createUpdater } = updaterMod;

function harness({ packaged = true } = {}) {
  const calls = { check: 0, download: 0, quit: 0 };
  const feedHandlers = {};
  const autoUpdater = {
    checkForUpdates: () => calls.check++,
    downloadUpdate: () => calls.download++,
    quitAndInstall: () => calls.quit++,
    on: (ev, fn) => (feedHandlers[ev] = fn),
  };
  const app = { isPackaged: packaged, getVersion: () => "1.4.0" };
  const sends = [];
  const mainWindow = { webContents: { send: (ch, payload) => sends.push([ch, payload]) } };
  const updater = createUpdater({ app, autoUpdater });
  return { updater, calls, feedHandlers, sends, mainWindow };
}

describe("main/updater", () => {
  it("dev (nie spakowana): check zwraca not-available z wersją, bez sieci", () => {
    const { updater, calls, sends, mainWindow } = harness({ packaged: false });
    updater.checkAppUpdate(() => mainWindow);
    expect(sends).toEqual([["app-update-not-available", { version: "1.4.0" }]]);
    expect(calls.check).toBe(0);
  });

  it("spakowana: check leci do autoUpdatera", () => {
    const { updater, calls, sends, mainWindow } = harness();
    updater.checkAppUpdate(() => mainWindow);
    expect(calls.check).toBe(1);
    expect(sends).toEqual([]);
  });

  it("download/install delegują; getAppVersion zwraca wersję", () => {
    const { updater, calls } = harness();
    updater.downloadAppUpdate();
    updater.installAppUpdate();
    expect(calls.download).toBe(1);
    expect(calls.quit).toBe(1);
    expect(updater.getAppVersion()).toBe("1.4.0");
  });

  it("6 zdarzeń feedu forwardowanych do okna (error → message)", () => {
    const { updater, feedHandlers, sends, mainWindow } = harness();
    updater.registerFeedEvents(() => mainWindow);
    expect(Object.keys(feedHandlers).sort()).toEqual([
      "checking-for-update",
      "download-progress",
      "error",
      "update-available",
      "update-downloaded",
      "update-not-available",
    ]);
    feedHandlers["checking-for-update"]();
    feedHandlers["update-available"]({ version: "2.0" });
    feedHandlers["error"](new Error("boom"));
    feedHandlers["download-progress"]({ percent: 50 });
    expect(sends).toEqual([
      ["app-update-checking", undefined],
      ["app-update-available", { version: "2.0" }],
      ["app-update-error", "boom"],
      ["app-download-progress", { percent: 50 }],
    ]);
  });

  it("zdarzenia przy braku okna nie wybuchają", () => {
    const { updater, feedHandlers } = harness();
    updater.registerFeedEvents(() => null);
    expect(() => {
      Object.values(feedHandlers).forEach((fn) => fn({}));
    }).not.toThrow();
  });

  it("registerIpc podpina 3×on + handle wersji", async () => {
    const { updater, calls, mainWindow } = harness();
    const on = {};
    const handle = {};
    updater.registerIpc(
      { on: (ch, fn) => (on[ch] = fn), handle: (ch, fn) => (handle[ch] = fn) },
      () => mainWindow,
    );
    on["download-app-update"]();
    on["install-app-update"]();
    expect(calls.download).toBe(1);
    expect(await handle["get-app-version"]()).toBe("1.4.0");
  });
});
