// src/modules/results.js
import { getCurrentUser, getResearcherUid, getUserStatus } from "./auth.js";
import { elements } from "./ui.js";
import { getActiveDemographics } from "./demographics.js";
import { saveResult } from "./database.js";
import { syncNow } from "./sync.js";
import { Notify } from "../notify/notify.js";
import { loadTestsList, getTrainingMode, consumePendingTrainingRun } from "./library.js";
import { escapeHtml } from "./utils.js";
import { getPlatform } from "../platform/index.js";
import { savePipeline } from "../results/resultPipeline.js";
import { t } from "../i18n/index.js";

let currentResultPackage = null;

/**
 * Walidacja struktury danych wyników testu
 */
function validateTestResults(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error(t("results.validationMustBeObject"));
  }

  // Data is stored raw; sanitization happens at render time via textContent/escapeHtml
  return { ...raw };
}

export function initResultsHandler() {
  // C1: subskrypcja wyników przez seam — Electron słucha IPC,
  // Web słucha postMessage; moduł nie zna różnicy.
  getPlatform().tests.onResults((raw) => {
    console.log("Odebrano wyniki z testu. Przetwarzanie...");
    try {
      const validatedData = validateTestResults(raw);
      handleTestResults(validatedData);
    } catch (e) {
      console.error("Błąd walidacji wyników:", e);
      Notify.error(t("results.validationError", { message: e.message }));
    }
  });

  elements.btnCloseModal.addEventListener("click", () => {
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();
  });
  elements.btnDiscard.addEventListener("click", () => {
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();
  });

  elements.btnUploadCloud.addEventListener("click", saveResultToSystem);
}

function handleTestResults(raw) {
  // 1. Get Demographics
  const currentDemo = getActiveDemographics();

  // 2. Determine Participant ID
  let participantId = "GUEST";
  if (currentDemo && currentDemo.participant_id) {
    // Kartoteka Badanych nadpisuje ID Badanego nazwą profilu.
    participantId = currentDemo.participant_id;
  } else if (raw.subjectId) {
    // Brak kartoteki: ID badanego pochodzi z pola "participant" testu.
    participantId = raw.subjectId;
  }

  // 3. Build Package
  const researcherUid = getResearcherUid();
  const userStatus = getUserStatus();
  // Konta lokalne nie synchronizują do chmury — używamy statusu 'LOCAL'
  const defaultSyncStatus = userStatus === "LOCAL" ? "LOCAL" : "PENDING";

  currentResultPackage = {
    test_id: raw.testId || "test",
    timestamp: new Date().toISOString(),
    researcher_uid: researcherUid,
    subject_id: participantId,
    demographics: currentDemo,
    wyniki: raw,
    // Jedyna rola trainingu: nie zapisuj. Snapshot ze startu (run),
    // fallback do bieżącego toggla dla przepływów bez startRunProcess.
    isTraining: consumePendingTrainingRun() ?? getTrainingMode(),
    sync_status: defaultSyncStatus,
  };

  // Tryb treningowy: brak modala decyzyjnego, brak zapisu do Historii.
  // Tylko toast + powrót do listy.
  if (currentResultPackage.isTraining) {
    Notify.toast({
      id: "training-no-save",
      titleHtml: t("results.trainingModeTitle"),
      messageHtml: t("results.trainingNoSave"),
      autoDismissMs: 5000,
    });
    loadTestsList();
    return;
  }

  openModal(currentResultPackage);
}

function openModal(data) {
  elements.modalHeaderTitle.textContent = t("results.completed");
  elements.normalResultsContent.classList.remove("hidden");
  elements.btnDiscard.classList.remove("hidden");

  // Render Extended Results (Labels mapping)
  renderExtendedResults(data.wyniki);

  updateSaveButtonState();
  elements.modalOverlay.classList.remove("hidden");
}

/**
 * Renderuje kafelki z dodatkowymi wynikami (RT, poprawność itp.)
 */
function renderExtendedResults(wyniki) {
  const container = document.getElementById("modal-extended-results");
  if (!container) return;

  container.innerHTML = "";
  const fieldsToShow = [
    { key: "ilosc_poprawnych_nacisniec", label: t("results.correct") },
    { key: "ilosc_blednych_nacisniec", label: t("results.incorrect") },
    { key: "ogolna_ilosc_nacisniec", label: t("results.total") },
    { key: "sredni_czas_reakcji", label: t("results.avgRt"), unit: "ms" },
  ];

  fieldsToShow.forEach((f) => {
    const item = document.createElement("div");
    item.className = "result-item";

    const label = document.createElement("div");
    label.className = "result-label";
    label.textContent = f.label;

    const value = document.createElement("div");
    value.className = "result-value";

    if (wyniki[f.key] !== undefined && wyniki[f.key] !== null) {
      value.textContent = `${wyniki[f.key]}${f.unit ? " " + f.unit : ""}`;
    } else {
      value.textContent = t("results.notApplicable");
      value.style.fontSize = "14px"; // Mniejsza czcionka dla tekstu zastępczego
      value.style.opacity = "0.5";
    }

    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  });

  container.classList.remove("hidden");
}

function updateSaveButtonState() {
  elements.btnUploadCloud.disabled = false;
  elements.btnUploadCloud.textContent = t("results.saveAndClose");
  elements.modalUploadInfo.innerHTML = "";
}

async function saveResultToSystem() {
  if (!currentResultPackage) return;
  if (elements.btnUploadCloud.disabled) return;

  // Siatka bezpieczeństwa: trening nigdy nie zapisuje (modal treningowy
  // już nie istnieje, ale pakiet mógłby tu trafić starą ścieżką).
  if (currentResultPackage.isTraining) {
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();
    return;
  }

  try {
    elements.btnUploadCloud.disabled = true;
    elements.btnUploadCloud.textContent = t("results.saving");

    const currentUserId = getResearcherUid();

    // A6: zapis → eksport → sync w pipeline; UI tylko reaguje na wynik.
    const { csvDownloaded } = await savePipeline(currentResultPackage, {
      researcherUid: currentUserId,
      platformKind: getPlatform().kind,
      saveResult,
      syncNow,
      onSyncError: (err) => console.error("Sync after save failed:", err),
    });

    elements.btnUploadCloud.textContent = t("results.savedButton");
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();

    // Web: CSV pobiera się w tle — bez komunikatu użytkownik nie wie, że ma plik.
    if (csvDownloaded) {
      Notify.toast({
        id: "web-result-saved",
        titleHtml: t("results.savedToastTitle"),
        messageHtml: t("results.savedCsvHint"),
        autoDismissMs: 8000,
      });
    }
  } catch (e) {
    await Notify.error(t("results.saveDbError", { message: e.message }));
    elements.btnUploadCloud.textContent = t("results.errorShort");
  } finally {
    elements.btnUploadCloud.disabled = false;
  }
}
