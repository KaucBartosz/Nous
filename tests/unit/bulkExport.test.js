import { describe, it, expect } from "vitest";
import bulkExport from "../../main/bulkExport.js";
import { resultRow } from "../../src/results/resultExporter.js";

// main/ to CommonJS (proces Electrona) — nie może importować ESM z src/.
// Prawdą jest TEN test: buildBulkRow(f) deep-equals resultRow(f).
// Decyzja 2b/b: nagłówki ` - `, `Badacz UID`, braki `-`.

const { buildBulkRow, buildBulkCsv, escapeCell } = bulkExport;

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

  it("CSV: BOM + nagłówki = klucze wiersza + quoting", () => {
    const csv = buildBulkCsv(nested);
    const keys = Object.keys(resultRow(nested));
    const [headerLine, dataLine] = csv.split("\r\n");
    expect(headerLine).toBe(`﻿${keys.join(";")}`);
    // 'a;b"c\nD' → cytowane, cudzysłów podwojony
    expect(dataLine).toContain('"a;b""c\nd"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("escapeCell jak escapeCsvCell (reguła maina)", () => {
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell("a;b")).toBe('"a;b"');
    expect(escapeCell("ok")).toBe("ok");
  });
});
