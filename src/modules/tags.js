// src/modules/tags.js — cienki adapter: auth/DOM + menu; logika w `src/catalog/tagsStore.js`.
import { getCurrentUser, getUserStatus, getResearcherUid } from "./auth.js";
import {
  storageKeyFor,
  createTagsStore,
  parseTagSearchQuery as parseQuery,
  matchesTagGroups as matchesGroups,
} from "../catalog/tagsStore.js";

// Re-eksport czystej logiki — dotychczasowi importerzy (`library.js` via Tags.*,
// `testCatalog.queryTests` przez wstrzyknięcie) działają bez zmian.
export { parseQuery as parseTagSearchQuery, matchesGroups as matchesTagGroups };

let activeCloseHandler = null;

/**
 * Zwraca klucz localStorage specyficzny dla aktualnego użytkownika.
 * @returns {string}
 */
function getStorageKey() {
  const user = getCurrentUser();
  return storageKeyFor({
    uid: user && user.uid ? user.uid : null,
    status: getUserStatus(),
    researcherUid: getResearcherUid(),
  });
}

/** Store powiązany z bieżącym użytkownikiem (klucz liczony per wywołanie). */
function getStore() {
  return createTagsStore({ storage: localStorage, key: getStorageKey() });
}

/**
 * Pobiera wszystkie tagi z localStorage.
 * @returns {Object} { testId: [tags] }
 */
function getAllTags() {
  return getStore().getAll();
}

/**
 * Zapisuje wszystkie tagi do localStorage.
 * @param {Object} allTags
 */
function saveAllTags(allTags) {
  getStore().saveAll(allTags);
}

/**
 * Pobiera listę tagów dla konkretnego testu.
 * @param {string} testId
 * @returns {string[]}
 */
export function getTagsForTest(testId) {
  return getStore().getTagsForTest(testId);
}

/**
 * Dodaje tagi do testu (obsługuje wiele tagów po przecinku).
 * @param {string} testId
 * @param {string} tagsInput
 */
export function addTagsToTest(testId, tagsInput) {
  return getStore().addTagsToTest(testId, tagsInput);
}

/**
 * Usuwa konkretny tag z testu.
 * @param {string} testId
 * @param {string} tagToRemove
 */
export function removeTagFromTest(testId, tagToRemove) {
  return getStore().removeTagFromTest(testId, tagToRemove);
}

/**
 * Zwraca listę wszystkich unikalnych tagów użytych u tego użytkownika.
 * @returns {string[]}
 */
export function getAllUsedTags() {
  return getStore().getAllUsedTags();
}

/**
 * Otwiera menu tagowania (floating popup).
 * @param {string} testId
 * @param {string} testName
 * @param {HTMLElement} anchorElement
 * @param {Function} onUpdate - callback wywoływany po zmianie tagów
 */
export function openTagMenu(testId, testName, anchorElement, onUpdate) {
  // Usuń istniejące menu jeśli jest
  removeExistingMenu();

  const tags = getTagsForTest(testId);

  const popup = document.createElement("div");
  popup.className = "tag-menu-popup";
  popup.id = "active-tag-menu";

  // Header
  const header = document.createElement("div");
  header.className = "tag-menu-header";
  header.innerHTML = `<strong>Tagi: ${testName}</strong>`;
  popup.appendChild(header);

  // Tags list
  const list = document.createElement("div");
  list.className = "tag-menu-list";
  renderTagList(list, testId, tags, onUpdate);
  popup.appendChild(list);

  // 1. Datalist for autocomplete
  let datalist = document.getElementById("tag-suggestions");
  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = "tag-suggestions";
    document.body.appendChild(datalist);
  }
  updateDatalist(datalist);

  // Add input
  const addContainer = document.createElement("div");
  addContainer.className = "tag-menu-add";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Dodaj tagi (po przecinku)...";
  input.className = "tag-input";
  input.setAttribute("list", "tag-suggestions");

  const addBtn = document.createElement("button");
  addBtn.className = "btn primary small";
  addBtn.textContent = "Dodaj";
  addBtn.setAttribute("aria-label", "Dodaj wpisane tagi");

  const performAdd = () => {
    const val = input.value.trim();
    if (val) {
      addTagsToTest(testId, val);
      input.value = "";
      const updated = getTagsForTest(testId);
      renderTagList(list, testId, updated, onUpdate);
      if (onUpdate) onUpdate(updated);
      updateDatalist(datalist); // Update suggestions after add
    }
  };

  addBtn.onclick = performAdd;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      performAdd();
    }
  };

  addContainer.appendChild(input);
  addContainer.appendChild(addBtn);
  popup.appendChild(addContainer);

  // Position popup
  document.body.appendChild(popup);
  const rect = anchorElement.getBoundingClientRect();

  // Basic positioning (below element)
  let top = rect.bottom + window.scrollY + 5;
  let left = rect.left + window.scrollX;

  // Boundary check
  if (left + 250 > window.innerWidth) {
    left = window.innerWidth - 260;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;

  // Fit to bottom boundary (flip up if needed)
  document.body.appendChild(popup);
  const popupRect = popup.getBoundingClientRect();
  if (popupRect.bottom > window.innerHeight) {
    top = rect.top + window.scrollY - popupRect.height - 5;
    if (top < 0) top = 5; // Fallback
    popup.style.top = `${top}px`;
  }

  // Close on click outside
  setTimeout(() => {
    activeCloseHandler = (e) => {
      const currentPopup = document.getElementById("active-tag-menu");
      if (!currentPopup) {
        if (activeCloseHandler) {
          document.removeEventListener("click", activeCloseHandler);
          activeCloseHandler = null;
        }
        return;
      }

      if (!currentPopup.contains(e.target) && e.target !== anchorElement) {
        removeExistingMenu();
      }
    };
    document.addEventListener("click", activeCloseHandler);
  }, 10);

  input.focus();
}

function updateDatalist(datalist) {
  const allUsed = getAllUsedTags();
  datalist.innerHTML = "";
  allUsed.forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    datalist.appendChild(option);
  });
}

function renderTagList(container, testId, tags, onUpdate) {
  container.innerHTML = "";
  if (tags.length === 0) {
    container.innerHTML =
      '<p style="color:#888; font-size:12px; margin: 10px 0;">Brak tagów.</p>';
    return;
  }

  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip-edit";

    const tagNameSpan = document.createElement("span");
    tagNameSpan.textContent = tag;
    chip.appendChild(tagNameSpan);

    const removeSpan = document.createElement("span");
    removeSpan.className = "tag-remove";
    removeSpan.textContent = " ✕";
    removeSpan.setAttribute("aria-label", `Usuń tag ${tag}`);
    removeSpan.setAttribute("role", "button");
    removeSpan.onclick = (e) => {
      e.stopPropagation(); // Zapobiegaj zamykaniu menu
      const updated = removeTagFromTest(testId, tag);
      renderTagList(container, testId, updated, onUpdate);
      if (onUpdate) onUpdate(updated);
    };

    chip.appendChild(removeSpan);
    container.appendChild(chip);
  });
}

function removeExistingMenu() {
  const existing = document.getElementById("active-tag-menu");
  if (existing) {
    existing.remove();
    if (activeCloseHandler) {
      document.removeEventListener("click", activeCloseHandler);
      activeCloseHandler = null;
    }
  }
}

// Parser i matcher żyją w `src/catalog/tagsStore.js` (re-eksport na górze pliku).
