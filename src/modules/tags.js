// src/modules/tags.js
import { getCurrentUser, getUserStatus } from './auth.js';

/**
 * Zwraca klucz localStorage specyficzny dla aktualnego użytkownika.
 * @returns {string}
 */
function getStorageKey() {
    const user = getCurrentUser();
    const status = getUserStatus();
    
    if (user && user.uid) {
        return `test_tags_${user.uid}`;
    } else if (status === 'GUEST') {
        return 'test_tags_guest';
    }
    return 'test_tags_anonymous';
}

/**
 * Pobiera wszystkie tagi z localStorage.
 * @returns {Object} { testId: [tags] }
 */
function getAllTags() {
    const key = getStorageKey();
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Error parsing tags from localStorage", e);
        return {};
    }
}

/**
 * Zapisuje wszystkie tagi do localStorage.
 * @param {Object} allTags 
 */
function saveAllTags(allTags) {
    const key = getStorageKey();
    localStorage.setItem(key, JSON.stringify(allTags));
}

/**
 * Pobiera listę tagów dla konkretnego testu.
 * @param {string} testId 
 * @returns {string[]}
 */
export function getTagsForTest(testId) {
    const all = getAllTags();
    return all[testId] || [];
}

/**
 * Dodaje tagi do testu (obsługuje wiele tagów po przecinku).
 * @param {string} testId 
 * @param {string} tagsInput 
 */
export function addTagsToTest(testId, tagsInput) {
    if (!tagsInput) return;
    
    const newTags = tagsInput.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);
        
    if (newTags.length === 0) return;
    
    const all = getAllTags();
    const currentTags = all[testId] || [];
    
    // Unikalne dodawanie
    const updatedTags = [...new Set([...currentTags, ...newTags])];
    all[testId] = updatedTags;
    
    saveAllTags(all);
    return updatedTags;
}

/**
 * Usuwa konkretny tag z testu.
 * @param {string} testId 
 * @param {string} tagToRemove 
 */
export function removeTagFromTest(testId, tagToRemove) {
    const all = getAllTags();
    const currentTags = all[testId] || [];
    
    const updatedTags = currentTags.filter(t => t !== tagToRemove.toLowerCase());
    
    if (updatedTags.length === 0) {
        delete all[testId];
    } else {
        all[testId] = updatedTags;
    }
    
    saveAllTags(all);
    return updatedTags;
}

/**
 * Zwraca listę wszystkich unikalnych tagów użytych u tego użytkownika.
 * @returns {string[]}
 */
export function getAllUsedTags() {
    const all = getAllTags();
    const tagsSet = new Set();
    
    Object.values(all).forEach(tags => {
        tags.forEach(t => tagsSet.add(t));
    });
    
    return Array.from(tagsSet).sort();
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
    
    const popup = document.createElement('div');
    popup.className = 'tag-menu-popup';
    popup.id = 'active-tag-menu';
    
    // Header
    const header = document.createElement('div');
    header.className = 'tag-menu-header';
    header.innerHTML = `<strong>Tagi: ${testName}</strong>`;
    popup.appendChild(header);
    
    // Tags list
    const list = document.createElement('div');
    list.className = 'tag-menu-list';
    renderTagList(list, testId, tags, onUpdate);
    popup.appendChild(list);
    
    // 1. Datalist for autocomplete
    let datalist = document.getElementById('tag-suggestions');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'tag-suggestions';
        document.body.appendChild(datalist);
    }
    updateDatalist(datalist);

    // Add input
    const addContainer = document.createElement('div');
    addContainer.className = 'tag-menu-add';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Dodaj tagi (po przecinku)...';
    input.className = 'tag-input';
    input.setAttribute('list', 'tag-suggestions');
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn primary small';
    addBtn.textContent = 'Dodaj';
    
    const performAdd = () => {
        const val = input.value.trim();
        if (val) {
            addTagsToTest(testId, val);
            input.value = '';
            const updated = getTagsForTest(testId);
            renderTagList(list, testId, updated, onUpdate);
            if (onUpdate) onUpdate(updated);
            updateDatalist(datalist); // Update suggestions after add
        }
    };
    
    addBtn.onclick = performAdd;
    input.onkeydown = (e) => { 
        if (e.key === 'Enter') {
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
    
    // Close on click outside
    setTimeout(() => {
        const closeHandler = (e) => {
            // Re-check if popup still exists in DOM
            const currentPopup = document.getElementById('active-tag-menu');
            if (!currentPopup) {
                document.removeEventListener('click', closeHandler);
                return;
            }

            if (!currentPopup.contains(e.target) && e.target !== anchorElement) {
                removeExistingMenu();
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 10);
    
    input.focus();
}

function updateDatalist(datalist) {
    const allUsed = getAllUsedTags();
    datalist.innerHTML = '';
    allUsed.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        datalist.appendChild(option);
    });
}

function renderTagList(container, testId, tags, onUpdate) {
    container.innerHTML = '';
    if (tags.length === 0) {
        container.innerHTML = '<p style="color:#888; font-size:12px; margin: 10px 0;">Brak tagów.</p>';
        return;
    }
    
    tags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-edit';
        chip.innerHTML = `${tag} <span class="tag-remove">✕</span>`;
        
        chip.querySelector('.tag-remove').onclick = (e) => {
            e.stopPropagation(); // Zapobiegaj zamykaniu menu
            const updated = removeTagFromTest(testId, tag);
            renderTagList(container, testId, updated, onUpdate);
            if (onUpdate) onUpdate(updated);
        };
        
        container.appendChild(chip);
    });
}

function removeExistingMenu() {
    const existing = document.getElementById('active-tag-menu');
    if (existing) existing.remove();
}
