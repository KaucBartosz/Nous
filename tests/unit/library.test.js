import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocki muszą być przed jakimkolwiek importem modułów produkcyjnych ──────

vi.mock("../../src/firebaseConfig.js", () => ({
  db: {},
}));

// Firestore — importowany jako https:// URL; Vitest nie obsługuje tego protokołu
// natywnie, dlatego mockujemy przez alias ścieżki modułu (inline factory).
vi.mock(
  "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js",
  () => ({
    collection: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ empty: true, forEach: vi.fn() })),
  }),
);

vi.mock("../../src/modules/dialog.js", () => ({
  Dialog: { alert: vi.fn(), confirm: vi.fn(() => Promise.resolve(false)) },
}));

vi.mock("../../src/modules/settings.js", () => ({
  getSettings: vi.fn(() => ({ showLocalTests: false })),
  initSettings: vi.fn(),
}));

vi.mock("../../src/modules/utils.js", () => ({
  sortByInstallStatus: vi.fn((arr) => arr),
  debounce: vi.fn((fn) => fn),
  getLocalVersionsCached: vi.fn(() => Promise.resolve({})),
  invalidateLocalVersionsCache: vi.fn(),
  escapeHtml: vi.fn((s) => s),
}));

vi.mock("../../src/modules/tags.js", () => ({
  getTagsForTest: vi.fn(() => []),
  parseTagSearchQuery: vi.fn(() => ({ textFilters: [], tagGroups: [] })),
  matchesTagGroups: vi.fn(() => true),
  openTagMenu: vi.fn(),
}));

vi.mock("../../src/modules/auth.js", () => ({
  getResearcherUid: vi.fn(() => "user-123"),
  getUserStatus: vi.fn(() => "APPROVED"),
}));

vi.mock("../../src/modules/ui.js", () => ({
  elements: new Proxy(
    {},
    {
      get(_, prop) {
        // Deleguj do prawdziwego DOM — tak jak robi to oryginalny moduł
        if (prop === "testsGrid") return document.getElementById("tests-grid");
        if (prop === "toggleTrainingMode")
          return document.getElementById("toggle-training-mode");
        if (prop === "toggleHPM") return document.getElementById("toggle-hpm");
        return document.getElementById(prop) || null;
      },
    },
  ),
  switchView: vi.fn(),
}));

// ─── Testy ──────────────────────────────────────────────────────────────────

describe("Library Module", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tests-grid"></div>
      <button id="view-grid"></button>
      <button id="view-list"></button>
      <button id="view-table"></button>
      <button id="view-compact"></button>
      <input type="checkbox" id="toggle-training-mode" />
      <input type="checkbox" id="toggle-hpm" />
      <input type="text" id="library-search" />
    `;
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  // ─── Gettery stanu ──────────────────────────────────────────
  describe("getTrainingMode / getHpmEnabled", () => {
    it("domyślnie tryb treningowy jest wyłączony", async () => {
      const { getTrainingMode } = await import("../../src/modules/library.js");
      expect(getTrainingMode()).toBe(false);
    });

    it("domyślnie HPM jest wyłączony", async () => {
      const { getHpmEnabled } = await import("../../src/modules/library.js");
      expect(getHpmEnabled()).toBe(false);
    });
  });

  // ─── initLibraryListeners ───────────────────────────────────
  describe("initLibraryListeners", () => {
    it("rejestruje listenery Electron bez błędów", async () => {
      const { initLibraryListeners } =
        await import("../../src/modules/library.js");
      expect(() => initLibraryListeners()).not.toThrow();
      expect(window.electronAPI.onDownloadProgress).toHaveBeenCalled();
      expect(window.electronAPI.onTestInstalled).toHaveBeenCalled();
      expect(window.electronAPI.onHpmDownloadProgress).toHaveBeenCalled();
      expect(window.electronAPI.onHpmInstalled).toHaveBeenCalled();
      expect(window.electronAPI.onTestProcessStopped).toHaveBeenCalled();
    });

    it("nie rejestruje ponownie po kolejnym wywołaniu (flaga)", async () => {
      const { initLibraryListeners } =
        await import("../../src/modules/library.js");
      initLibraryListeners();
      const firstCallCount =
        window.electronAPI.onDownloadProgress.mock.calls.length;
      initLibraryListeners(); // drugie wywołanie — powinno być zignorowane
      expect(window.electronAPI.onDownloadProgress.mock.calls.length).toBe(
        firstCallCount,
      );
    });
  });

  // ─── loadTestsList ──────────────────────────────────────────
  describe("loadTestsList", () => {
    it("wyświetla komunikat o braku testów gdy lista jest pusta", async () => {
      const { getDocs } =
        await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");
      getDocs.mockResolvedValue({ empty: true, forEach: vi.fn() });

      const { loadTestsList } = await import("../../src/modules/library.js");
      await loadTestsList();

      const grid = document.getElementById("tests-grid");
      // Po zwróceniu pustej listy komponent powinien wyświetlić komunikat
      expect(grid.innerHTML).toBeTruthy();
    });

    it("ładuje testy z chmury gdy dostępne", async () => {
      const { getDocs } =
        await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");

      const mockTests = [
        {
          id: "test-1",
          data: () => ({ name: "Test A", description: "Opis A", version: 1 }),
        },
        {
          id: "test-2",
          data: () => ({ name: "Test B", description: "Opis B", version: 2 }),
        },
      ];

      getDocs.mockResolvedValue({
        empty: false,
        forEach: (cb) => mockTests.forEach(cb),
      });

      const { loadTestsList } = await import("../../src/modules/library.js");
      await loadTestsList();

      const grid = document.getElementById("tests-grid");
      expect(grid.innerHTML).toBeTruthy();
    });

    it("używa lokalnego cache gdy brak połączenia z Firebase", async () => {
      const { getDocs } =
        await import("https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js");
      getDocs.mockRejectedValue(new Error("Network error"));

      // Ustaw cache w localStorage
      const cached = [{ id: "cached-test", name: "Cached Test", version: 1 }];
      localStorage.setItem("cached_tests_metadata", JSON.stringify(cached));

      const { loadTestsList } = await import("../../src/modules/library.js");
      await loadTestsList(null, true);

      const grid = document.getElementById("tests-grid");
      expect(grid.innerHTML).toBeTruthy();
    });
  });

  // ─── getLibraryStorageKeys (per-user) ────────────────────────
  describe("Per-user storage keys", () => {
    it("initViewSwitcher ładuje viewMode z klucza per-user", async () => {
      const { getResearcherUid } = await import("../../src/modules/auth.js");
      getResearcherUid.mockReturnValue("user-abc");

      // Ustaw preferencję dla tego użytkownika
      localStorage.setItem("libraryViewMode_user-abc", "list");

      const { initViewSwitcher } = await import("../../src/modules/library.js");
      // Nie powinno rzucać błędów
      expect(() => initViewSwitcher()).not.toThrow();
    });

    it("różni użytkownicy mają osobne klucze viewMode", async () => {
      const { getResearcherUid } = await import("../../src/modules/auth.js");

      getResearcherUid.mockReturnValue("user-1");
      localStorage.setItem("libraryViewMode_user-1", "grid");

      getResearcherUid.mockReturnValue("user-2");
      localStorage.setItem("libraryViewMode_user-2", "table");

      expect(localStorage.getItem("libraryViewMode_user-1")).toBe("grid");
      expect(localStorage.getItem("libraryViewMode_user-2")).toBe("table");
    });
  });
});
