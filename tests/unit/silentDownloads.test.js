import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import silentMod from "../../main/silentDownloads.js";

const { createSilentDownloads } = silentMod;

const fakes = () => {
  const handlers = {};
  const willDownload = [];
  return {
    handlers,
    willDownload,
    session: { defaultSession: { on: (ev, fn) => willDownload.push([ev, fn]) } },
    dialog: { showOpenDialog: vi.fn() },
    app: { getPath: (name) => ({ downloads: "C:/Dl" })[name] },
    fs: { mkdirSync: vi.fn() },
  };
};

describe("main/silentDownloads", () => {
  it("domyślnie cicho WYŁĄCZONE; setMode sanityzuje", () => {
    const f = fakes();
    const m = createSilentDownloads({ ...f, path });
    expect(m.getMode()).toEqual({ silent: false, dir: null });
    expect(m.setMode({ silent: true, dir: "D:/X" })).toEqual({ silent: true, dir: "D:/X" });
    expect(m.setMode({ silent: "tak", dir: 42 })).toEqual({ silent: false, dir: null });
  });

  it("silentPathFor: basename + folder (wybrany albo Downloads)", () => {
    const f = fakes();
    const m = createSilentDownloads({ ...f, path });
    m.setMode({ silent: true, dir: null });
    expect(m.silentPathFor("a.zip")).toBe(path.join("C:/Dl", "a.zip"));
    m.setMode({ silent: true, dir: "D:/Ciche" });
    expect(m.silentPathFor("../evil.zip")).toBe(path.join("D:/Ciche", "evil.zip"));
  });

  it("will-download: cicho zapisuje, default przepuszcza (okno systemu)", () => {
    const f = fakes();
    const m = createSilentDownloads({ ...f, path });
    m.attachWillDownload();
    expect(f.willDownload.map(([ev]) => ev)).toEqual(["will-download"]);
    const [, handler] = f.willDownload[0];

    // Tryb dialogu: brak setSavePath (Electron pokazuje okno sam).
    const itemDialog = { getFilename: () => "x.zip", setSavePath: vi.fn() };
    handler({}, itemDialog);
    expect(itemDialog.setSavePath).not.toHaveBeenCalled();

    // Tryb cichy: katalog + zapis.
    m.setMode({ silent: true, dir: "D:/Ciche" });
    const itemSilent = { getFilename: () => "y.zip", setSavePath: vi.fn() };
    handler({}, itemSilent);
    expect(f.fs.mkdirSync).toHaveBeenCalledWith("D:/Ciche", { recursive: true });
    expect(itemSilent.setSavePath).toHaveBeenCalledWith(path.join("D:/Ciche", "y.zip"));
  });

  it("IPC: get-downloads-path, pick (ok/anuluj), set-silent-downloads", async () => {
    const f = fakes();
    const m = createSilentDownloads({ ...f, path });
    const handlers = {};
    const ipcMain = {
      handle: (ch, fn) => (handlers[ch] = fn),
      on: (ch, fn) => (handlers[ch] = fn),
    };
    m.registerIpc(ipcMain, () => ({ id: 1 }));

    expect(await handlers["get-downloads-path"]()).toBe("C:/Dl");

    f.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ["D:/W"] });
    expect(await handlers["pick-download-folder"]({}, "C:/Dl")).toEqual({ cancelled: false, dir: "D:/W" });
    f.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await handlers["pick-download-folder"]({}, null)).toEqual({ cancelled: true });

    handlers["set-silent-downloads"]({}, { silent: true, dir: "D:/W" });
    expect(m.getMode()).toEqual({ silent: true, dir: "D:/W" });
  });
});
