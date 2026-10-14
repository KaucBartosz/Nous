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
import { testIdOf, subjectIdOf } from "../results/resultPackage.js";
import {
  resolveStatusLabel,
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
import { getPlatform } from "../platform/index.js";

// Jeden stan widoku (mutowany tylko przez orkiestrator + fabryki UI).
const state = createHistoryState();

let openFilterDropdown = null;

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

  // Filter button click handlers
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.dataset.filterType;
      if (openFilterDropdown && openFilterDropdown.dataset.filterType === type) {
        closeFilterDropdown();
      } else {
        openFilterDropdownFor(type, btn);
      }
    });
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (openFilterDropdown && !e.target.closest('.filter-dropdown') && !e.target.closest('.filter-btn')) {
      closeFilterDropdown();
    }
  });

  // Close dropdown on scroll (fixed position doesn't track button)
  document.addEventListener('scroll', () => {
    closeFilterDropdown();
  }, { capture: true });

  // Clear all filters button
  if (elements.btnClearAllFilters) {
    elements.btnClearAllFilters.addEventListener('click', clearAllFilters);
  }
}

function clearAllFilters() {
  resetHistoryFilters(state);
  closeFilterDropdown();
  updateFilterBadges();
  state.page = 1;
  state.selectedIds.clear();
  const selectAll = document.getElementById('selectAllHistory');
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();
  renderHistoryPage();
}

function updateClearFiltersBar() {
  const bar = document.getElementById('active-filters-bar');
  if (bar) {
    bar.classList.toggle('hidden', !hasActiveFilters(state.filters));
  }
}

function closeFilterDropdown() {
  if (openFilterDropdown) {
    openFilterDropdown.remove();
    openFilterDropdown = null;
  }
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
}

function openFilterDropdownFor(type, btn) {
  closeFilterDropdown();
  btn.classList.add('active');

  const dropdown = document.createElement('div');
  dropdown.className = 'filter-dropdown';
  dropdown.dataset.filterType = type;

  const label = btn.closest('th').querySelector('span').textContent;
  dropdown.innerHTML = `
    <div class="filter-dropdown-header">
      <span>${label}</span>
      <div class="filter-dropdown-actions">
        <button class="filter-select-all">Zaznacz wszystko</button>
        <button class="filter-deselect-all">Wyczyść</button>
      </div>
    </div>
    <div class="filter-dropdown-body"></div>
  `;

  const body = dropdown.querySelector('.filter-dropdown-body');
  const values = buildFilterValues(type);
  renderFilterOptions(body, type, values);

  // Attach to document.body with fixed positioning
  document.body.appendChild(dropdown);

  const rect = btn.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.style.left = `${rect.left}px`;

  // Ensure dropdown doesn't go off-screen right edge
  const dropdownWidth = 220;
  if (rect.left + dropdownWidth > window.innerWidth) {
    dropdown.style.left = `${window.innerWidth - dropdownWidth - 10}px`;
  }

  openFilterDropdown = dropdown;

  // Bind select all / deselect all
  dropdown.querySelector('.filter-select-all').addEventListener('click', () => {
    const cbAll = dropdown.querySelectorAll('.filter-option input[type="checkbox"]');
    cbAll.forEach(cb => { if (!cb.disabled) cb.checked = true; });
    applyFilters();
  });

  dropdown.querySelector('.filter-deselect-all').addEventListener('click', () => {
    const cbAll = dropdown.querySelectorAll('.filter-option input[type="checkbox"]');
    cbAll.forEach(cb => { if (!cb.disabled) cb.checked = false; });
    applyFilters();
  });
}

// Jedna funkcja licząca zamiast 3 kopii pętli
// (test_id/subject_id/status różniły się tylko wyciąganiem klucza).
function countBy(results, keyFn) {
  const counts = {};
  results.forEach(r => {
    const val = keyFn(r);
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
}

// (statusLabel usunięty w C3 — jedyny resolver: resolveStatusLabel w results/historyQuery.js)

function buildFilterValues(type) {
  const results = state.allResults;
  if (type === 'date') {
    // Build hierarchy: year -> month -> day
    const tree = {};
    results.forEach(r => {
      const d = new Date(r.timestamp);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const dateStr = `${String(day).padStart(2, '0')}.${String(month + 1).padStart(2, '0')}.${year}`;
      const monthName = d.toLocaleString('pl-PL', { month: 'long' });
      if (!tree[year]) tree[year] = {};
      if (!tree[year][month]) tree[year][month] = { name: monthName, days: {} };
      if (!tree[year][month].days[day]) tree[year][month].days[day] = { label: dateStr, count: 0 };
      tree[year][month].days[day].count++;
    });
    return tree;
  }
  if (type === 'test_id') {
    return countBy(results, testIdOf);
  }
  if (type === 'subject_id') {
    return countBy(results, subjectIdOf);
  }
  if (type === 'status') {
    return countBy(results, resolveStatusLabel);
  }
  return [];
}

function renderFilterOptions(body, type, values) {
  body.innerHTML = '';
  if (type === 'date') {
    // Hierarchical rendering
    const activeDates = state.filters.date;
    const years = Object.keys(values).sort((a, b) => b - a);
    years.forEach(year => {
      // Year option
      const yearDiv = document.createElement('div');
      yearDiv.className = 'filter-option filter-date-year';
      const yearCb = document.createElement('input');
      yearCb.type = 'checkbox';
      yearCb.value = `year:${year}`;
      yearCb.checked = Object.keys(values[year]).every(m =>
        Object.keys(values[year][m].days).every(d => activeDates.has(`day:${year}:${m}:${d}`))
      );
      yearDiv.appendChild(yearCb);
      yearDiv.appendChild(document.createTextNode(year));
      yearCb.addEventListener('change', () => {
        // Toggle all months and days for this year
        const allDaysForYear = [];
        Object.keys(values[year]).forEach(m => {
          Object.keys(values[year][m].days).forEach(d => {
            allDaysForYear.push(`day:${year}:${m}:${d}`);
          });
        });
        if (yearCb.checked) {
          allDaysForYear.forEach(k => state.filters.date.add(k));
        } else {
          allDaysForYear.forEach(k => state.filters.date.delete(k));
        }
        applyFilters();
        // Re-render to update parent checkboxes
        closeFilterDropdown();
        openFilterDropdownFor('date', document.querySelector('.filter-btn[data-filter-type="date"]'));
      });
      body.appendChild(yearDiv);

      // Months
      const months = Object.keys(values[year]).sort((a, b) => b - a);
      months.forEach(month => {
        const monthData = values[year][month];
        const monthDiv = document.createElement('div');
        monthDiv.className = 'filter-option filter-date-month';
        const monthCb = document.createElement('input');
        monthCb.type = 'checkbox';
        monthCb.value = `month:${year}:${month}`;
        monthCb.checked = Object.keys(monthData.days).every(d => activeDates.has(`day:${year}:${month}:${d}`));
        monthDiv.appendChild(monthCb);
        monthDiv.appendChild(document.createTextNode(monthData.name));
        monthCb.addEventListener('change', () => {
          const allDaysForMonth = Object.keys(monthData.days).map(d => `day:${year}:${month}:${d}`);
          if (monthCb.checked) {
            allDaysForMonth.forEach(k => state.filters.date.add(k));
          } else {
            allDaysForMonth.forEach(k => state.filters.date.delete(k));
          }
          applyFilters();
          closeFilterDropdown();
          openFilterDropdownFor('date', document.querySelector('.filter-btn[data-filter-type="date"]'));
        });
        body.appendChild(monthDiv);

        // Days
        const days = Object.keys(monthData.days).sort((a, b) => b - a);
        days.forEach(day => {
          const dayData = monthData.days[day];
          const dayDiv = document.createElement('div');
          dayDiv.className = 'filter-option filter-date-day';
          const dayCb = document.createElement('input');
          dayCb.type = 'checkbox';
          dayCb.value = `day:${year}:${month}:${day}`;
          dayCb.checked = activeDates.has(dayCb.value);
          dayDiv.appendChild(dayCb);
          dayDiv.appendChild(document.createTextNode(dayData.label));
          const countSpan = document.createElement('span');
          countSpan.className = 'filter-count';
          countSpan.textContent = dayData.count;
          dayDiv.appendChild(countSpan);
          dayCb.addEventListener('change', () => {
            if (dayCb.checked) {
              state.filters.date.add(dayCb.value);
            } else {
              state.filters.date.delete(dayCb.value);
            }
            applyFilters();
            closeFilterDropdown();
            openFilterDropdownFor('date', document.querySelector('.filter-btn[data-filter-type="date"]'));
          });
          body.appendChild(dayDiv);
        });
      });
    });
  } else {
    // Flat list for test_id, subject_id, status
    const activeSet = state.filters[type];
    values.forEach(([value, count]) => {
      const opt = document.createElement('div');
      opt.className = 'filter-option';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = value;
      cb.checked = activeSet.has(value);
      opt.appendChild(cb);
      const label = document.createElement('span');
      label.textContent = value;
      label.style.flex = '1';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      opt.appendChild(label);
      const countSpan = document.createElement('span');
      countSpan.className = 'filter-count';
      countSpan.textContent = count;
      opt.appendChild(countSpan);
      cb.addEventListener('change', () => {
        if (cb.checked) {
          activeSet.add(value);
        } else {
          activeSet.delete(value);
        }
        applyFilters();
        updateFilterBadges();
      });
      body.appendChild(opt);
    });
  }
}

function updateToggleButtonsState() {
  // Reset filters when switching views
  resetHistoryFilters(state);
  closeFilterDropdown();
  updateFilterBadges();

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
    updateFilterBadges();
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
  const count = state.selectedIds.size;
  const hasFilters = state.filters.date.size > 0 || state.filters.test_id.size > 0 || state.filters.subject_id.size > 0 || state.filters.status.size > 0;
  const filteredCount = getFilteredResults().length;
  const btnTextLocal = document.getElementById("btn-local-download-text");
  const btnTextGuest = document.getElementById("btn-guest-download-text");
  const btnTextCloud = document.getElementById("btn-cloud-download-text");

  if (btnTextLocal)
    btnTextLocal.innerHTML =
      count > 0
        ? `<span class="material-icons">download</span> Pobierz zaznaczone (${count})`
        : hasFilters
          ? `<span class="material-icons">download</span> Pobierz przefiltrowane (${filteredCount})`
          : `<span class="material-icons">download</span> Pobierz wszystkie wyniki`;
  if (btnTextGuest)
    btnTextGuest.innerHTML =
      count > 0
        ? `<span class="material-icons">download</span> Pobierz zaznaczone (${count})`
        : hasFilters
          ? `<span class="material-icons">download</span> Pobierz przefiltrowane (${filteredCount})`
          : `<span class="material-icons">download</span> Pobierz wszystkie`;
  if (btnTextCloud)
    btnTextCloud.innerHTML =
      count > 0
        ? `<span class="material-icons">download</span> Pobierz zaznaczone (${count})`
        : `<span class="material-icons">download</span> Pobierz wszystkie`;

  const btnLocalDelete = document.getElementById("btn-local-delete-selected");
  const btnGuestDelete = document.getElementById("btn-guest-delete-selected");

  if (btnLocalDelete) {
    if (count > 0 && !state.cloudView && !state.guestView)
      btnLocalDelete.classList.remove("hidden");
    else btnLocalDelete.classList.add("hidden");
  }

  if (btnGuestDelete) {
    if (count > 0 && state.guestView)
      btnGuestDelete.classList.remove("hidden");
    else btnGuestDelete.classList.add("hidden");
  }
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

function updateFilterBadges() {
  const total = state.filters.date.size + state.filters.test_id.size + state.filters.subject_id.size + state.filters.status.size;
  updateClearFiltersBar();
  // Show total badge or per-column badges
  document.querySelectorAll('.filterable-header').forEach(th => {
    const col = th.dataset.filterColumn;
    const badge = th.querySelector('.filter-badge');
    if (!badge) return;
    if (col === 'date') {
      const count = state.filters.date.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'test') {
      const count = state.filters.test_id.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'subject') {
      const count = state.filters.subject_id.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'status') {
      const count = state.filters.status.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    }
  });
}

// ===================================================
// PAGINATION
// ===================================================

function renderHistoryPage() {
  elements.historyTableBody.innerHTML = "";
  const selectAll = document.getElementById("selectAllHistory");
  if (selectAll) selectAll.checked = false;

  const filteredResults = getFilteredResults();
  const user = getCurrentUser();
  const researcherUid = getResearcherUid();

  // C3: stronicowanie w query-modelu
  const { items: pageResults, totalPages } = paginate(filteredResults, state.page, PAGE_SIZE);

  // Update/create pagination controls
  updatePaginationControls(filteredResults.length, totalPages);

  if (filteredResults.length === 0) {
    let msg = state.guestView
      ? "Brak wyników w trybie Gościa."
      : "Brak wyników.";
    if (hasActiveFilters(state.filters)) {
      msg = "Brak wyników pasujących do aktywnych filtrów.";
    }
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 7;
    td.textContent = msg;
    tr.appendChild(td);
    elements.historyTableBody.appendChild(tr);
    return;
  }

  // C3: stronicowanie w query-modelu (pageResults z góry funkcji)
  pageResults.forEach((r) => {
    const resultData = r.wyniki || r.data || {};
    const score = resultData.czas_reakcji
      ? `${resultData.czas_reakcji} ms`
      : resultData.score || "JSON";
    const patient_id =
      r.subject_id || resultData.subject_id || resultData.subjectId || "-";

    const row = document.createElement("tr");

    // Checkbox
    const tdCheckbox = document.createElement("td");
    tdCheckbox.style.textAlign = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "result-checkbox";
    cb.dataset.id = r.id || r.firestore_id;
    cb.checked = state.selectedIds.has(cb.dataset.id);
    cb.addEventListener("change", handleCheckboxChange);
    tdCheckbox.appendChild(cb);
    row.appendChild(tdCheckbox);

    // 1. Date
    const tdDate = document.createElement("td");
    tdDate.textContent = new Date(r.timestamp).toLocaleString();
    row.appendChild(tdDate);

    // 2. Test ID
    const tdTestId = document.createElement("td");
    tdTestId.textContent = r.test_id || r.testId;
    row.appendChild(tdTestId);

    // 3. Patient ID
    const tdPatient = document.createElement("td");
    tdPatient.textContent = patient_id;
    row.appendChild(tdPatient);

    // 4. Score
    const tdScore = document.createElement("td");
    const strongScore = document.createElement("strong");
    strongScore.textContent = score;
    tdScore.appendChild(strongScore);
    row.appendChild(tdScore);

    // 5. Sync Status / Actions
    const tdStatus = document.createElement("td");
    tdStatus.style.textAlign = "center";

    // CLAIMS MODE: tylko zalogowani użytkownicy konta online mogą przejmować wyniki Gościa
    if (state.guestView && user && researcherUid === user.uid) {
      const btnClaim = document.createElement("button");
      btnClaim.className = "btn small primary";
      btnClaim.style.padding = "2px 8px";
      btnClaim.style.fontSize = "12px";
      btnClaim.innerHTML =
        '<span class="material-icons" style="font-size:14px; vertical-align:middle; margin-right:4px;">input</span> Przejmij';
      btnClaim.title = "Przypisz ten wynik do swojego konta";
      btnClaim.onclick = async (e) => {
        e.stopPropagation();
        await handleClaimResult(r, user.uid);
      };
      tdStatus.appendChild(btnClaim);
    } else {
      // NORMAL MODE (Sync Status)
      const icon = document.createElement("span");
      icon.className = "material-icons";
      icon.style.fontSize = "18px";

      const sync_status = r.sync_status || r.syncStatus;

      if (r.researcher_uid && r.researcher_uid.startsWith("LOCAL::")) {
        // Konto lokalne — nie synchronizuje z chmurą
        icon.textContent = "computer";
        icon.style.color = "#64b5f6";
        icon.title = "Konto lokalne";
      } else if (sync_status === "LOCAL") {
        // Wynik z konta lokalnego (fallback dla starszych rekordów)
        icon.textContent = "computer";
        icon.style.color = "#64b5f6";
        icon.title = "Konto lokalne";
      } else if (r.researcher_uid === "GUEST") {
        icon.textContent = "dns";
        icon.style.color = "#888";
        icon.title = "Lokalne (Tryb Gościa)";
      } else if (sync_status === "SYNCED") {
        icon.textContent = "cloud_done";
        icon.style.color = "#4caf50";
        icon.title = "Zsynchronizowano";
      } else if (sync_status === "PENDING") {
        // #3 FIX: Use getUserStatus() from module, not from DOM
        // C4-followup: reguła wysyłki z session.js
        const canUpload = canUploadResult(getUserStatus());

        if (canUpload) {
          icon.textContent = "cloud_upload";
          icon.style.color = "#ff9800";
          icon.style.cursor = "pointer";
          icon.title = "Kliknij, aby wysłać do chmury";

          icon.onclick = async (e) => {
            e.stopPropagation();
            icon.textContent = "sync";
            icon.classList.add("spin");
            icon.style.color = "#2196f3";
            icon.onclick = null;

            try {
              await syncSingleResult(r);
            } catch (err) {
              icon.classList.remove("spin");
              icon.textContent = "error";
              icon.style.color = "red";
              await Notify.alert("Błąd wysyłania: " + err.message, "error");
              loadHistoryData();
            }
          };
        } else {
          icon.textContent = "cloud_off";
          icon.style.color = "#aaa";
          icon.title = "Czeka na wysyłkę (Wymagany status APPROVED)";
        }
      } else {
        icon.textContent = "error";
        icon.style.color = "red";
        icon.title = `Status nieznany: ${sync_status}`;
      }
      tdStatus.appendChild(icon);
    }
    row.appendChild(tdStatus);

    // 6. Action (Download)
    const tdAction = document.createElement("td");
    tdAction.style.textAlign = "center";

    const btn = document.createElement("button");
    btn.className = "btn-download-result icon-btn";
    btn.title = "Pobierz JSON";

    const btnIcon = document.createElement("span");
    btnIcon.className = "material-icons";
    btnIcon.style.fontSize = "18px";
    btnIcon.textContent = "download";
    btn.appendChild(btnIcon);
    btn.addEventListener("click", () => downloadSingle(r));

    tdAction.appendChild(btn);
    row.appendChild(tdAction);

    elements.historyTableBody.appendChild(row);
  });
}

function updatePaginationControls(totalItems, totalPages) {
  // Find or create pagination container
  let paginationContainer = document.getElementById("history-pagination");
  if (!paginationContainer) {
    // Create it and insert after table-container
    paginationContainer = document.createElement("div");
    paginationContainer.id = "history-pagination";
    paginationContainer.className = "history-pagination";
    const tableContainer = document.querySelector(
      "#history-view .table-container",
    );
    if (tableContainer) {
      tableContainer.insertAdjacentElement("afterend", paginationContainer);
    }
  }

  // Hide pagination altogether if only 1 page
  if (totalPages <= 1) {
    paginationContainer.style.display = "none";
    return;
  }

  paginationContainer.style.display = "flex";
  paginationContainer.innerHTML = "";

  // Prev button
  const btnPrev = document.createElement("button");
  btnPrev.className = "btn outline small";
  btnPrev.textContent = "← Poprzednia";
  btnPrev.disabled = state.page <= 1;
  btnPrev.addEventListener("click", () => {
    if (state.page > 1) {
      state.page--;
      renderHistoryPage();
    }
  });

  // Page info
  const pageInfo = document.createElement("span");
  pageInfo.className = "pagination-info";
  pageInfo.textContent = `Strona ${state.page} z ${totalPages} (${totalItems} wyników)`;

  // Next button
  const btnNext = document.createElement("button");
  btnNext.className = "btn outline small";
  btnNext.textContent = "Następna →";
  btnNext.disabled = state.page >= totalPages;
  btnNext.addEventListener("click", () => {
    if (state.page < totalPages) {
      state.page++;
      renderHistoryPage();
    }
  });

  paginationContainer.appendChild(btnPrev);
  paginationContainer.appendChild(pageInfo);
  paginationContainer.appendChild(btnNext);
}

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
  const dl = beginDownloadButton(
    {
      button: "btn-cloud-download-all",
      text: "btn-cloud-download-text",
      progress: "btn-cloud-download-progress",
    },
    "Pobieranie wyników...",
  );
  if (!dl) return;

  try {
    const timestamp = new Date().getTime();
    const filename = `Paczka_Wynikow_${timestamp}.zip`;
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
    dl.restore();
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
    const dl = beginDownloadButton(
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
    dl.restore();
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
