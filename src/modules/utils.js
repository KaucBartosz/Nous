// src/modules/utils.js
// Wspólne narzędzia i funkcje pomocnicze

/**
 * Sortuje testy według statusu instalacji:
 * 1. Testy wymagające aktualizacji (installed + outdated)
 * 2. Testy zainstalowane (aktualne)
 * 3. Testy niezainstalowane
 * W ramach grup - alfabetycznie po nazwie
 * 
 * @param {Array} tests - Lista testów z polami local_ver i remote_ver
 * @returns {Array} - Posortowana lista
 */
export function sortByInstallStatus(tests) {
    return tests.sort((a, b) => {
        const aUpdate = a.local_ver > 0 && a.local_ver < a.remote_ver;
        const bUpdate = b.local_ver > 0 && b.local_ver < b.remote_ver;

        if (aUpdate && !bUpdate) return -1;
        if (!aUpdate && bUpdate) return 1;

        const aInstalled = a.local_ver > 0;
        const bInstalled = b.local_ver > 0;

        if (aInstalled && !bInstalled) return -1;
        if (!aInstalled && bInstalled) return 1;

        return (a.name || '').localeCompare(b.name || '');
    });
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} text 
 * @returns {string}
 */
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce - opóźnia wykonanie funkcji do momentu gdy użytkownik
 * przestanie wywoływać ją przez określony czas.
 * 
 * @param {Function} fn - Funkcja do opóźnienia
 * @param {number} delay - Opóźnienie w milisekundach (domyślnie 200ms)
 * @returns {Function} - Opóźniona wersja funkcji
 */
export function debounce(fn, delay = 200) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

// ==========================================================
// CACHE WERSJI LOKALNYCH
// ==========================================================

let localVersionsCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 5000; // 5 sekund

/**
 * Pobiera wersje lokalne z cache lub z API (jeśli cache wygasł).
 * @returns {Promise<Object>} - Obiekt {testId: version}
 */
export async function getLocalVersionsCached() {
    const now = Date.now();

    // Sprawdź czy cache jest aktualny
    if (localVersionsCache && (now - lastFetchTime < CACHE_TTL)) {
        return localVersionsCache;
    }

    // Pobierz świeże dane
    if (window.electronAPI) {
        try {
            localVersionsCache = await window.electronAPI.getLocalVersions();
            lastFetchTime = now;
        } catch (e) {
            console.error("Error fetching local versions:", e);
            return localVersionsCache || {};
        }
    }

    return localVersionsCache || {};
}

/**
 * Unieważnia cache wersji lokalnych (np. po instalacji/usunięciu testu).
 */
export function invalidateLocalVersionsCache() {
    localVersionsCache = null;
    lastFetchTime = 0;
}

// ==========================================================
// FLATTEN OBJECT (Shared helper)
// ==========================================================

/**
 * Spłaszcza zagnieżdżony obiekt do jednopoziomowego słownika.
 * Używane przy eksporcie CSV wyników.
 * @param {Object} obj - Obiekt do spłaszczenia
 * @param {Object} target - Obiekt docelowy (modyfikowany in-place)
 * @param {string} prefix - Prefiks dla kluczy
 */
export function flattenObject(obj, target, prefix) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], target, `${prefix} - ${key}`);
        } else {
            target[`${prefix} - ${key}`] = Array.isArray(obj[key]) ? JSON.stringify(obj[key]) : obj[key];
        }
    }
}

// ==========================================================
// UPDATES BADGE
// ==========================================================

/**
 * Aktualizuje licznik badge'a na zakładce "Aktualizacje".
 * @param {number} count - Całkowita liczba dostępnych aktualizacji do wyświetlenia
 */
export function updateUpdatesBadge(count) {
    const badge = document.getElementById('updates-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}
