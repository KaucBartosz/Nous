// src/modules/library.js
import { db } from "../firebaseConfig.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from "./ui.js";
import { Notify } from "../notify/notify.js";
import {
  debounce,
  getLocalVersionsCached,
  escapeHtml,
} from "./utils.js";
import * as Tags from "./tags.js";
import { getSettings } from "./settings.js";
import { getResearcherUid } from "./auth.js";
import { getPlatform } from "../platform/index.js";
import { loadCatalog, queryTests } from "../catalog/testCatalog.js";
import {
  cardParts,
  setTestButtonState,
  setTestButtonProgress,
} from "../catalog/testCard.js";

/**
 * Zwraca klucze localStorage specyficzne dla aktualnego użytkownika.
 */
function getLibraryStorageKeys() {
  const uid = getResearcherUid().replace("::", "__");
  return {
    viewMode: `libraryViewMode_${uid}`,
    trainingMode: `trainingMode_${uid}`,
  };
}

let cachedTests = [];
let isSearchBound = false;
let listenersRegistered = false; // Flaga zapobiegająca wielokrotnej rejestracji
let currentViewMode = "grid"; // 'grid', 'list', 'table', 'compact'
let isTrainingMode = false;
let isLoading = false; // Flaga zapobiegająca współbieżnym wywołaniom loadTestsList (race condition → duplikaty)

export function getTrainingMode() {
  return isTrainingMode;
}

// View mode button references
const viewButtons = {
  grid: null,
  list: null,
  table: null,
  compact: null,
};

/**
 * Inicjalizuje listenery Electron API (wywołaj raz).
 */
export function initLibraryListeners() {
  if (listenersRegistered) return;
  const platform = getPlatform();

  platform.tests.onProgress(({ test_id, percent }) => {
    const btn = document.getElementById(`start-test-${test_id}`);
    // B: kanoniczny stan przycisku (szablon w testCard.js)
    if (btn) setTestButtonProgress(btn, percent);
  });

  platform.tests.onInstalled((data) => {
    console.log("Test installed, refreshing library:", data);
    loadTestsList(undefined, true); // Force refresh
  });

  platform.tests.onProcessStopped(() => {
    console.log("Test process stopped, refreshing UI");
    loadTestsList(); // Re-render triggers UI reset
  });

  listenersRegistered = true;
}

export function initViewSwitcher() {
  viewButtons.grid = document.getElementById("view-grid");
  viewButtons.list = document.getElementById("view-list");
  viewButtons.table = document.getElementById("view-table");
  viewButtons.compact = document.getElementById("view-compact");

  // Load saved preference
  const savedView = localStorage.getItem(getLibraryStorageKeys().viewMode);
  if (savedView && viewButtons[savedView]) {
    currentViewMode = savedView;
    updateViewButtonStates();
  }

  // Bind click events for view switching
  Object.entries(viewButtons).forEach(([mode, btn]) => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (currentViewMode !== mode) {
          currentViewMode = mode;
          localStorage.setItem(getLibraryStorageKeys().viewMode, mode);
          updateViewButtonStates();
          // Re-render with current filter
          const searchInput = document.getElementById("library-search");
          const filterText = searchInput ? searchInput.value : "";
          renderTests(cachedTests, filterText);
        }
      });
    }
  });

  // Bind search input event with DEBOUNCE (only once)
  if (!isSearchBound) {
    const searchInput = document.getElementById("library-search");
    if (searchInput) {
      const debouncedSearch = debounce((filterText) => {
        renderTests(cachedTests, filterText);
      }, 200);

      searchInput.addEventListener("input", (e) => {
        debouncedSearch(e.target.value);
      });
      isSearchBound = true;
    }
  }

  // Bind Training Mode toggle
  if (elements.toggleTrainingMode) {
    isTrainingMode =
      localStorage.getItem(getLibraryStorageKeys().trainingMode) === "true";
    elements.toggleTrainingMode.checked = isTrainingMode;

    elements.toggleTrainingMode.addEventListener("change", (e) => {
      isTrainingMode = e.target.checked;
      localStorage.setItem(
        getLibraryStorageKeys().trainingMode,
        isTrainingMode,
      );
    });
  }

  // Migracja: usuń pozostałość po usuniętym trybie HPM (decyzja #6)
  try {
    localStorage.removeItem("hpmEnabled");
  } catch (e) {
    console.warn("Nie można wyczyścić klucza hpmEnabled:", e);
  }

  // Init Electron listeners
  initLibraryListeners();
}

function updateViewButtonStates() {
  Object.entries(viewButtons).forEach(([mode, btn]) => {
    if (btn) {
      btn.classList.toggle("active", mode === currentViewMode);
    }
  });
}

export async function loadTestsList(filterText = null, forceRefresh = false) {
  // Guard: jeśli już trwa ładowanie, zignoruj nowe wywołanie (zapobiega race condition i podwójnemu wyświetlaniu)
  if (isLoading) {
    console.log(
      "[Library] loadTestsList: zignorowano wywołanie – trwa już ładowanie.",
    );
    return;
  }

  if (filterText === null) {
    const searchInput = document.getElementById("library-search");
    filterText = searchInput ? searchInput.value : "";
  }

  // 1-3. Rejestr + merge wersji + backfill (C5: catalog; wcześniej ~120 linii inline)
  // Web: cloudEnabled=false — nigdy Firestore, lista z backfillu rejestru (jak wcześniej)
  if (!cachedTests.length || forceRefresh) {
    isLoading = true;
    elements.testsGrid.innerHTML =
      '<p style="color:#888;">Ładowanie biblioteki...</p>';

    try {
      const res = await loadCatalog({
        forceRefresh,
        cached: cachedTests,
        cloudEnabled: getPlatform().kind === "electron",
        fetchRemote: () => getDocs(collection(db, "tests")),
        isOnline: () => (typeof navigator !== "undefined" ? navigator.onLine : true),
        getLocalVersions: getLocalVersionsCached,
        getSettings,
      });
      if (res.empty && !res.offline) {
        elements.testsGrid.innerHTML = "<p>Brak testów w chmurze.</p>";
        return; // isLoading zresetowane w finally
      }
      cachedTests = res.tests;
      if (res.empty && res.offline) {
        showOfflinePanel(res.scannedDir);
        return;
      }
    } catch (e) {
      console.warn("Błąd ładowania biblioteki:", e);
      showOfflinePanel("nieznana");
      return;
    } finally {
      isLoading = false; // Zawsze resetuj flagę, niezależnie od ścieżki wykonania
    }
  }

  if (cachedTests.length === 0) {
    const localVersions = await getLocalVersionsCached();
    showOfflinePanel(localVersions.__scannedDir || "nieznana");
  } else {
    renderTests(cachedTests, filterText);
  }
}

function showOfflinePanel(scannedPath) {
  elements.testsGrid.innerHTML = `
            <div style="text-align:center; padding:40px; color:#888;">
                <span class="material-icons" style="font-size:48px; margin-bottom:15px;">signal_wifi_off</span>
                <p>Brak połączenia z Internetem i nie znaleziono pobranych testów.</p>
                <p style="font-size:11px; margin-top:10px;">Przeszukano folder:<br><code style="background:rgba(255,255,255,0.05); padding:2px 5px; border-radius:3px;">${escapeHtml(scannedPath)}</code></p>
                <button class="btn secondary small" onclick="location.reload()" style="margin-top:20px;">Spróbuj ponownie</button>
            </div>
        `;
}

// Deskryptor statusu żyje w `src/catalog/testCard.js` (getTestStatus).
// Jedno wiązanie startu dla wszystkich widoków (wcześniej 4 identyczne kopie).
function handleStart(t, status) {
  startTestProcess(
    t.download_url || t.downloadUrl,
    t.id,
    status.versionParam,
    status.isDownloadOnly,
    t.name,
    t.description,
    t.isLocalDev,
  );
}

function renderTests(testsSource, filterText) {
  elements.testsGrid.innerHTML = "";

  // 1-2. Filtr (tekst + @tagi) i sort (C5: catalog; logika identyczna)
  const tests = queryTests(testsSource, filterText, Tags);

  if (tests.length === 0) {
    elements.testsGrid.innerHTML = "<p>Brak wyników wyszukiwania.</p>";
    return;
  }

  // 3. Render based on current view mode
  switch (currentViewMode) {
    case "list":
      renderListView(tests);
      break;
    case "table":
      renderTableView(tests);
      break;
    case "compact":
      renderCompactView(tests);
      break;
    case "grid":
    default:
      renderGridView(tests);
      break;
  }
}

/**
 * Tworzy przycisk tagowania testu — wspólny dla wszystkich widoków.
 * @param {string} test_id
 * @param {string} testName
 * @param {Object} opts
 * @param {string}   [opts.fontSize='24px']
 * @param {string}   [opts.marginLeft=null]
 * @param {Function} [opts.onUpdate=null]  - dodatkowy callback po aktualizacji tagów
 */
function createTagBtn(
  test_id,
  testName,
  { fontSize = "24px", marginLeft = null, onUpdate = null } = {},
) {
  const tagBtn = document.createElement("span");
  tagBtn.className = "material-icons tag-btn";
  tagBtn.textContent = "menu_book";
  tagBtn.title = "Zarządzaj tagami";
  tagBtn.setAttribute("aria-label", `Zarządzaj tagami dla testu ${testName}`);
  tagBtn.style.fontSize = fontSize;
  if (marginLeft !== null) tagBtn.style.marginLeft = marginLeft;

  const currentTags = Tags.getTagsForTest(test_id);
  tagBtn.classList.add(currentTags.length > 0 ? "active" : "inactive");

  tagBtn.onclick = (e) => {
    e.stopPropagation();
    Tags.openTagMenu(test_id, testName, tagBtn, (updatedTags) => {
      tagBtn.className = "material-icons tag-btn";
      tagBtn.style.fontSize = fontSize;
      if (marginLeft !== null) tagBtn.style.marginLeft = marginLeft;
      tagBtn.classList.add(updatedTags.length > 0 ? "active" : "inactive");

      if (onUpdate) onUpdate(updatedTags);

      const searchInput = document.getElementById("library-search");
      if (searchInput && searchInput.value) {
        renderTests(cachedTests, searchInput.value);
      }
    });
  };

  return tagBtn;
}

function renderGridView(tests) {
  elements.testsGrid.className = "grid-container";

  tests.forEach((t) => {
    // A: klocki z Karty Katalogu; renderer tylko układa + 3 tweaki layoutu
    const parts = cardParts(t, {
      iconSize: "24px",
      appIcon: "40px",
      tagBtn: createTagBtn(t.id, t.name),
      onStart: handleStart,
    });

    const card = document.createElement("div");
    card.className = "test-card";

    const topDiv = document.createElement("div");
    topDiv.style.cssText =
      "display:flex; justify-content:space-between; align-items:start;";

    const iconsDiv = document.createElement("div");
    iconsDiv.style.cssText = "display:flex; align-items:center; gap:10px;";
    iconsDiv.append(parts.appIcon, parts.statusIcon, parts.tagBtn);

    parts.versionEl.className = "meta";
    parts.versionEl.style.cssText =
      "color: #666; display: flex; align-items: center; gap: 8px;";
    topDiv.append(iconsDiv, parts.versionEl);

    parts.titleEl.style.marginTop = "10px";
    parts.button.style.marginTop = "auto";
    card.append(topDiv, parts.titleEl, parts.descEl, parts.button);

    elements.testsGrid.appendChild(card);
  });
}

function renderListView(tests) {
  elements.testsGrid.className = "list-container";

  tests.forEach((t) => {
    const item = document.createElement("div");
    item.className = "test-list-item";

    // Chipy tagów — jedyny kawałek specyficzny dla listy
    const tagContainer = document.createElement("div");
    tagContainer.className = "list-tag-container";

    const renderChips = (tags) => {
      tagContainer.innerHTML = "";
      tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "tag-chip";
        chip.textContent = tag;
        tagContainer.appendChild(chip);
      });
    };
    renderChips(Tags.getTagsForTest(t.id));

    const parts = cardParts(t, {
      iconSize: "20px",
      appIcon: true,
      tagBtn: createTagBtn(t.id, t.name, {
        fontSize: "20px",
        onUpdate: renderChips,
      }),
      onStart: handleStart,
    });

    // Icon section
    const iconDiv = document.createElement("div");
    iconDiv.className = "list-icon";
    iconDiv.append(parts.appIcon, parts.statusIcon, parts.tagBtn);

    // Info section
    const infoDiv = document.createElement("div");
    infoDiv.className = "list-info";
    infoDiv.append(parts.titleEl, parts.descEl, tagContainer);

    // Meta section
    const metaDiv = document.createElement("div");
    metaDiv.className = "list-meta";

    parts.versionEl.style.display = "flex";
    parts.versionEl.style.alignItems = "center";
    parts.versionEl.style.gap = "8px";
    metaDiv.append(parts.versionEl, parts.statusText);

    // Actions section
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "list-actions";
    actionsDiv.appendChild(parts.button);

    item.append(iconDiv, infoDiv, metaDiv, actionsDiv);
    elements.testsGrid.appendChild(item);
  });
}

function renderTableView(tests) {
  elements.testsGrid.className = "library-table-container";

  const table = document.createElement("table");
  table.className = "library-table";

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
        <tr>
            <th>Nazwa Testu</th>
            <th>Opis</th>
            <th>Wersja</th>
            <th>Status</th>
            <th>Akcja</th>
        </tr>
    `;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");

  tests.forEach((t) => {
    const parts = cardParts(t, {
      iconSize: "18px",
      tagBtn: createTagBtn(t.id, t.name, {
        fontSize: "18px",
        marginLeft: "8px",
      }),
      onStart: handleStart,
    });

    const row = document.createElement("tr");

    // Name cell
    const nameCell = document.createElement("td");
    nameCell.style.fontWeight = "500";
    nameCell.textContent = t.name || "Bez nazwy";

    // Description cell
    const descCell = document.createElement("td");
    descCell.style.color = "#888";
    descCell.style.maxWidth = "300px";
    descCell.style.overflow = "hidden";
    descCell.style.textOverflow = "ellipsis";
    descCell.style.whiteSpace = "nowrap";
    descCell.textContent = t.description || "Brak opisu";

    // Version cell
    const versionCell = document.createElement("td");
    versionCell.textContent = `v${t.version}`;

    // Status cell
    const statusCell = document.createElement("td");
    const statusDiv = document.createElement("div");
    statusDiv.className = "status-cell";
    statusDiv.append(parts.statusIcon, parts.statusText, parts.tagBtn);
    statusCell.appendChild(statusDiv);

    // Action cell
    const actionCell = document.createElement("td");
    actionCell.appendChild(parts.button);

    row.append(nameCell, descCell, versionCell, statusCell, actionCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  elements.testsGrid.appendChild(table);
}

function renderCompactView(tests) {
  elements.testsGrid.className = "compact-grid";

  tests.forEach((t) => {
    const parts = cardParts(t, {
      tagBtn: createTagBtn(t.id, t.name, {
        fontSize: "18px",
        marginLeft: "auto",
      }),
      compactButton: true,
      onStart: handleStart,
    });

    const card = document.createElement("div");
    card.className = "test-card-compact";

    const headerDiv = document.createElement("div");
    headerDiv.className = "compact-header";
    headerDiv.append(parts.statusIcon, parts.tagBtn);

    const footerDiv = document.createElement("div");
    footerDiv.className = "compact-footer";

    parts.versionEl.className = "compact-version";
    parts.versionEl.style.display = "flex";
    parts.versionEl.style.alignItems = "center";
    parts.versionEl.style.gap = "4px";
    footerDiv.append(parts.versionEl, parts.button);

    card.append(headerDiv, parts.titleEl, footerDiv);
    elements.testsGrid.appendChild(card);
  });
}

export async function startTestProcess(
  url,
  id,
  ver,
  onlyDownload = false,
  name = "",
  description = "",
  isLocalDev = false,
) {
  const platform = getPlatform();
  // A1: pytamy o zdolności, nie o kind — gałąź electron/web znika.
  const caps = platform.capabilities || {
    canDownload: platform.kind === "electron",
    canRunLocalDev: platform.kind === "electron",
  };
  const btn = document.getElementById(`start-test-${id}`);

  // Pobieranie plików tylko tam, gdzie platforma umie pobierać.
  if (onlyDownload && !caps.canDownload) {
    await Notify.info(
      "Zarządzanie plikami jest niedostępne w wersji Web. Testy są serwowane dynamicznie.",
    );
    return;
  }

  // Kanoniczny stan przycisku (B: jeden szablon zamiast osobnych łańcuchów HTML).
  if (btn) setTestButtonState(btn, { label: "Inicjowanie...", percent: 0 });

  if (isLocalDev && caps.canRunLocalDev) {
    const confirmed = await Notify.confirm(
      "<strong>Ostrzeżenie Bezpieczeństwa</strong><br><br>" +
        "To jest test uruchamiany z Twojego lokalnego dysku (folder <code>tests/</code>). " +
        "Uruchamiaj tylko te pliki, których kod znasz i którym ufasz. " +
        "Czy na pewno chcesz kontynuować?",
      "warning",
    );
    if (!confirmed) {
      loadTestsList();
      return;
    }
  }

  try {
    const result = await platform.tests.run({
      url,
      id,
      ver,
      onlyDownload,
      trainingMode: isTrainingMode,
      name,
      description,
      isLocalDev,
    });
    // Web adapter sygnalizuje brak webPath jako { opened: false };
    // Electron/fake nic nie zwracają (undefined) = sukces.
    if (result && result.opened === false) {
      await Notify.error(
        "Ten test nie posiada jeszcze odpowiedniej ścieżki (webPath) w rejestrze Web.",
      );
      loadTestsList();
    }
  } catch (err) {
    console.error("Błąd uruchamiania testu:", err);
    await Notify.error("Wystąpił błąd podczas uruchamiania testu.");
    loadTestsList();
  }
}
