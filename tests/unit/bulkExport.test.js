import { describe, it, expect, vi } from "vitest";
import bulkExport from "../../main/bulkExport.js";
import { resultRow, toKeyValueCSV } from "../../src/results/resultExporter.js";

// main/ to CommonJS (proces Electrona) — nie może importować ESM z src/.
// Prawdą jest TEN test: buildBulkRow(f) deep-equals resultRow(f).
// Decyzja 2b/b: nagłówki ` - `, `Badacz UID`, braki `-`.

const { createBulkExport, buildBulkRow, buildBulkCsv, escapeCell } = bulkExport;

const basic = {
  test_id: "stroop",
  timestamp: "2024-05-01T10:00:00.000Z",
  subject_id: "P1",
  researcher_uid: "u1",
  demographics: { data: { wiek: 30 } },
  wyniki: { poprawne: 10, sredni_czas: 350 },
};

const nested = {
  test_id: "t",
  timestamp: "2024-05-01T10:00:00.000Z",
  subject_id: "s",
  researcher_uid: "u",
  demographics: { data: { wiek: 30, adres: { miasto: "Łódź" }, tagi: ["a", "b"] } },
  wyniki: { blok: { proba: 1 }, lista: [1, 2], tekst: 'a;b"c\nd' },
};

const legacy = {
  testId: "legacy",
  timestamp: "2024-05-01T10:00:00.000Z",
  data: { x: 1 },
};

describe("bulkExport parity (2b/b)", () => {
  it.each([["basic", basic], ["nested", nested], ["legacy", legacy]])(
    "buildBulkRow(%s) deep-equals resultRow",
    (_name, fixture) => {
      expect(buildBulkRow(fixture)).toEqual(resultRow(fixture));
    },
  );

  it("braki: test/researcher/subject jak resultRow", () => {
    const row = buildBulkRow({ timestamp: "2024-05-01T10:00:00.000Z" });
    const ref = resultRow({ timestamp: "2024-05-01T10:00:00.000Z" });
    // Data zależy od zegara — porównaj resztę (parytet czasu w fixturach wyżej)
    const { Data: _a, ...rest } = row;
    const { Data: _b, ...refRest } = ref;
    expect(rest).toEqual(refRest);
    expect(rest["Test ID"]).toBe("test");
    expect(rest["ID Badanego"]).toBe("-");
    expect(rest["Badacz UID"]).toBe("-");
  });

  it("nagłówki po nowemu (pin decyzji 2b/b)", () => {
    const keys = Object.keys(buildBulkRow(basic));
    expect(keys).toContain("Metryczka - wiek");
    expect(keys).toContain("Wynik - poprawne");
    expect(keys).toContain("Badacz UID");
    expect(keys.filter((k) => k.startsWith("Metryczka_") || k.startsWith("Wynik_"))).toEqual([]);
    expect(keys).not.toContain("Badacz ID");
  });

  it("CSV key-value jak pojedyncze pobranie (wariant A: ZIP = N x single)", () => {
    const csv = buildBulkCsv(nested);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("﻿Parametr;Wartość");
    expect(lines).toContain("Metryczka - wiek;30");
    // 'a;b"c\nD' → cytowane, cudzysłów podwojony
    expect(csv).toContain('"a;b""c\nd"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it.each([["basic", basic], ["nested", nested], ["legacy", legacy]])(
    "buildBulkCsv(%s) bajtowo równe pojedynczemu pobraniu",
    (_name, fixture) => {
      expect(buildBulkCsv(fixture)).toBe(toKeyValueCSV(resultRow(fixture)));
    },
  );

  it("escapeCell jak escapeCsvCell (reguła maina)", () => {
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell("a;b")).toBe('"a;b"');
    expect(escapeCell("ok")).toBe("ok");
  });
});

describe("bulkExport ipc (C6)", () => {
  const getMainWindow = () => ({ id: 1 });
  const payload = (format, extra = {}) => ({
    results: [basic, nested],
    filename: "paczka.zip",
    format,
    ...extra,
  });
  const deps = (zip, dialog) => ({
    dialog: dialog || { showSaveDialog: async () => ({}) },
    AdmZip: function () { return zip; },
    path: { basename: (n) => n.split("/").pop(), join: (...p) => p.join("/") },
    getDownloadsDir: () => "C:/Downloads",
  });

  function fakeZip() {
    const files = {};
    return {
      files,
      addFile: (name, buf) => {
        files[name] = buf;
      },
      writeZip: (p) => {
        files.__writtenTo = p;
      },
    };
  }

  it("registerIpc: podpina kanał download-bulk-zip", () => {
    const handlers = {};
    const ipcMain = { handle: (ch, fn) => (handlers[ch] = fn) };
    const { registerIpc } = createBulkExport(deps(fakeZip()));
    registerIpc(ipcMain, getMainWindow);
    expect(typeof handlers["download-bulk-zip"]).toBe("function");
  });

  it("domyślnie (destDir null): natywne okno, default w Downloads", async () => {
    const zip = fakeZip();
    const dialog = { showSaveDialog: vi.fn(async () => ({ filePath: "D:/Moj/paczka.zip" })) };
    const { downloadBulkZip } = createBulkExport(deps(zip, dialog));

    const out = await downloadBulkZip(getMainWindow, payload("csv"));
    expect(out).toEqual({ success: true, filePath: "D:/Moj/paczka.zip" });
    expect(Object.keys(zip.files).filter((n) => n.endsWith(".csv"))).toHaveLength(2);
    expect(zip.files.__writtenTo).toBe("D:/Moj/paczka.zip");
    expect(dialog.showSaveDialog.mock.calls[0][1]).toMatchObject({
      defaultPath: "C:/Downloads/paczka.zip",
    });
  });

  it("anulowanie dialogu → cancelled (renderer milczy)", async () => {
    const { downloadBulkZip } = createBulkExport(deps(fakeZip()));
    expect(await downloadBulkZip(getMainWindow, payload("csv"))).toEqual({
      success: false,
      cancelled: true,
    });
  });

  it("cicho (destDir): zapis wprost bez okna", async () => {
    const zip = fakeZip();
    const dialog = { showSaveDialog: vi.fn() };
    const { downloadBulkZip } = createBulkExport(deps(zip, dialog));

    const out = await downloadBulkZip(getMainWindow, payload("csv", { destDir: "D:/Ciche" }));
    expect(out).toEqual({ success: true, filePath: "D:/Ciche/paczka.zip" });
    expect(zip.files.__writtenTo).toBe("D:/Ciche/paczka.zip");
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("json: surowe wyniki bez CSV", async () => {
    const zip = fakeZip();
    const { downloadBulkZip } = createBulkExport(deps(zip));

    const out = await downloadBulkZip(getMainWindow, payload("json", { destDir: "D:/C" }));
    expect(out.success).toBe(true);
    expect(Object.keys(zip.files).filter((n) => n.endsWith(".json"))).toHaveLength(2);
    expect(JSON.parse(zip.files[Object.keys(zip.files)[0]].toString("utf8")).test_id).toBe("stroop");
  });

  it("SEC: nazwa pliku bez podkatalogów; błąd zwraca payload", async () => {
    const zip = fakeZip();
    const { downloadBulkZip } = createBulkExport({
      ...deps(zip),
      path: { basename: (n) => n.split("/").pop().split("\\").pop(), join: (...p) => p.join("/") },
    });
    const out = await downloadBulkZip(getMainWindow, { ...payload("csv", { destDir: "D:/C" }), filename: "../evil.zip" });
    expect(out.success).toBe(true);
    expect(zip.files.__writtenTo).toBe("D:/C/evil.zip");

    const broken = createBulkExport({
      ...deps(zip),
      AdmZip: function () { throw new Error("boom"); },
    });
    const err = await broken.downloadBulkZip(getMainWindow, payload("csv"));
    expect(err.success).toBe(false);
    expect(err.error).toBe("boom");
  });
});
