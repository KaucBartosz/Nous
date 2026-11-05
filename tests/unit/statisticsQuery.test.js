import { describe, it, expect } from "vitest";
import {
  normalizeTestId,
  metricLabel,
  extractMetrics,
  distinctTestIds,
  distinctSubjectIds,
  filterStatisticsResults,
  compareRuns,
  aggregateMetrics,
  trendForMetric,
  scoreOf,
  isLowerBetter,
} from "../../src/statistics/statisticsQuery.js";

describe("statisticsQuery", () => {
  const sampleResults = [
    {
      id: "r1",
      timestamp: "2026-01-01T10:00:00.000Z",
      test_id: "Sygnalizacja",
      subject_id: "A",
      researcher_uid: "U1",
      wyniki: {
        testId: "Sygnalizacja",
        score: "10",
        statystyki: { poprawne: 8, bledne: 2, wszystkie_proby: 10, skutecznosc: 80, sredni_czas_ms: 400 },
      },
    },
    {
      id: "r2",
      timestamp: "2026-01-02T10:00:00.000Z",
      test_id: "syg",
      subject_id: "B",
      researcher_uid: "U1",
      wyniki: {
        testId: "syg",
        score: "12",
        statystyki: { poprawne: 9, bledne: 1, wszystkie_proby: 10, skutecznosc: 90, sredni_czas_ms: 380 },
      },
    },
    {
      id: "r3",
      timestamp: "2026-01-03T10:00:00.000Z",
      test_id: "Corsi",
      subject_id: "A",
      researcher_uid: "U1",
      wyniki: {
        testId: "Corsi",
        score: 5,
        statystyki: { poprawne: 5, bledne: 0, wszystkie_proby: 5 },
      },
    },
  ];

  it("normalizuje testId aliasy", () => {
    expect(normalizeTestId("syg")).toBe("Sygnalizacja");
    expect(normalizeTestId("semafor")).toBe("Semafor");
    expect(normalizeTestId("GoNoGo")).toBe("GoNoGo");
  });

  it("zwraca czytelne etykiety metryk", () => {
    expect(metricLabel("statystyki - sredni_czas_ms")).toBe("Średni czas reakcji (ms)");
    expect(metricLabel("statystyki - poprawne_reakcje")).toBe("Zdobyte punkty");
    expect(metricLabel("statystyki - ilosc_blednych_nacisniec")).toBe("Błędy");
  });

  it("ekstrahuje tylko metryki numeryczne", () => {
    const m = extractMetrics(sampleResults[0]);
    const keys = m.map((x) => x.key);
    expect(keys).toContain("score");
    expect(keys.some((k) => k.includes("poprawne"))).toBe(true);
    expect(m.every((x) => typeof x.value === "number")).toBe(true);
  });

  it("parsuje score string na number", () => {
    const m = extractMetrics(sampleResults[0]);
    const score = m.find((x) => x.key === "score");
    expect(score.value).toBe(10);
  });

  it("deduplikuje metryki obecne jednocześnie na poziomie głównym i w statystykach", () => {
    const payloadWithDuplicates = {
      wyniki: {
        score: 15,
        ilosc_blednych_nacisniec: 3,
        sredni_czas_reakcji: 350,
        ilosc_poprawnych_nacisniec: 12,
        ogolna_ilosc_nacisniec: 15,
        statystyki: {
          bledne_reakcje: 3,
          sredni_czas_ms: 350,
          poprawne_reakcje: 12,
          wszystkie_proby: 15,
        },
      },
    };
    const metrics = extractMetrics(payloadWithDuplicates);
    const keys = metrics.map((m) => m.key);
    const labels = metrics.map((m) => m.label);

    // Każde pojęcie powinno występować dokładnie raz
    expect(keys.filter((k) => k === "bledne").length).toBe(1);
    expect(keys.filter((k) => k === "sredni_czas_ms").length).toBe(1);
    expect(keys.filter((k) => k === "poprawne").length).toBe(1);
    expect(keys.filter((k) => k === "wszystkie_proby").length).toBe(1);

    expect(labels.filter((l) => l === "Błędy").length).toBe(1);
    expect(labels.filter((l) => l === "Średni czas reakcji (ms)").length).toBe(1);
  });

  it("distinctTestIds normalizuje aliasy", () => {
    const tests = distinctTestIds(sampleResults);
    expect(tests).toContain("Sygnalizacja");
    expect(tests).toContain("Corsi");
    expect(tests.filter((t) => t === "Sygnalizacja").length).toBe(1);
  });

  it("distinctSubjectIds filtruje po teście", () => {
    const subjects = distinctSubjectIds(sampleResults, "Sygnalizacja");
    expect(subjects).toEqual(["A", "B"]);
  });

  it("filterStatisticsResults filtruje test i badanych bez względu na wielkość liter", () => {
    const filtered = filterStatisticsResults(sampleResults, {
      testId: "Sygnalizacja",
      subjectIds: ["a"],
    });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe("r1");
  });

  it("compareRuns liczy deltę i procent", () => {
    const rows = compareRuns(sampleResults[0], sampleResults[1], []);
    const poprawne = rows.find((r) => r.key.includes("poprawne"));
    expect(poprawne.valueA).toBe(8);
    expect(poprawne.valueB).toBe(9);
    expect(poprawne.delta).toBe(1);
  });

  it("aggregateMetrics liczy średnie", () => {
    const runs = sampleResults.filter((r) => normalizeTestId(r.test_id) === "Sygnalizacja");
    const rows = aggregateMetrics(runs, []);
    const poprawne = rows.find((r) => r.key.includes("poprawne"));
    expect(poprawne.count).toBe(2);
    expect(poprawne.avg).toBe(8.5);
  });

  it("scoreOf zwraca wynik liczbowy lub null", () => {
    expect(scoreOf(sampleResults[0])).toBe(10);
    expect(scoreOf(sampleResults[2])).toBe(5);
    expect(scoreOf({ wyniki: { score: "brak" } })).toBeNull();
    expect(scoreOf({})).toBeNull();
  });

  it("scoreOf korzysta z punktów, gdy brak score", () => {
    expect(
      scoreOf({ wyniki: { ilosc_poprawnych_nacisniec: 7, ilosc_blednych_nacisniec: 2 } }),
    ).toBe(7);
    expect(scoreOf({ wyniki: { poprawne_reakcje: 4 } })).toBe(4);
    expect(scoreOf({ wyniki: {}, score: "6" })).toBe(6);
  });

  it("isLowerBetter rozpoznaje metryki, gdzie mniej znaczy lepiej", () => {
    expect(isLowerBetter("statystyki - ilosc_blednych_nacisniec", "Błędy")).toBe(true);
    expect(isLowerBetter("statystyki - sredni_czas_ms", "Średni czas reakcji (ms)")).toBe(true);
    expect(isLowerBetter("score", "Wynik (score)")).toBe(false);
    expect(isLowerBetter("ilosc_poprawnych_nacisniec", "Zdobyte punkty")).toBe(false);
  });

  it("compareRuns oznacza kierunek poprawy", () => {
    const rows = compareRuns(sampleResults[0], sampleResults[1], []);
    const poprawne = rows.find((r) => r.key.includes("poprawne"));
    const bledne = rows.find((r) => r.key.includes("bledne"));
    expect(poprawne.lowerIsBetter).toBe(false);
    expect(bledne.lowerIsBetter).toBe(true);
  });

  it("trendForMetric zwraca punkty rosnąco po dacie", () => {
    const runs = sampleResults.filter((r) => normalizeTestId(r.test_id) === "Sygnalizacja");
    const key = extractMetrics(runs[0]).find((m) => m.key.includes("poprawne")).key;
    const points = trendForMetric(runs, key);
    expect(points.length).toBe(2);
    expect(new Date(points[0].timestamp) <= new Date(points[1].timestamp)).toBe(true);
  });
});
