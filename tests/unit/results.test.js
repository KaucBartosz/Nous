import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock auth module
vi.mock("../../src/modules/auth.js", () => ({
  getCurrentUser: vi.fn(),
  getResearcherUid: vi.fn(() => "user-123"),
  getUserStatus: vi.fn(() => "APPROVED"),
}));

// Mock UI module
const mockCloseListener = vi.fn();
const mockDiscardListener = vi.fn();
const mockUploadListener = vi.fn();

vi.mock("../../src/modules/ui.js", () => ({
  elements: {
    btnCloseModal: { addEventListener: mockCloseListener },
    btnDiscard: {
      addEventListener: mockDiscardListener,
      classList: { add: vi.fn(), remove: vi.fn() },
    },
    btnUploadCloud: {
      addEventListener: mockUploadListener,
      textContent: "",
      disabled: false,
    },
    modalOverlay: { classList: { add: vi.fn(), remove: vi.fn() } },
    modalHeaderTitle: { textContent: "" },
    normalResultsContent: { classList: { add: vi.fn(), remove: vi.fn() } },
    modalUploadInfo: { innerHTML: "" },
  },
}));

// Mock demographics module
vi.mock("../../src/modules/demographics.js", () => ({
  getActiveDemographics: vi.fn(),
}));

// Mock database module
vi.mock("../../src/modules/database.js", () => ({
  saveResult: vi.fn(),
}));

// Mock sync module
vi.mock("../../src/modules/sync.js", () => ({
  syncNow: vi.fn(),
}));

// Mock Dialog
vi.mock("../../src/modules/dialog.js", () => ({
  Dialog: {
    alert: vi.fn(),
  },
}));

// Mock library module
vi.mock("../../src/modules/library.js", () => ({
  loadTestsList: vi.fn(),
  getTrainingMode: vi.fn(),
  consumePendingTrainingRun: vi.fn(() => null),
}));

// Mock notify (toast treningowy)
vi.mock("../../src/notify/notify.js", () => ({
  Notify: { error: vi.fn(), info: vi.fn(), toast: vi.fn() },
}));

// Mock utils module
vi.mock("../../src/modules/utils.js", () => ({
  escapeHtml: vi.fn((str) => str),
}));

// ==========================================================
// Results Tests
// ==========================================================
describe("Results Module", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup DOM elements expected by renderExtendedResults
    document.body.innerHTML = `
      <div id="modal-extended-results"></div>
    `;

    // Mock window.electronAPI
    window.electronAPI = {
      onTestResults: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("initResultsHandler", () => {
    it("registers onTestResults listener and DOM event listeners", async () => {
      const { initResultsHandler } =
        await import("../../src/modules/results.js");

      initResultsHandler();

      // Verify listeners
      expect(window.electronAPI.onTestResults).toHaveBeenCalled();
      expect(mockCloseListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      expect(mockDiscardListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
      // Zapis w systemie (Local -> Cloud)
      expect(mockUploadListener).toHaveBeenCalledWith(
        "click",
        expect.any(Function),
      );
    });

    it("processes generic test results correctly (opens modal)", async () => {
      const { initResultsHandler } =
        await import("../../src/modules/results.js");
      const { elements } = await import("../../src/modules/ui.js");
      const { getTrainingMode } = await import("../../src/modules/library.js");
      const { getCurrentUser } = await import("../../src/modules/auth.js");
      const { getActiveDemographics } =
        await import("../../src/modules/demographics.js");

      getTrainingMode.mockReturnValue(false);
      const { consumePendingTrainingRun } = await import("../../src/modules/library.js");
      consumePendingTrainingRun.mockReturnValue(null);
      getCurrentUser.mockReturnValue({ uid: "user-123" });
      const { getResearcherUid, getUserStatus } =
        await import("../../src/modules/auth.js");
      getResearcherUid.mockReturnValue("user-123");
      getUserStatus.mockReturnValue("APPROVED");
      getActiveDemographics.mockReturnValue({ participant_id: "P001" });

      initResultsHandler();

      // Wyciągnij wyrenderowany callback i wywołaj go
      const callback = window.electronAPI.onTestResults.mock.calls[0][0];

      const testData = {
        testId: "test-123",
        subjectId: "participant",
        ilosc_poprawnych_nacisniec: 10,
        sredni_czas_reakcji: 350,
      };

      callback(testData);

      // Verify that modal was configured for normal results
      expect(elements.modalHeaderTitle.textContent).toBe("Badanie Zakończone");
      expect(
        elements.normalResultsContent.classList.remove,
      ).toHaveBeenCalledWith("hidden");
      expect(elements.modalOverlay.classList.remove).toHaveBeenCalledWith(
        "hidden",
      );

      // Verify the DOM was updated with extended results
      const resultsContainer = document.getElementById(
        "modal-extended-results",
      );
      expect(resultsContainer.innerHTML).toContain("Poprawne");
      expect(resultsContainer.innerHTML).toContain("10");
      expect(resultsContainer.innerHTML).toContain("Śr. RT");
      expect(resultsContainer.innerHTML).toContain("350 ms");
    });

    it("processes training mode test results correctly (brak modala, toast, brak zapisu)", async () => {
      const { initResultsHandler } =
        await import("../../src/modules/results.js");
      const { loadTestsList, consumePendingTrainingRun } =
        await import("../../src/modules/library.js");
      const { Notify } = await import("../../src/notify/notify.js");
      const { saveResult } = await import("../../src/modules/database.js");
      const { elements } = await import("../../src/modules/ui.js");

      consumePendingTrainingRun.mockReturnValue(true);

      initResultsHandler();
      const callback = window.electronAPI.onTestResults.mock.calls[0][0];

      callback({ testId: "test-training" });

      // Brak modala decyzyjnego w treningu — tylko toast + powrót do listy
      expect(elements.modalOverlay.classList.remove).not.toHaveBeenCalledWith(
        "hidden",
      );
      expect(Notify.toast).toHaveBeenCalledWith(
        expect.objectContaining({ id: "training-no-save" }),
      );
      expect(loadTestsList).toHaveBeenCalled();
      expect(saveResult).not.toHaveBeenCalled();
    });

    it("displays error via Notify on invalid results data", async () => {
      const { initResultsHandler } =
        await import("../../src/modules/results.js");
      const { Notify } = await import("../../src/notify/notify.js");

      initResultsHandler();
      const callback = window.electronAPI.onTestResults.mock.calls[0][0];

      // Wywołanie z pusym nagłówkiem (nie obiekt)
      callback(null);

      // Ponieważ jest try-catch i w środku dynamiczny import, poczekajmy tick event loopa
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(Notify.error).toHaveBeenCalledWith(
        expect.stringContaining("Wyniki testu muszą być obiektem"),
      );
    });
  });

  describe("saveResultToSystem Action", () => {
    it("saves results to IndexedDB and triggers sync", async () => {
      const { initResultsHandler } =
        await import("../../src/modules/results.js");
      const { saveResult } = await import("../../src/modules/database.js");
      const { syncNow } = await import("../../src/modules/sync.js");
      const { loadTestsList, getTrainingMode } =
        await import("../../src/modules/library.js");
      const { getActiveDemographics } =
        await import("../../src/modules/demographics.js");
      const { getCurrentUser } = await import("../../src/modules/auth.js");

      const { consumePendingTrainingRun } = await import("../../src/modules/library.js");
      consumePendingTrainingRun.mockReturnValue(null);
      getTrainingMode.mockReturnValue(false);
      getActiveDemographics.mockReturnValue(null);
      getCurrentUser.mockReturnValue({ uid: "test-user-id" });
      const { getResearcherUid, getUserStatus } =
        await import("../../src/modules/auth.js");
      getResearcherUid.mockReturnValue("test-user-id");
      getUserStatus.mockReturnValue("APPROVED");
      saveResult.mockResolvedValue("test-id-123");

      initResultsHandler();

      // Symulacja przyjścia wyników
      const onTestResultsCb = window.electronAPI.onTestResults.mock.calls[0][0];
      onTestResultsCb({ testId: "test-123", subjectId: "123" });

      // Szukamy funkcji przypisanej do przycisku Zapisz w chmurze
      const saveActionCb = mockUploadListener.mock.calls[0][1];

      // Clear mocks to only track save action results
      vi.clearAllMocks();

      await saveActionCb();

      expect(saveResult).toHaveBeenCalled();
      expect(loadTestsList).toHaveBeenCalled();
      expect(syncNow).toHaveBeenCalled();
    });
  });
});
