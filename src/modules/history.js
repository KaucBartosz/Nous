import {
  getAllResults,
  claimGuestResult,
  checkResultExists,
  saveResult,
  deleteResults,
} from "./database.js";
import { db as firebaseDb } from "../firebaseConfig.js";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { getCurrentUser, getUserStatus, getResearcherUid } from "./auth.js";
import { elements } from "./ui.js";
import { syncSingleResult } from "./sync.js";
import { Notify } from "../notify/notify.js";
import { decryptCloudData, hasCloudKey } from "./cryptoService.js";
import {
  hasActiveFilters,
  filterResults,
  paginate,
} from "../results/historyQuery.js";
import {
  exportHistoryToCSV as exportViewToCSV,
  downloadSingleResult as downloadSingle,
  beginDownloadButton,
  selectedDownloadFormat,
  downloadButtonPrefix,
} from "../history/historyExport.js";
import {
  buildLocalKeys,
  isAlreadyImported,
  cloudRecordToLocal,
  decryptCloudRecords,
  importPreparedList,
  prepareGuestImport,
} from "../results/cloudResults.js";
import { canUploadResult } from "../session/session.js";
import {
  PAGE_SIZE,
  CLOUD_FETCH_THROTTLE_MS,
  createHistoryState,
  resetHistoryFilters,
} from "../history/historyState.js";
import { createFilterUi } from "../history/historyFilters.js";
import {
  emptyMessage,
  refreshDownloadButtons,
  renderHistoryRows,
  renderPagination,
} from "../history/historyTable.js";
import { getPlatform } from "../platform/index.js";

// Jeden stan widoku (mutowany tylko przez orkiestrator + fabryki UI).
const state = createHistoryState();

// UI filtrów: dane ze stanu, decyzje z orkiestratora (applyFilters poniżej).
const filterUi = createFilterUi({
  getResults: () => state.allResults,
  getFilters: () => state.filters,
  applyFilters: () => applyFilters(),
});

export function initHistoryView() {
  document
    .getElementById("selectAllHistory")
    ?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const checkboxes = document.querySelectorAll(".result-checkbox");
      checkboxes.forEach((cb) => {
        cb.checked = checked;
        if (checked) {
          state.selectedIds.add(cb.dataset.id);
        } else {
          state.selectedIds.delete(cb.dataset.id);
        }
      });
      updateDownloadButtonState();
    });

  document
    .getElementById("btn-local-delete-selected")
    ?.addEventListener("click", handleDeleteSelected);
  document
    .getElementById("btn-guest-delete-selected")
    ?.addEventListener("click", handleDeleteSelected);

  if (elements.btnToggleGuestView) {
    elements.btnToggleGuestView.addEventListener("click", () => {
      state.guestView = !state.guestView;
      state.cloudView = false;
      updateToggleButtonsState();
      loadHistoryData();
    });
  }

  if (elements.btnToggleCloudView) {
    elements.btnToggleCloudView.addEventListener("click", () => {
      state.cloudView = !state.cloudView;
      state.guestView = false;
      updateToggleButtonsState();
      loadHistoryData();
    });
  }

  if (elements.btnCloudImportAll)
    elements.btnCloudImportAll.onclick = handleImportAll;
  if (elements.btnCloudDownloadAll)
    elements.btnCloudDownloadAll.onclick = handleDownloadAll;
  if (elements.btnGuestImportAll)
    elements.btnGuestImportAll.onclick = handleImportGuestResults;
  if (elements.btnGuestDownloadAll)
    elements.btnGuestDownloadAll.onclick = () =>
      handleDownloadAllLocal("GUEST");
  if (elements.btnLocalDownloadAll)
    elements.btnLocalDownloadAll.onclick = () => {
      const uid = getResearcherUid();
      handleDownloadAllLocal(uid);
    };

  updateToggleButtonsState();

  // Filtry: przyciski, zamykanie, czyszczenie (logika w historyFilters.js)
  filterUi.bind({ onClear: clearAllFilters });
}

function clearAllFilters() {
  resetHistoryFilters(state);
  filterUi.close();
  filterUi.refreshBadges();
  state.page = 1;
  state.selectedIds.clear();
  const selectAll = document.getElementById('selectAllHistory');
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();
  renderHistoryPage();
}

// (logika dropdownów/filtrów: ../history/historyFilters.js)

// (buildFilterValues: ../history/historyFilters.js)

// (renderFilterOptions: ../history/historyFilters.js)

function updateToggleButtonsState() {
  // Reset filters when switching views
  resetHistoryFilters(state);
  filterUi.close();
  filterUi.refreshBadges();

  state.selectedIds.clear();
  const selectAll = document.getElementById("selectAllHistory");
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();

  elements.cloudActionsContainer?.classList.add("hidden");
  elements.guestActionsContainer?.classList.add("hidden");
  elements.localActionsContainer?.classList.add("hidden");

  if (state.cloudView) {
    elements.cloudActionsContainer?.classList.remove("hidden");
    if (elements.btnToggleGuestView) {
      elements.btnToggleGuestView.classList.remove("active");
      elements.btnToggleGuestView.innerHTML =
        '<span class="material-icons">no_accounts</span> Pokaż wyniki Gościa';
    }
    if (elements.btnToggleCloudView) {
      elements.btnToggleCloudView.classList.add("active");
      elements.btnToggleCloudView.innerHTML =
        '<span class="material-icons">storage</span> Pokaż wyniki Lokalne';
    }
  } else if (state.guestView) {
    elements.guestActionsContainer?.classList.remove("hidden");
    if (elements.btnToggleGuestView) {
      elements.btnToggleGuestView.classList.add("active");
      elements.btnToggleGuestView.innerHTML =
        '<span class="material-icons">person</span> Pokaż moje wyniki';
    }
    if (elements.btnToggleCloudView) {
      elements.btnToggleCloudView.classList.remove("active");
      elements.btnToggleCloudView.innerHTML =
        '<span class="material-icons">cloud_queue</span> Moje wyniki z bazy';
    }
  } else {
    elements.localActionsContainer?.classList.remove("hidden");
    if (elements.btnToggleGuestView) {
      elements.btnToggleGuestView.classList.remove("active");
      elements.btnToggleGuestView.innerHTML =
        '<span class="material-icons">no_accounts</span> Pokaż wyniki Gościa';
    }
    if (elements.btnToggleCloudView) {
      elements.btnToggleCloudView.classList.remove("active");
      elements.btnToggleCloudView.innerHTML =
        '<span class="material-icons">cloud_queue</span> Moje wyniki z bazy';
    }
  }
}

export async function loadHistoryData() {
  updateToggleButtonsState();
  elements.historyTableBody.innerHTML =
    '<tr><td colspan="6">Ładowanie...</td></tr>';
  const user = getCurrentUser();

  const userStatus = getUserStatus();
  const isLocalAccount = userStatus === "LOCAL";

  if (elements.btnToggleGuestView) {
    // Konta lokalne i GUEST nie mają dostępu do podglądu wyników Gościa ani chmury
    if (user && !isLocalAccount) {
      elements.btnToggleGuestView.classList.remove("hidden");
      elements.btnToggleCloudView?.classList.remove("hidden");
    } else {
      elements.btnToggleGuestView.classList.add("hidden");
      elements.btnToggleCloudView?.classList.add("hidden");
      state.guestView = false;
      state.cloudView = false;
    }
  }

  if (state.cloudView) {
    return loadCloudResults();
  }

  // Ustal targetUid uwzględniając konta lokalne (LOCAL::username)
  let targetUid = getResearcherUid();
  if (user && state.guestView) {
    targetUid = "GUEST";
  }

  try {
    const allResults = await getAllResults();

    const myResults = allResults
      .filter((r) => r.researcher_uid === targetUid)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Store for pagination
    state.allResults = myResults;
    state.page = 1;
    // Reset filters on data reload
    resetHistoryFilters(state);
    filterUi.refreshBadges();
    renderHistoryPage();
  } catch (e) {
    console.error("Error loading history:", e);
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.color = "#f44336";
    if (e.message && e.message.includes("decrypt")) {
      td.textContent =
        "Błąd odczytu danych: Problem z deszyfrowaniem. Sprawdź klucz szyfrowania.";
    } else {
      td.textContent = `Błąd: ${e.message}`;
    }
    tr.appendChild(td);
    elements.historyTableBody.appendChild(tr);
  }
}

// ===================================================
// SELECTION & DELETION
// ===================================================

function updateDownloadButtonState() {
  refreshDownloadButtons({
    count: state.selectedIds.size,
    hasFilters: hasActiveFilters(state.filters),
    filteredCount: getFilteredResults().length,
    guestView: state.guestView,
    cloudView: state.cloudView,
  });
}

function handleCheckboxChange(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
    const selectAll = document.getElementById("selectAllHistory");
    if (selectAll) selectAll.checked = false;
  }
  updateDownloadButtonState();
}

async function handleDeleteSelected() {
  if (state.selectedIds.size === 0) return;

  const count = state.selectedIds.size;
  const choice = await Notify.custom(
    `Czy na pewno chcesz usunąć ${count} wyników testów z historii? Jest to proces nieodwracalny.`,
    [
      { label: "Tak, usuń", value: true, class: "btn danger" },
      { label: "Anuluj", value: false, class: "btn outline" },
    ],
  );

  if (!choice) return;

  try {
    await deleteResults(Array.from(state.selectedIds));
    await Notify.alert("Wyniki zostały pomyślnie usunięte.", "success");
    state.selectedIds.clear();
    const selectAll = document.getElementById("selectAllHistory");
    if (selectAll) selectAll.checked = false;
    updateDownloadButtonState();
    loadHistoryData();
  } catch (e) {
    await Notify.alert("Błąd podczas usuwania: " + e.message, "error");
  }
}

// ===================================================
// FILTERING
// ===================================================

function applyFilters() {
  state.page = 1;
  state.selectedIds.clear();
  const selectAll = document.getElementById('selectAllHistory');
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();
  renderHistoryPage();
}

function getFilteredResults() {
  // C3: czysty query-model (logika w results/historyQuery.js)
  return filterResults(state.allResults, state.filters);
}

// (updateFilterBadges: ../history/historyFilters.js — wołane przez filterUi.refreshBadges())

// ===================================================
// PAGINATION
// ===================================================

function renderHistoryPage() {
  const tbody = elements.historyTableBody;
  tbody.innerHTML = "";
  const selectAll = document.getElementById("selectAllHistory");
  if (selectAll) selectAll.checked = false;

  const filteredResults = getFilteredResults();
  const user = getCurrentUser();
  const researcherUid = getResearcherUid();

  // C3: stronicowanie w query-modelu + kontrolki w historyTable.js
  const { items: pageResults, totalPages } = paginate(filteredResults, state.page, PAGE_SIZE);
  renderPagination({
    page: state.page,
    totalPages,
    totalItems: filteredResults.length,
    onPage: (p) => {
      state.page = p;
      renderHistoryPage();
    },
  });

  if (filteredResults.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = emptyMessage({
      guestView: state.guestView,
      hasFilters: hasActiveFilters(state.filters),
    });
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // CLAIMS MODE: tylko zalogowani online mogą przejmować wyniki Gościa.
  const claim =
    state.guestView && user && researcherUid === user.uid
      ? { userUid: user.uid, onClaim: handleClaimResult }
      : null;

  renderHistoryRows(tbody, pageResults, {
    selectedIds: state.selectedIds,
    claim,
    canUpload: canUploadResult(getUserStatus()),
    onCheck: handleCheckboxChange,
    syncRecord: (r) => syncSingleResult(r),
    onSyncError: async (err) => {
      await Notify.alert("Błąd wysyłania: " + err.message, "error");
      loadHistoryData();
    },
    onDownload: downloadSingle,
  });
}

// (renderHistoryPage: orkiestrator powyżej; wiersze + paginacja w ../history/historyTable.js)

// ===================================================
// CLAIMS / HISTORY HELPERS
// ===================================================

async function handleClaimResult(result, userUid) {
  const choice = await Notify.custom(
    "Czy chcesz przenieść ten wynik (zniknie z konta Gościa) czy skopiować (zostanie na koncie Gościa)?",
    [
      { label: "Przenieś (Wytnij)", value: "move", class: "btn primary" },
      { label: "Kopiuj (Duplikuj)", value: "copy", class: "btn secondary" },
      { label: "Anuluj", value: false, class: "btn outline" },
    ],
  );

  if (!choice) return;

  try {
    const keepOriginal = choice === "copy";
    await claimGuestResult(result, userUid, keepOriginal);
    await Notify.alert(
      "Wynik został pomyślnie przypisany do Twojego konta!",
      "success",
    );
    loadHistoryData();
  } catch (e) {
    await Notify.alert(
      "Błąd podczas przejmowania wyniku: " + e.message,
      "error",
    );
  }
}

// Pobranie pojedynczego wyniku + CSV: ../history/historyExport.js (downloadSingle).

// ===================================================
// CLOUD RESULTS
// ===================================================

async function loadCloudResults() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  if (now - state.lastCloudFetch < CLOUD_FETCH_THROTTLE_MS) {
    if (state.cloudResults.length > 0) {
      return renderCloudResultsTable(state.cloudResults);
    }
    return;
  }
  state.lastCloudFetch = now;

  elements.historyTableBody.innerHTML =
    '<tr><td colspan="6">Pobieranie danych z chmury...</td></tr>';

  try {
    const q = query(
      collection(firebaseDb, "results"),
      where("researcher_uid", "==", user.uid),
      orderBy("timestamp", "desc"),
    );

    const snap = await getDocs(q);
    // C3: deszyfracja równoległa w results/cloudResults.js (kolejność zachowana)
    state.cloudResults = await decryptCloudRecords(
      snap.docs.map((docSnap) => ({ ...docSnap.data(), firestore_id: docSnap.id })),
      { hasKey: hasCloudKey, decrypt: decryptCloudData },
    );

    await renderCloudResultsTable(state.cloudResults);
  } catch (e) {
    console.error("Cloud Fetch Error:", e);
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.color = "red";
    td.textContent = `Błąd pobierania: ${e.message}`;
    tr.appendChild(td);
    elements.historyTableBody.appendChild(tr);
  }
}

async function renderCloudResultsTable(results) {
  elements.historyTableBody.innerHTML = "";
  const selectAll = document.getElementById("selectAllHistory");
  if (selectAll) selectAll.checked = false;

  // Hide pagination in cloud view
  const paginationContainer = document.getElementById("history-pagination");
  if (paginationContainer) paginationContainer.style.display = "none";

  if (results.length === 0) {
    elements.historyTableBody.innerHTML =
      '<tr><td colspan="7">Brak wyników w chmurze dla Twojego konta.</td></tr>';
    return;
  }

  // C3: klucze już-zaimportowanych w results/cloudResults.js
  const localResults = await getAllResults();
  const localKeys = buildLocalKeys(localResults);

  results.forEach((data) => {
    const row = document.createElement("tr");

    const tdCheckbox = document.createElement("td");
    tdCheckbox.style.textAlign = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "result-checkbox";
    cb.dataset.id = data.firestore_id || data.id;
    cb.checked = state.selectedIds.has(cb.dataset.id);
    cb.addEventListener("change", handleCheckboxChange);
    tdCheckbox.appendChild(cb);
    row.appendChild(tdCheckbox);

    const tdDate = document.createElement("td");
    tdDate.textContent = new Date(data.timestamp).toLocaleString();
    row.appendChild(tdDate);

    const tdTestId = document.createElement("td");
    tdTestId.textContent = data.test_id;
    row.appendChild(tdTestId);

    const tdPatient = document.createElement("td");
    tdPatient.textContent = data.subject_id || "-";
    row.appendChild(tdPatient);

    const tdScore = document.createElement("td");
    const resVal = data.data || {};
    const scoreText = resVal.czas_reakcji
      ? `${resVal.czas_reakcji} ms`
      : resVal.score || "Data";
    const strongScore = document.createElement("strong");
    strongScore.textContent = scoreText;
    tdScore.appendChild(strongScore);
    row.appendChild(tdScore);

    const tdStatus = document.createElement("td");
    tdStatus.style.textAlign = "center";

    // C3: decyzja zaimportowany/nowy w results/cloudResults.js
    const alreadyExists = isAlreadyImported(data, localKeys);

    if (alreadyExists) {
      const statusBox = document.createElement("div");
      statusBox.className = "cloud-status-ok";
      statusBox.innerHTML =
        '<span class="material-icons" style="font-size:16px;">check_circle</span> Wynik już znajduje się na urządzeniu';
      tdStatus.appendChild(statusBox);
    } else {
      const btnImport = document.createElement("button");
      btnImport.className = "btn small primary";
      btnImport.innerHTML =
        '<span class="material-icons" style="font-size:14px; vertical-align:middle; margin-right:4px;">input</span> Importuj';
      btnImport.onclick = (e) => {
        e.stopPropagation();
        handleImportResult(data);
      };
      tdStatus.appendChild(btnImport);
    }
    row.appendChild(tdStatus);

    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "center";

    const btnDl = document.createElement("button");
    btnDl.className = "icon-btn";
    btnDl.innerHTML =
      '<span class="material-icons" style="font-size:18px;">download</span>';
    btnDl.onclick = () => {
      const formatted = { ...data, wyniki: data.data };
      downloadSingle(formatted);
    };
    tdAction.appendChild(btnDl);
    row.appendChild(tdAction);

    elements.historyTableBody.appendChild(row);
  });
}

async function handleImportResult(cloudResult) {
  try {
    const exists = await checkResultExists(
      cloudResult.firestore_id,
      cloudResult.timestamp,
      cloudResult.test_id,
      cloudResult.subject_id,
    );

    if (exists) {
      Notify.alert(
        "Ten wynik znajduje się już w Twojej lokalnej bazie danych.",
        "info",
      );
      return;
    }

    const user = getCurrentUser();
    const localData = cloudRecordToLocal(cloudResult, user.uid);

    await saveResult(localData, user.uid);
    Notify.alert("Wynik został zaimportowany!", "success");
    renderCloudResultsTable(state.cloudResults);
  } catch (e) {
    Notify.alert("Błąd importu: " + e.message, "error");
  }
}

async function handleImportAll() {
  if (state.cloudResults.length === 0) return;

  const user = getCurrentUser();

  try {
    // C3: klucze + mapowanie w results/cloudResults.js, zapis równoległy
    const localResults = await getAllResults();
    const localKeys = buildLocalKeys(localResults);

    const toImport = state.cloudResults.filter(
      (cloudResult) => !isAlreadyImported(cloudResult, localKeys),
    );
    const skipped = state.cloudResults.length - toImport.length;
    const count = await importPreparedList(
      toImport.map((cloudResult) => cloudRecordToLocal(cloudResult, user.uid)),
      user.uid,
      saveResult,
    );

    Notify.alert(
      `Import zakończony. Dodano: ${count}, Pominięto (duplikaty): ${skipped}`,
      "success",
    );
    renderCloudResultsTable(state.cloudResults);
  } catch (e) {
    Notify.alert("Błąd masowego importu: " + e.message, "error");
  }
}

async function handleDownloadAll() {
  if (state.cloudResults.length === 0) return;

  const format = selectedDownloadFormat();
  // F3a: choreografia przycisku w historyExport (1 reguła zamiast kopii).
  // `dl` przed try: const w bloku try nie widać w finally (osobny scope).
  let dl = null;
  try {
    dl = beginDownloadButton(
      {
        button: "btn-cloud-download-all",
        text: "btn-cloud-download-text",
        progress: "btn-cloud-download-progress",
      },
      "Pobieranie wyników...",
    );
    if (!dl) return;
    dl.progress("50%");

    let resultsToDownload = state.cloudResults;
    if (state.selectedIds.size > 0) {
      resultsToDownload = state.cloudResults.filter(
        (r) =>
          state.selectedIds.has(r.firestore_id) || state.selectedIds.has(r.id),
      );
    }

    // Downloads selected or ALL cloud results (pagination does not affect this)
    const result = await getPlatform().files.bulkZip({
      results: resultsToDownload,
      filename: filename,
      format: format,
    });

    if (result.success) {
      dl.progress("100%");
      setTimeout(
        () => Notify.alert("Archiwum ZIP zostało wygenerowane!", "success"),
        500,
      );
    } else if (!result.cancelled) {
      Notify.alert("Błąd podczas generowania ZIP: " + result.error, "error");
    }
  } catch (e) {
    Notify.alert("Wystąpił nieoczekiwany błąd: " + e.message, "error");
  } finally {
    dl?.restore();
  }
}

async function handleImportGuestResults() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const allLocal = await getAllResults();
    const guestResults = allLocal.filter((r) => r.researcher_uid === "GUEST");

    if (guestResults.length === 0) {
      Notify.alert("Brak wyników Gościa do zaimportowania.", "info");
      return;
    }

    const choice = await Notify.custom(
      `Znaleziono ${guestResults.length} wyników Gościa. Czy chcesz je przenieść na swoje konto (znikną z konta Gościa) czy duplikować?`,
      [
        { label: "Przenieś", value: "move", class: "btn primary" },
        { label: "Duplikuj", value: "duplicate", class: "btn secondary" },
        { label: "Anuluj", value: "cancel", class: "btn outline" },
      ],
    );

    if (!choice || choice === "cancel") return;

    // C3: przygotowanie move/duplicate w results/cloudResults.js, zapis równoległy
    const syncCount = await importPreparedList(
      prepareGuestImport(guestResults, user.uid, choice),
      user.uid,
      saveResult,
    );

    Notify.alert(
      `Zakończono! ${choice === "move" ? "Przeniesiono" : "Zduplikowano"} ${syncCount} wyników.`,
      "success",
    );
    loadHistoryData();
  } catch (e) {
    Notify.alert("Błąd importu: " + e.message, "error");
  }
}

async function handleDownloadAllLocal(targetUid) {
  // `dl` przed try: const w bloku try nie widać w finally (osobny scope).
  let dl = null;
  try {
    // Downloads ALL results for the user (not just current page)
    const allLocal = await getAllResults();
    let results = allLocal.filter((r) => r.researcher_uid === targetUid);

    // Apply filters if active (C3: query-model)
    if (hasActiveFilters(state.filters)) {
      results = filterResults(results, state.filters);
    }

    if (state.selectedIds.size > 0) {
      results = results.filter(
        (r) =>
          state.selectedIds.has(r.id) || state.selectedIds.has(r.firestore_id),
      );
    }

    if (results.length === 0) {
      Notify.alert("Brak wyników do pobrania.", "info");
      return;
    }

    const isGuest = targetUid === "GUEST";

    // Wybierz prefix na podstawie WIDOCZNEGO kontenera, nie typu użytkownika
    // GUEST widzi local-actions-container, nie guest-actions-container
    const prefix = downloadButtonPrefix({
      cloudHidden: elements.cloudActionsContainer?.classList.contains("hidden"),
      guestHidden: elements.guestActionsContainer?.classList.contains("hidden"),
    });

    // F3a: choreografia przycisku w historyExport (1 reguła zamiast kopii).
    dl = beginDownloadButton(
      {
        button: `btn-${prefix}-download-all`,
        text: `btn-${prefix}-download-text`,
        progress: `btn-${prefix}-download-progress`,
      },
      "Pobieranie...",
    );
    if (!dl) return;
    dl.progress("30%");

    const format = selectedDownloadFormat();
    const filename = `Wyniki_${isGuest ? "Gosc" : "Uzytkownik"}_${Date.now()}.zip`;

    const result = await getPlatform().files.bulkZip({
      results,
      filename,
      format,
    });

    if (result.success) {
      dl.progress("100%");
    } else if (!result.cancelled) {
      Notify.alert("Błąd ZIP: " + result.error, "error");
    }
  } catch (e) {
    Notify.alert("Błąd: " + e.message, "error");
  } finally {
    // Poprawka: przycisk wraca też po wyjątku (wcześniej zostawał wisy).
    dl?.restore();
  }
}

// CSV bieżącego widoku: ../history/historyExport.js (F3a: format z danych,
// nie ze scrapowania DOM — ta sama reguła co wcześniej).
export function exportHistoryToCSV() {
  exportViewToCSV({
    all: state.allResults,
    filters: state.filters,
    page: state.page,
    pageSize: PAGE_SIZE,
  });
}
