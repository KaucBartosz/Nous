import { describe, it, expect, vi } from "vitest";
import shellMod from "../../main/shell.js";

const { createShell, isAllowedExternalUrl, ALLOWED_PROTOCOLS } = shellMod;

describe("main/shell pure", () => {
  it("allowlista protokołów jak w main.js", () => {
    expect(ALLOWED_PROTOCOLS).toEqual(["https:", "http:", "mailto:"]);
    expect(isAllowedExternalUrl("https://example.com/x")).toBe(true);
    expect(isAllowedExternalUrl("http://example.com")).toBe(true);
    expect(isAllowedExternalUrl("mailto:a@b.c")).toBe(true);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("electron://x")).toBe(false);
    expect(isAllowedExternalUrl("nie-url{{{")).toBe(false);
    expect(isAllowedExternalUrl("")).toBe(false);
  });
});

describe("main/shell ipc", () => {
  it("registerIpc: podpina kanał open-external przez on (send, nie invoke)", () => {
    const listeners = {};
    const ipcMain = { on: (ch, fn) => (listeners[ch] = fn) };
    const { registerIpc } = createShell({ shell: { openExternal: vi.fn() } });
    registerIpc(ipcMain);
    expect(typeof listeners["open-external"]).toBe("function");
  });

  it("dozwolone URL przechodzą do shell.openExternal", () => {
    const shell = { openExternal: vi.fn() };
    const { openExternal } = createShell({ shell });
    openExternal({}, "https://github.com/KaucBartosz/Nous");
    openExternal({}, "mailto:7k89yxz17@mozmail.com");
    expect(shell.openExternal).toHaveBeenCalledTimes(2);
  });

  it("zły protokół i zły URL blokowane (osobne komunikaty jak w main.js)", () => {
    const shell = { openExternal: vi.fn() };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { openExternal } = createShell({ shell });

    openExternal({}, "file:///etc/passwd");
    openExternal({}, "nie-url{{{");

    expect(shell.openExternal).not.toHaveBeenCalled();
    expect(err.mock.calls[0][0]).toContain("protokołu: file:");
    expect(err.mock.calls[1][0]).toContain("Nieprawidłowy URL");
    err.mockRestore();
  });
});
