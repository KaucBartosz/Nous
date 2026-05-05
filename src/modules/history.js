import {
  getAllResults,
  claimGuestResult,
  checkResultExists,
  saveResult,
  deleteResults,
} from "./database.js";
let selectedResultIds = new Set();
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
import { Dialog } from "./dialog.js";
import { flattenObject } from "./utils.js";
import { decryptCloudData, hasCloudKey } from "./cryptoService.js";

let isGuestViewActive = false;
let isCloudViewActive = false;
let cachedCloudResults = [];
let lastCloudFetchTime = 0;
const CLOUD_FETCH_THROTTLE_MS = 2000;

// --- FILTER STATE ---
let activeFilters = { date: new Set(), test_id: new Set(), subject_id: new Set(), status: new Set() };
let filterValuesCache = { date: [], test_id: [], subject_id: [], status: [] };
let openFilterDropdown = null;

// --- PAGINATION STATE ---
const PAGE_SIZE = 50;
let currentPage = 1;
let currentAllResults = []; // full sorted list for current view

export function initHistoryView() {
  document
    .getElementById("selectAllHistory")
    ?.addEventListener("change", (e) => {
      const checked = e.target.checked;
      const checkboxes = document.querySelectorAll(".result-checkbox");
      checkboxes.forEach((cb) => {
        cb.checked = checked;
        if (checked) {
          selectedResultIds.add(cb.dataset.id);
        } else {
          selectedResultIds.delete(cb.dataset.id);
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
      isGuestViewActive = !isGuestViewActive;
      isCloudViewActive = false;
      updateToggleButtonsState();
      loadHistoryData();
    });
  }

  if (elements.btnToggleCloudView) {
    elements.btnToggleCloudView.addEventListener("click", () => {
      isCloudViewActive = !isCloudViewActive;
      isGuestViewActive = false;
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
      // Pobieranie dostępne dla kont Firebase i LOCAL, nie dla GUEST
      if (uid !== "GUEST") handleDownloadAllLocal(uid);
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
  activeFilters = { date: new Set(), test_id: new Set(), subject_id: new Set(), status: new Set() };
  closeFilterDropdown();
  updateFilterBadges();
  currentPage = 1;
  selectedResultIds.clear();
  const selectAll = document.getElementById('selectAllHistory');
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();
  renderHistoryPage();
}

function updateClearFiltersBar() {
  const hasFilters = activeFilters.date.size > 0 || activeFilters.test_id.size > 0 || activeFilters.subject_id.size > 0 || activeFilters.status.size > 0;
  const bar = document.getElementById('active-filters-bar');
  if (bar) {
    bar.classList.toggle('hidden', !hasFilters);
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

function buildFilterValues(type) {
  const results = currentAllResults;
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
    const counts = {};
    results.forEach(r => {
      const val = r.test_id || r.testId || 'Nieznany';
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  }
  if (type === 'subject_id') {
    const counts = {};
    results.forEach(r => {
      const val = r.subject_id || (r.wyniki && r.wyniki.subjectId) || (r.data && r.data.subjectId) || 'Nieznany';
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  }
  if (type === 'status') {
    const counts = {};
    results.forEach(r => {
      let label = 'Lokalne';
      const sync_status = r.sync_status || r.syncStatus;
      if (r.researcher_uid && r.researcher_uid.startsWith('LOCAL::')) {
        label = 'Konto lokalne';
      } else if (sync_status === 'LOCAL') {
        label = 'Konto lokalne';
      } else if (r.researcher_uid === 'GUEST') {
        label = 'Tryb Gościa';
      } else if (sync_status === 'SYNCED') {
        label = 'Zsynchronizowano';
      } else if (sync_status === 'PENDING') {
        label = 'Oczekuje';
      }
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  }
  return [];
}

function renderFilterOptions(body, type, values) {
  body.innerHTML = '';
  if (type === 'date') {
    // Hierarchical rendering
    const activeDates = activeFilters.date;
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
          allDaysForYear.forEach(k => activeFilters.date.add(k));
        } else {
          allDaysForYear.forEach(k => activeFilters.date.delete(k));
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
            allDaysForMonth.forEach(k => activeFilters.date.add(k));
          } else {
            allDaysForMonth.forEach(k => activeFilters.date.delete(k));
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
              activeFilters.date.add(dayCb.value);
            } else {
              activeFilters.date.delete(dayCb.value);
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
    const activeSet = activeFilters[type];
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
  activeFilters = { date: new Set(), test_id: new Set(), subject_id: new Set(), status: new Set() };
  closeFilterDropdown();
  updateFilterBadges();

  selectedResultIds.clear();
  const selectAll = document.getElementById("selectAllHistory");
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();

  elements.cloudActionsContainer?.classList.add("hidden");
  elements.guestActionsContainer?.classList.add("hidden");
  elements.localActionsContainer?.classList.add("hidden");

  if (isCloudViewActive) {
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
  } else if (isGuestViewActive) {
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
      isGuestViewActive = false;
      isCloudViewActive = false;
    }
  }

  if (isCloudViewActive) {
    return loadCloudResults();
  }

  // Ustal targetUid uwzględniając konta lokalne (LOCAL::username)
  let targetUid = getResearcherUid();
  if (user && isGuestViewActive) {
    targetUid = "GUEST";
  }

  try {
    const allResults = await getAllResults();

    const myResults = allResults
      .filter((r) => r.researcher_uid === targetUid)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Store for pagination
    currentAllResults = myResults;
    currentPage = 1;
    // Reset filters on data reload
    activeFilters = { date: new Set(), test_id: new Set(), subject_id: new Set(), status: new Set() };
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
  const count = selectedResultIds.size;
  const hasFilters = activeFilters.date.size > 0 || activeFilters.test_id.size > 0 || activeFilters.subject_id.size > 0 || activeFilters.status.size > 0;
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
    if (count > 0 && !isCloudViewActive && !isGuestViewActive)
      btnLocalDelete.classList.remove("hidden");
    else btnLocalDelete.classList.add("hidden");
  }

  if (btnGuestDelete) {
    if (count > 0 && isGuestViewActive)
      btnGuestDelete.classList.remove("hidden");
    else btnGuestDelete.classList.add("hidden");
  }
}

function handleCheckboxChange(e) {
  const id = e.target.dataset.id;
  if (e.target.checked) {
    selectedResultIds.add(id);
  } else {
    selectedResultIds.delete(id);
    const selectAll = document.getElementById("selectAllHistory");
    if (selectAll) selectAll.checked = false;
  }
  updateDownloadButtonState();
}

async function handleDeleteSelected() {
  if (selectedResultIds.size === 0) return;

  const count = selectedResultIds.size;
  const choice = await Dialog.custom(
    `Czy na pewno chcesz usunąć ${count} wyników testów z historii? Jest to proces nieodwracalny.`,
    [
      { label: "Tak, usuń", value: true, class: "btn danger" },
      { label: "Anuluj", value: false, class: "btn outline" },
    ],
  );

  if (!choice) return;

  try {
    await deleteResults(Array.from(selectedResultIds));
    await Dialog.alert("Wyniki zostały pomyślnie usunięte.", "success");
    selectedResultIds.clear();
    const selectAll = document.getElementById("selectAllHistory");
    if (selectAll) selectAll.checked = false;
    updateDownloadButtonState();
    loadHistoryData();
  } catch (e) {
    await Dialog.alert("Błąd podczas usuwania: " + e.message, "error");
  }
}

// ===================================================
// FILTERING
// ===================================================

function applyFilters() {
  currentPage = 1;
  selectedResultIds.clear();
  const selectAll = document.getElementById('selectAllHistory');
  if (selectAll) selectAll.checked = false;
  updateDownloadButtonState();
  renderHistoryPage();
}

function getFilteredResults() {
  const results = currentAllResults;
  const hasActiveFilters = activeFilters.date.size > 0 || activeFilters.test_id.size > 0 || activeFilters.subject_id.size > 0 || activeFilters.status.size > 0;
  if (!hasActiveFilters) return results;

  return results.filter(r => {
    // Date filter
    if (activeFilters.date.size > 0) {
      const d = new Date(r.timestamp);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const dayKey = `day:${year}:${month}:${day}`;
      if (!activeFilters.date.has(dayKey)) return false;
    }

    // Test ID filter
    if (activeFilters.test_id.size > 0) {
      const testId = r.test_id || r.testId || 'Nieznany';
      if (!activeFilters.test_id.has(testId)) return false;
    }

    // Subject ID filter
    if (activeFilters.subject_id.size > 0) {
      const subjectId = r.subject_id || (r.wyniki && r.wyniki.subjectId) || (r.data && r.data.subjectId) || 'Nieznany';
      if (!activeFilters.subject_id.has(subjectId)) return false;
    }

    // Status filter
    if (activeFilters.status.size > 0) {
      let statusLabel = 'Lokalne';
      const sync_status = r.sync_status || r.syncStatus;
      if (r.researcher_uid && r.researcher_uid.startsWith('LOCAL::')) {
        statusLabel = 'Konto lokalne';
      } else if (sync_status === 'LOCAL') {
        statusLabel = 'Konto lokalne';
      } else if (r.researcher_uid === 'GUEST') {
        statusLabel = 'Tryb Gościa';
      } else if (sync_status === 'SYNCED') {
        statusLabel = 'Zsynchronizowano';
      } else if (sync_status === 'PENDING') {
        statusLabel = 'Oczekuje';
      }
      if (!activeFilters.status.has(statusLabel)) return false;
    }

    return true;
  });
}

function updateFilterBadges() {
  const total = activeFilters.date.size + activeFilters.test_id.size + activeFilters.subject_id.size + activeFilters.status.size;
  updateClearFiltersBar();
  // Show total badge or per-column badges
  document.querySelectorAll('.filterable-header').forEach(th => {
    const col = th.dataset.filterColumn;
    const badge = th.querySelector('.filter-badge');
    if (!badge) return;
    if (col === 'date') {
      const count = activeFilters.date.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'test') {
      const count = activeFilters.test_id.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'subject') {
      const count = activeFilters.subject_id.size;
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
      th.querySelector('.filter-btn').classList.toggle('active', count > 0);
    } else if (col === 'status') {
      const count = activeFilters.status.size;
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
  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE);

  // Update/create pagination controls
  updatePaginationControls(filteredResults.length, totalPages);

  if (filteredResults.length === 0) {
    const hasFilters = activeFilters.date.size > 0 || activeFilters.test_id.size > 0 || activeFilters.subject_id.size > 0 || activeFilters.status.size > 0;
    let msg = isGuestViewActive
      ? "Brak wyników w trybie Gościa."
      : "Brak wyników.";
    if (hasFilters) {
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

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageResults = filteredResults.slice(startIdx, startIdx + PAGE_SIZE);

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
    cb.checked = selectedResultIds.has(cb.dataset.id);
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
    if (isGuestViewActive && user && researcherUid === user.uid) {
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
        const userStatus = getUserStatus();
        const canUpload = userStatus === "APPROVED" || userStatus === "ADMIN";

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
              await Dialog.alert("Błąd wysyłania: " + err.message, "error");
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
    btn.addEventListener("click", () => downloadSingleResult(r));

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
  btnPrev.disabled = currentPage <= 1;
  btnPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderHistoryPage();
    }
  });

  // Page info
  const pageInfo = document.createElement("span");
  pageInfo.className = "pagination-info";
  pageInfo.textContent = `Strona ${currentPage} z ${totalPages} (${totalItems} wyników)`;

  // Next button
  const btnNext = document.createElement("button");
  btnNext.className = "btn outline small";
  btnNext.textContent = "Następna →";
  btnNext.disabled = currentPage >= totalPages;
  btnNext.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
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
  const choice = await Dialog.custom(
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
    await Dialog.alert(
      "Wynik został pomyślnie przypisany do Twojego konta!",
      "success",
    );
    loadHistoryData();
  } catch (e) {
    await Dialog.alert(
      "Błąd podczas przejmowania wyniku: " + e.message,
      "error",
    );
  }
}

function downloadSingleResult(result) {
  const formatEl = document.querySelector(
    'input[name="dl-format"]:checked',
  );
  const format = formatEl ? formatEl.value : 'json';

  if (format === "csv") {
    downloadSingleResultAsCSV(result);
  } else {
    const test_id = result.test_id || result.testId;
    const filename = `wynik_${test_id}_${new Date(result.timestamp).getTime()}.json`;
    const jsonStr = JSON.stringify(result, null, 2);
    downloadFile(filename, jsonStr, "application/json");
  }
}

function downloadSingleResultAsCSV(result) {
  const flat = {};
  flat["Data"] = new Date(result.timestamp).toLocaleString();
  flat["Test ID"] = result.test_id || result.testId;
  flat["ID Badanego"] = result.subject_id || "-";
  flat["Badacz UID"] = result.researcher_uid;

  const demo = result.demographics || {};
  if (demo.data) {
    Object.keys(demo.data).forEach((k) => {
      flat[`Metryczka - ${k}`] = demo.data[k];
    });
  }

  // #4 FIX: Use flattenObject from utils.js (no local duplicate)
  const resData = result.wyniki || result.data || {};
  flattenObject(resData, flat, "Wynik");

  const bom = "\uFEFF";
  let csvContent = bom + "Parametr;Wartość\r\n";

  for (const [key, value] of Object.entries(flat)) {
    let valStr = String(value);
    if (valStr.includes(";") || valStr.includes("\n")) {
      valStr = `"${valStr.replace(/"/g, '""')}"`;
    }
    csvContent += `${key};${valStr}\r\n`;
  }

  const test_id = result.test_id || result.testId;
  const filename = `wynik_${test_id}_${new Date(result.timestamp).getTime()}.csv`;
  downloadFile(filename, csvContent, "text/csv;charset=utf-8;");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ===================================================
// CLOUD RESULTS
// ===================================================

async function loadCloudResults() {
  const user = getCurrentUser();
  if (!user) return;

  const now = Date.now();
  if (now - lastCloudFetchTime < CLOUD_FETCH_THROTTLE_MS) {
    if (cachedCloudResults.length > 0) {
      return renderCloudResultsTable(cachedCloudResults);
    }
    return;
  }
  lastCloudFetchTime = now;

  elements.historyTableBody.innerHTML =
    '<tr><td colspan="6">Pobieranie danych z chmury...</td></tr>';

  try {
    const q = query(
      collection(firebaseDb, "results"),
      where("researcher_uid", "==", user.uid),
      orderBy("timestamp", "desc"),
    );

    const snap = await getDocs(q);
    cachedCloudResults = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      data.firestore_id = docSnap.id;

      if (data.is_encrypted && data.iv) {
        if (!hasCloudKey()) {
          data.data = { score: "Zaszyfrowane (Brak Klucza Chmury)" };
        } else {
          try {
            const decrypted = await decryptCloudData(data.data, data.iv);
            data.data = decrypted.data;
            data.demographics = decrypted.demographics;
            data.is_encrypted = false; // Po odszyfrowaniu w RAM zachowuje się jak zwykły obiekt
          } catch (e) {
            console.error("Failed to decrypt cloud result:", e);
            data.data = { score: "Błąd Deszyfracji" };
          }
        }
      }

      cachedCloudResults.push(data);
    }

    await renderCloudResultsTable(cachedCloudResults);
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

  const localResults = await getAllResults();
  const localKeys = new Set();
  localResults.forEach((r) => {
    if (r.firestore_id) localKeys.add(r.firestore_id);
    localKeys.add(`${r.timestamp}_${r.test_id}_${r.subject_id}`);
  });

  results.forEach((data) => {
    const row = document.createElement("tr");

    const tdCheckbox = document.createElement("td");
    tdCheckbox.style.textAlign = "center";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "result-checkbox";
    cb.dataset.id = data.firestore_id || data.id;
    cb.checked = selectedResultIds.has(cb.dataset.id);
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

    const cloudKeyMeta = `${data.timestamp}_${data.test_id}_${data.subject_id}`;
    const alreadyExists =
      localKeys.has(data.firestore_id) || localKeys.has(cloudKeyMeta);

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
      downloadSingleResult(formatted);
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
      Dialog.alert(
        "Ten wynik znajduje się już w Twojej lokalnej bazie danych.",
        "info",
      );
      return;
    }

    const user = getCurrentUser();
    const localData = {
      test_id: cloudResult.test_id,
      subject_id: cloudResult.subject_id,
      timestamp: cloudResult.timestamp,
      researcher_uid: user.uid,
      demographics: cloudResult.demographics,
      wyniki: cloudResult.data,
      firestore_id: cloudResult.firestore_id,
      sync_status: "SYNCED",
    };

    await saveResult(localData, user.uid);
    Dialog.alert("Wynik został zaimportowany!", "success");
    renderCloudResultsTable(cachedCloudResults);
  } catch (e) {
    Dialog.alert("Błąd importu: " + e.message, "error");
  }
}

async function handleImportAll() {
  if (cachedCloudResults.length === 0) return;

  const user = getCurrentUser();
  let count = 0;
  let skipped = 0;

  try {
    const localResults = await getAllResults();
    const localKeys = new Set();
    localResults.forEach((r) => {
      if (r.firestore_id) localKeys.add(r.firestore_id);
      localKeys.add(`${r.timestamp}_${r.test_id}_${r.subject_id}`);
    });

    for (const cloudResult of cachedCloudResults) {
      const cloudKeyMeta = `${cloudResult.timestamp}_${cloudResult.test_id}_${cloudResult.subject_id}`;
      const exists =
        localKeys.has(cloudResult.firestore_id) || localKeys.has(cloudKeyMeta);

      if (!exists) {
        const localData = {
          test_id: cloudResult.test_id,
          subject_id: cloudResult.subject_id,
          timestamp: cloudResult.timestamp,
          researcher_uid: user.uid,
          demographics: cloudResult.demographics,
          wyniki: cloudResult.data,
          firestore_id: cloudResult.firestore_id,
          sync_status: "SYNCED",
        };
        await saveResult(localData, user.uid);
        count++;
      } else {
        skipped++;
      }
    }

    Dialog.alert(
      `Import zakończony. Dodano: ${count}, Pominięto (duplikaty): ${skipped}`,
      "success",
    );
    renderCloudResultsTable(cachedCloudResults);
  } catch (e) {
    Dialog.alert("Błąd masowego importu: " + e.message, "error");
  }
}

async function handleDownloadAll() {
  if (cachedCloudResults.length === 0) return;

    const formatEl = document.querySelector(
      'input[name="dl-format"]:checked',
    );
    const format = formatEl ? formatEl.value : 'json';
    const btn = elements.btnCloudDownloadAll;
  const btnText = document.getElementById("btn-cloud-download-text");
  const btnProgress = document.getElementById("btn-cloud-download-progress");

  if (!btn || !btnText || !btnProgress) return;

  btn.classList.add("downloading");
  btn.disabled = true;
  const originalContent = btnText.innerHTML;
  btnText.innerHTML =
    '<span class="material-icons spin" style="font-size:16px;">sync</span> Pobieranie wyników...';
  btnProgress.style.width = "0%";

  try {
    const timestamp = new Date().getTime();
    const filename = `Paczka_Wynikow_${timestamp}.zip`;
    btnProgress.style.width = "50%";

    let resultsToDownload = cachedCloudResults;
    if (selectedResultIds.size > 0) {
      resultsToDownload = cachedCloudResults.filter(
        (r) =>
          selectedResultIds.has(r.firestore_id) || selectedResultIds.has(r.id),
      );
    }

    // Downloads selected or ALL cloud results (pagination does not affect this)
    const result = await window.electronAPI.downloadBulkZip({
      results: resultsToDownload,
      filename: filename,
      format: format,
    });

    if (result.success) {
      btnProgress.style.width = "100%";
      setTimeout(
        () => Dialog.alert("Archiwum ZIP zostało wygenerowane!", "success"),
        500,
      );
    } else if (!result.cancelled) {
      Dialog.alert("Błąd podczas generowania ZIP: " + result.error, "error");
    }
  } catch (e) {
    Dialog.alert("Wystąpił nieoczekiwany błąd: " + e.message, "error");
  } finally {
    setTimeout(() => {
      btn.classList.remove("downloading");
      btn.disabled = false;
      btnText.innerHTML = originalContent;
      btnProgress.style.width = "0%";
    }, 1000);
  }
}

async function handleImportGuestResults() {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const allLocal = await getAllResults();
    const guestResults = allLocal.filter((r) => r.researcher_uid === "GUEST");

    if (guestResults.length === 0) {
      Dialog.alert("Brak wyników Gościa do zaimportowania.", "info");
      return;
    }

    const choice = await Dialog.custom(
      `Znaleziono ${guestResults.length} wyników Gościa. Czy chcesz je przenieść na swoje konto (znikną z konta Gościa) czy duplikować?`,
      [
        { label: "Przenieś", value: "move", class: "btn primary" },
        { label: "Duplikuj", value: "duplicate", class: "btn secondary" },
        { label: "Anuluj", value: "cancel", class: "btn outline" },
      ],
    );

    if (!choice || choice === "cancel") return;

    let syncCount = 0;
    for (const res of guestResults) {
      if (choice === "move") {
        res.researcher_uid = user.uid;
        res.sync_status = "PENDING";
        await saveResult(res, user.uid);
      } else {
        const newRes = {
          ...res,
          id: crypto.randomUUID(),
          researcher_uid: user.uid,
          sync_status: "PENDING",
        };
        delete newRes.firestore_id;
        await saveResult(newRes, user.uid);
      }
      syncCount++;
    }

    Dialog.alert(
      `Zakończono! ${choice === "move" ? "Przeniesiono" : "Zduplikowano"} ${syncCount} wyników.`,
      "success",
    );
    loadHistoryData();
  } catch (e) {
    Dialog.alert("Błąd importu: " + e.message, "error");
  }
}

async function handleDownloadAllLocal(targetUid) {
  try {
    const hasFilters = activeFilters.date.size > 0 || activeFilters.test_id.size > 0 || activeFilters.subject_id.size > 0 || activeFilters.status.size > 0;

    // Downloads ALL results for the user (not just current page)
    const allLocal = await getAllResults();
    let results = allLocal.filter((r) => r.researcher_uid === targetUid);

    // Apply filters if active
    if (hasFilters) {
      results = results.filter(r => {
        // Date filter
        if (activeFilters.date.size > 0) {
          const d = new Date(r.timestamp);
          const year = d.getFullYear();
          const month = d.getMonth();
          const day = d.getDate();
          const dayKey = `day:${year}:${month}:${day}`;
          if (!activeFilters.date.has(dayKey)) return false;
        }
        // Test ID filter
        if (activeFilters.test_id.size > 0) {
          const testId = r.test_id || r.testId || 'Nieznany';
          if (!activeFilters.test_id.has(testId)) return false;
        }
        // Subject ID filter
        if (activeFilters.subject_id.size > 0) {
          const subjectId = r.subject_id || (r.wyniki && r.wyniki.subjectId) || (r.data && r.data.subjectId) || 'Nieznany';
          if (!activeFilters.subject_id.has(subjectId)) return false;
        }
        // Status filter
        if (activeFilters.status.size > 0) {
          let statusLabel = 'Lokalne';
          const sync_status = r.sync_status || r.syncStatus;
          if (r.researcher_uid && r.researcher_uid.startsWith('LOCAL::')) {
            statusLabel = 'Konto lokalne';
          } else if (sync_status === 'LOCAL') {
            statusLabel = 'Konto lokalne';
          } else if (r.researcher_uid === 'GUEST') {
            statusLabel = 'Tryb Gościa';
          } else if (sync_status === 'SYNCED') {
            statusLabel = 'Zsynchronizowano';
          } else if (sync_status === 'PENDING') {
            statusLabel = 'Oczekuje';
          }
          if (!activeFilters.status.has(statusLabel)) return false;
        }
        return true;
      });
    }

    if (selectedResultIds.size > 0) {
      results = results.filter(
        (r) =>
          selectedResultIds.has(r.id) || selectedResultIds.has(r.firestore_id),
      );
    }

    if (results.length === 0) {
      Dialog.alert("Brak wyników do pobrania.", "info");
      return;
    }

    const isGuest = targetUid === "GUEST";
    const prefix = isGuest ? "guest" : "local";

    const btn = document.getElementById(`btn-${prefix}-download-all`);
    const btnText = document.getElementById(`btn-${prefix}-download-text`);
    const btnProgress = document.getElementById(
      `btn-${prefix}-download-progress`,
    );

    if (!btn || !btnText || !btnProgress) return;

    btn.classList.add("downloading");
    btn.disabled = true;
    const originalContent = btnText.innerHTML;
    btnText.innerHTML =
      '<span class="material-icons spin" style="font-size:16px;">sync</span> Pobieranie...';
    btnProgress.style.width = "30%";

    const formatEl = document.querySelector(
      'input[name="dl-format"]:checked',
    );
    const format = formatEl ? formatEl.value : 'json';
    const filename = `Wyniki_${isGuest ? "Gosc" : "Uzytkownik"}_${Date.now()}.zip`;

    const result = await window.electronAPI.downloadBulkZip({
      results,
      filename,
      format,
    });

    if (result.success) {
      btnProgress.style.width = "100%";
    } else if (!result.cancelled) {
      Dialog.alert("Błąd ZIP: " + result.error, "error");
    }

    setTimeout(() => {
      btn.classList.remove("downloading");
      btn.disabled = false;
      btnText.innerHTML = originalContent;
      btnProgress.style.width = "0%";
    }, 1000);
  } catch (e) {
    Dialog.alert("Błąd: " + e.message, "error");
  }
}

function downloadResultsAsCSV(results, filename) {
  if (results.length === 0) return;

  const allFlats = results.map((r) => {
    const flat = {};
    flat["Data"] = new Date(r.timestamp || r.synced_at).toLocaleString();
    flat["Test ID"] = r.test_id || r.testId;
    flat["ID Badanego"] = r.subject_id || "-";
    flat["Badacz UID"] = r.researcher_uid;

    const demo = r.demographics || {};
    const dData = demo.data || demo;
    if (typeof dData === "object") {
      Object.keys(dData).forEach((k) => {
        flat[`Metryczka - ${k}`] = dData[k];
      });
    }

    const resData = r.wyniki || r.data || {};
    // #4 FIX: Use flattenObject from utils.js
    flattenObject(resData, flat, "Wynik");
    return flat;
  });

  const allKeys = new Set();
  allFlats.forEach((f) => Object.keys(f).forEach((k) => allKeys.add(k)));
  const headerKeys = Array.from(allKeys);

  const bom = "\uFEFF";
  let csvContent = bom + headerKeys.join(";") + "\r\n";

  allFlats.forEach((flat) => {
    const row = headerKeys.map((key) => {
      let val = flat[key] !== undefined ? String(flat[key]) : "";
      if (val.includes(";") || val.includes("\n")) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvContent += row.join(";") + "\r\n";
  });

  downloadFile(filename, csvContent, "text/csv;charset=utf-8;");
}

export function exportHistoryToCSV() {
  const bom = "\uFEFF";
  let csv = bom;

  document.querySelectorAll("#history-table tr").forEach((row) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const rowData = cells.map((cell) => {
      const clone = cell.cloneNode(true);
      clone
        .querySelectorAll(".material-icons")
        .forEach((icon) => icon.remove());
      clone.querySelectorAll("button").forEach((btn) => btn.remove());
      let text = clone.textContent.trim();
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        text = `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    });
    csv += rowData.join(",") + "\r\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "historia_wynikow.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
