import { describe, it, expect, vi } from "vitest";
import {
  MAX_TAG_LENGTH,
  storageKeyFor,
  normalizeTagInput,
  parseTagSearchQuery,
  matchesTagGroups,
  createTagsStore,
} from "../../src/catalog/tagsStore.js";
import {
  selectUpdatesView,
  countUpdates,
} from "../../src/catalog/testCatalog.js";

// Fejk storage (zamiast localStorage) — ten sam kształt co w catalogNotify.test.js
const fakeStorage = (seed = {}) => {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};

describe("tagsStore.storageKeyFor", () => {
  it("konto Firebase — klucz po UID (wygrywa ze statusem)", () => {
    expect(
      storageKeyFor({ uid: "abc123", status: "APPROVED", researcherUid: "x" }),
    ).toBe("test_tags_abc123");
  });

  it("konto lokalne — LOCAL::username z zamianą :: na __", () => {
    expect(
      storageKeyFor({
        uid: null,
        status: "LOCAL",
        researcherUid: "LOCAL::jan",
      }),
    ).toBe("test_tags_LOCAL__jan");
  });

  it("gość i anonim — stałe klucze", () => {
    expect(storageKeyFor({ uid: null, status: "GUEST" })).toBe(
      "test_tags_guest",
    );
    expect(storageKeyFor({ uid: null, status: "PENDING" })).toBe(
      "test_tags_anonymous",
    );
    expect(storageKeyFor({})).toBe("test_tags_anonymous");
  });
});

describe("tagsStore.normalizeTagInput", () => {
  it("dzieli po przecinku, trimuje i zniża rejestr", () => {
    expect(normalizeTagInput("  Uwaga, SZYBKI ,,  ")).toEqual([
      "uwaga",
      "szybki",
    ]);
  });

  it(`odcina tagi dłuższe niż ${MAX_TAG_LENGTH} znaków`, () => {
    expect(MAX_TAG_LENGTH).toBe(25); // kontrakt z adapterem (było inline 25)
    expect(normalizeTagInput(`ok,${"x".repeat(26)}`)).toEqual(["ok"]);
    expect(normalizeTagInput("x".repeat(25))).toEqual(["x".repeat(25)]);
  });

  it("puste wejście daje pustą listę", () => {
    expect(normalizeTagInput("")).toEqual([]);
    expect(normalizeTagInput(null)).toEqual([]);
    expect(normalizeTagInput(" , , ")).toEqual([]);
  });
});

describe("tagsStore.createTagsStore", () => {
  it("wymaga { storage, key }", () => {
    expect(() => createTagsStore()).toThrow();
    expect(() => createTagsStore({ storage: fakeStorage() })).toThrow();
  });

  it("pusty store zwraca [] zamiast undefined", () => {
    const s = createTagsStore({ storage: fakeStorage(), key: "k" });
    expect(s.getTagsForTest("t1")).toEqual([]);
    expect(s.getAllUsedTags()).toEqual([]);
  });

  it("add dodaje unikalnie i zwraca aktualizację", () => {
    const s = createTagsStore({ storage: fakeStorage(), key: "k" });
    expect(s.addTagsToTest("t1", "A, b, A")).toEqual(["a", "b"]);
    expect(s.addTagsToTest("t1", "b, C")).toEqual(["a", "b", "c"]);
    expect(s.getTagsForTest("t1")).toEqual(["a", "b", "c"]);
  });

  it("add z pustym wejściem nic nie zapisuje", () => {
    const storage = fakeStorage();
    const s = createTagsStore({ storage, key: "k" });
    expect(s.addTagsToTest("t1", "   ")).toBeUndefined();
    expect(storage.data).toEqual({});
  });

  it("remove usuwa tag, a pusty test znika z mapy", () => {
    const s = createTagsStore({ storage: fakeStorage(), key: "k" });
    s.addTagsToTest("t1", "a, b");
    expect(s.removeTagFromTest("t1", "A")).toEqual(["b"]);
    expect(s.removeTagFromTest("t1", "b")).toEqual([]);
    expect(s.getAll()).toEqual({});
  });

  it("getAllUsedTags zwraca unikalne posortowane", () => {
    const s = createTagsStore({ storage: fakeStorage(), key: "k" });
    s.addTagsToTest("t1", "zeta, alfa");
    s.addTagsToTest("t2", "alfa, beta");
    expect(s.getAllUsedTags()).toEqual(["alfa", "beta", "zeta"]);
  });

  it("uszkodzony JSON daje {} zamiast wybuchu", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = createTagsStore({
      storage: fakeStorage({ k: "nie-json{{{ " }),
      key: "k",
    });
    expect(s.getTagsForTest("t1")).toEqual([]);
    err.mockRestore();
  });

  it("klucze są izolowane per użytkownik", () => {
    const storage = fakeStorage();
    const a = createTagsStore({ storage, key: "test_tags_A" });
    const b = createTagsStore({ storage, key: "test_tags_B" });
    a.addTagsToTest("t1", "x");
    expect(b.getTagsForTest("t1")).toEqual([]);
  });
});

describe("tagsStore.parseTagSearchQuery (prawdziwa implementacja, AND>OR)", () => {
  it("sam tekst bez tagów", () => {
    expect(parseTagSearchQuery("stroop uwaga")).toEqual({
      textFilters: ["stroop", "uwaga"],
      tagGroups: [],
    });
  });

  it("precedencja AND>OR: @a OR @b @c OR @d", () => {
    expect(parseTagSearchQuery("@a OR @b @c OR @d").tagGroups).toEqual([
      ["a"],
      ["b", "c"],
      ["d"],
    ]);
  });

  it("domyślny operator między tagami to AND", () => {
    expect(parseTagSearchQuery("@a @b").tagGroups).toEqual([["a", "b"]]);
    expect(parseTagSearchQuery("@a AND @b").tagGroups).toEqual([["a", "b"]]);
  });

  it("miesza tekst z tagami i ignoruje wielkość liter", () => {
    const res = parseTagSearchQuery("Stroop @Szybki OR @Wolny");
    expect(res.textFilters).toEqual(["stroop"]);
    expect(res.tagGroups).toEqual([["szybki"], ["wolny"]]);
  });

  it("puste zapytanie", () => {
    expect(parseTagSearchQuery("")).toEqual({ textFilters: [], tagGroups: [] });
    expect(parseTagSearchQuery("   ")).toEqual({
      textFilters: [],
      tagGroups: [],
    });
  });
});

describe("tagsStore.matchesTagGroups (OR grup, AND w grupie)", () => {
  it("puste grupy pasują do wszystkiego", () => {
    expect(matchesTagGroups(["a"], [])).toBe(true);
  });

  it("AND w grupie, OR między grupami", () => {
    expect(matchesTagGroups(["a", "b"], [["a", "b"]])).toBe(true);
    expect(matchesTagGroups(["a"], [["a", "b"]])).toBe(false);
    expect(matchesTagGroups(["c"], [["a"], ["c"]])).toBe(true);
    expect(matchesTagGroups(["x"], [["a"], ["c"]])).toBe(false);
  });

  it("case-insensitive", () => {
    expect(matchesTagGroups(["Szybki"], [["szybki"]])).toBe(true);
  });
});

describe("testCatalog.selectUpdatesView (filtr + sort, fejki)", () => {
  const tests = [
    { id: "aktualny", name: "Stroop", local_ver: 2, remote_ver: 2 },
    { id: "doUpdate", name: "Stroop Plus", local_ver: 1, remote_ver: 2 },
    { id: "brak", name: "Bystre Oczko", local_ver: 0, remote_ver: 1 },
  ];

  it("pusty filtr zwraca wszystko posortowane: update → aktualne → brak", () => {
    expect(selectUpdatesView(tests, "").map((t) => t.id)).toEqual([
      "doUpdate",
      "aktualny",
      "brak",
    ]);
  });

  it("filtr po nazwie (case-insensitive)", () => {
    expect(selectUpdatesView(tests, "stroop").map((t) => t.id)).toEqual([
      "doUpdate",
      "aktualny",
    ]);
    expect(selectUpdatesView(tests, "oczko").map((t) => t.id)).toEqual(["brak"]);
    expect(selectUpdatesView(tests, "xyz")).toEqual([]);
  });

  it("nie mutuje wejścia (sort na kopii)", () => {
    const input = [...tests];
    selectUpdatesView(input, "");
    expect(input.map((t) => t.id)).toEqual(["aktualny", "doUpdate", "brak"]);
  });

  it("badge: countUpdates na wyniku selektora = liczba przestarzałych", () => {
    // Pusty rejestr → badge 0; przestarzałe → badge 1 (jak loadUpdatesData:96)
    expect(countUpdates(selectUpdatesView([], ""))).toBe(0);
    expect(countUpdates(selectUpdatesView(tests, ""))).toBe(1);
    expect(countUpdates(selectUpdatesView(tests, "oczko"))).toBe(0);
  });
});
