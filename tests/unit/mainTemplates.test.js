import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import templatesMod from "../../main/templates.js";

const { createTemplates, safeTemplateName, buildExportPayload, parseImportContent } = templatesMod;

describe("main/templates pure", () => {
  it("safeTemplateName: małe litery, reszta do _", () => {
    expect(safeTemplateName("Mój Szablon!")).toBe("m_j_szablon_");
    expect(safeTemplateName("ABC-123")).toBe("abc_123");
    expect(safeTemplateName("")).toBe("szablon");
    expect(safeTemplateName(null)).toBe("szablon");
  });

  it("buildExportPayload: koperta meta + template", () => {
    const payload = buildExportPayload({ name: "x", fields: [] });
    expect(payload.meta).toMatchObject({ app: "Nous", type: "demographics_template", version: "1.0" });
    expect(typeof payload.meta.exportedAt).toBe("string");
    expect(payload.template).toEqual({ name: "x", fields: [] });
  });

  it("parseImportContent: wrapped, raw fallback, błędy", () => {
    const wrapped = { template: { name: "t", fields: [1] } };
    expect(parseImportContent(JSON.stringify(wrapped))).toEqual({ success: true, data: wrapped.template });

    const raw = { name: "r", fields: [2] };
    expect(parseImportContent(JSON.stringify(raw))).toEqual({ success: true, data: raw });

    expect(() => parseImportContent(JSON.stringify({ template: {} }))).toThrow(
      "Nieprawidłowy format pliku",
    );
    expect(() => parseImportContent("nie-json{{{")).toThrow(SyntaxError);
  });
});

describe("main/templates ipc", () => {
  const getMainWindow = () => ({ id: 1 });

  it("export: zapisuje plik i raportuje sukces / anulowanie", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-tpl-"));
    const filePath = path.join(dir, "szablon_x.json");
    const dialog = { showSaveDialog: vi.fn(async () => ({ filePath })) };
    const { exportTemplate } = createTemplates({ dialog, fs });

    const ok = await exportTemplate(getMainWindow, { name: "X", fields: [] });
    expect(ok).toEqual({ success: true });
    expect(dialog.showSaveDialog.mock.calls[0][1].defaultPath).toBe("szablon_x.json");
    expect(JSON.parse(fs.readFileSync(filePath, "utf8")).template.name).toBe("X");

    dialog.showSaveDialog.mockResolvedValue({});
    expect(await exportTemplate(getMainWindow, {})).toEqual({ success: false, cancelled: true });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("import: czyta i waliduje / anulowanie / uszkodzony plik", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-tpl-"));
    const good = path.join(dir, "good.json");
    const bad = path.join(dir, "bad.json");
    fs.writeFileSync(good, JSON.stringify({ template: { name: "t", fields: [] } }));
    fs.writeFileSync(bad, "???");
    const dialog = { showOpenDialog: vi.fn(async () => ({ filePaths: [good] })) };
    const { importTemplate } = createTemplates({ dialog, fs });

    expect(await importTemplate(getMainWindow)).toEqual({ success: true, data: { name: "t", fields: [] } });

    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [bad] });
    const broken = await importTemplate(getMainWindow);
    expect(broken.success).toBe(false);
    expect(typeof broken.error).toBe("string");

    dialog.showOpenDialog.mockResolvedValueOnce({ filePaths: [] });
    expect(await importTemplate(getMainWindow)).toEqual({ success: false, cancelled: true });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
