// src/modules/results.js
import { getCurrentUser, getResearcherUid, getUserStatus } from "./auth.js";
import { elements } from "./ui.js";
import { getActiveDemographics } from "./demographics.js";
import { saveResult } from "./database.js";
import { syncNow } from "./sync.js";
import { Dialog } from "./dialog.js";
import { loadTestsList, getTrainingMode } from "./library.js";
import { escapeHtml } from "./utils.js";

let currentResultPackage = null;

/**
 * Walidacja struktury danych wyników testu
 */
function validateTestResults(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Wyniki testu muszą być obiektem");
  }

  // Data is stored raw; sanitization happens at render time via textContent/escapeHtml
  return { ...raw };
}

export function initResultsHandler() {
  if (window.electronAPI) {
    window.electronAPI.onTestResults((raw) => {
      console.log("Odebrano wyniki z testu. Przetwarzanie...");
      try {
        const validatedData = validateTestResults(raw);
        handleTestResults(validatedData);
      } catch (e) {
        console.error("Błąd walidacji wyników:", e);
        import("./dialog.js").then(({ Dialog }) => {
          Dialog.alert(`Błąd walidacji wyników testu: ${e.message}`, "error");
        });
      }
    });
  } else {
    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === "test-results") {
        console.log("Web: Odebrano wyniki z testu. Przetwarzanie...");
        try {
          const validatedData = validateTestResults(event.data.data);
          handleTestResults(validatedData);
        } catch (e) {
          console.error("Web: Błąd walidacji wyników:", e);
          import("./dialog.js").then(({ Dialog }) => {
            Dialog.alert(`Błąd walidacji wyników testu: ${e.message}`, "error");
          });
        }
      }
    });
  }

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
    participantId = currentDemo.participant_id;
  } else if (raw.subjectId && raw.subjectId !== "participant") {
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
    hpm_used: !!raw.__hpm_context, // Czy test faktycznie wykonał się w HPM
    researcher_uid: researcherUid,
    subject_id: participantId,
    demographics: currentDemo,
    wyniki: raw,
    isTraining: getTrainingMode(),
    sync_status: defaultSyncStatus,
  };

  openModal(currentResultPackage);
}

function openModal(data) {
  const isTraining = data.isTraining;

  if (isTraining) {
    elements.modalHeaderTitle.textContent =
      "Badanie Zakończone (Tryb treningowy)";
    elements.normalResultsContent.classList.add("hidden");
    elements.trainingResultsContent.classList.remove("hidden");
    elements.btnDiscard.classList.add("hidden");
  } else {
    elements.modalHeaderTitle.textContent = "Badanie Zakończone";
    elements.normalResultsContent.classList.remove("hidden");
    elements.trainingResultsContent.classList.add("hidden");
    elements.btnDiscard.classList.remove("hidden");

    // Render Extended Results (Labels mapping)
    renderExtendedResults(data.wyniki);
  }

  updateSaveButtonState(isTraining);
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
    { key: "ilosc_poprawnych_nacisniec", label: "Poprawne" },
    { key: "ilosc_blednych_nacisniec", label: "Błędne" },
    { key: "ogolna_ilosc_nacisniec", label: "Łącznie" },
    { key: "sredni_czas_reakcji", label: "Śr. RT", unit: "ms" },
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
      value.textContent = "Nie dotyczy";
      value.style.fontSize = "14px"; // Mniejsza czcionka dla tekstu zastępczego
      value.style.opacity = "0.5";
    }

    item.appendChild(label);
    item.appendChild(value);
    container.appendChild(item);
  });

  container.classList.remove("hidden");
}

function updateSaveButtonState(isTraining) {
  if (isTraining) {
    elements.btnUploadCloud.disabled = false;
    elements.btnUploadCloud.textContent = "Zamknij";
    elements.modalUploadInfo.innerHTML = "";
  } else {
    elements.btnUploadCloud.disabled = false;
    elements.btnUploadCloud.textContent = "Zapisz i Zamknij";
    elements.modalUploadInfo.innerHTML = "";
  }
}

async function saveResultToSystem() {
  if (!currentResultPackage) return;
  if (elements.btnUploadCloud.disabled) return;

  if (currentResultPackage.isTraining) {
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();
    return;
  }

  try {
    elements.btnUploadCloud.disabled = true;
    elements.btnUploadCloud.textContent = "Zapisywanie...";

    const currentUserId = getResearcherUid();

    await saveResult(currentResultPackage, currentUserId);

    if (!window.electronAPI) {
      generateWebResultCSV(currentResultPackage);
    }

    elements.btnUploadCloud.textContent = "Zapisano!";
    elements.modalOverlay.classList.add("hidden");
    loadTestsList();

    syncNow().catch(err => console.error("Sync after save failed:", err));
  } catch (e) {
    await Dialog.alert("Błąd zapisu bazy: " + e.message, "error");
    elements.btnUploadCloud.textContent = "Błąd";
  } finally {
    elements.btnUploadCloud.disabled = false;
  }
}

function generateWebResultCSV(pkg) {
  const flat = {};
  flat["Data"] = new Date(pkg.timestamp).toLocaleString();
  flat["Test ID"] = pkg.test_id;
  flat["ID Badanego"] = pkg.subject_id;

  if (pkg.demographics && pkg.demographics.data) {
    for (const [key, value] of Object.entries(pkg.demographics.data)) {
      flat[`Metryczka - ${key}`] = value;
    }
  }

  if (pkg.wyniki) {
    const ignoreKeys = ["testId", "subjectId", "timestamp", "test_id", "subject_id", "researcher_uid", "demographics", "__hpm_context"];
    for (const [key, value] of Object.entries(pkg.wyniki)) {
      if (!ignoreKeys.includes(key) && value !== undefined && value !== null) {
        flat[`Wynik - ${key}`] = value;
      }
    }
  }

  const bom = "\uFEFF";
  let csvContent = bom + "Parametr;Wartość\r\n";
  for (const [key, value] of Object.entries(flat)) {
    let valStr = String(value);
    if (valStr.includes(";") || valStr.includes("\n")) {
      valStr = `"${valStr.replace(/"/g, '""')}"`;
    }
    csvContent += `${key};${valStr}\r\n`;
  }

  const filename = `Wynik_${pkg.test_id}_${Date.now()}.csv`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
