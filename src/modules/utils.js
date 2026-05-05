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
        // Status weights for sorting:
        // 1 - Needs update (installed & outdated)
        // 2 - Installed & current
        // 3 - Not installed
        const getStatusWeight = (test) => {
            if (test.local_ver > 0) {
                return test.local_ver < test.remote_ver ? 1 : 2;
            }
            return 3;
        };

        const weightA = getStatusWeight(a);
        const weightB = getStatusWeight(b);

        if (weightA !== weightB) {
            return weightA - weightB;
        }

        // Within the same group, sort alphabetically by name
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
    } else {
        // Tryb Web (Aplikacja w przeglądarce)
        try {
            const res = await fetch('tests-registry.json');
            if (res.ok) {
                const registry = await res.json();
                const webVersions = {};
                // Konwertuje strukturę JSON na lokalny format (local_ver)
                // Zakładamy, że w registry np: { id: "bystreOczko", version: 1, name: "...", webPath: "tests/bystreOczko/index.html" }
                registry.forEach(test => {
                    webVersions[test.id] = {
                        version: test.version || 1,
                        hasPython: false,
                        isLocalDev: false,
                        name: test.name,
                        description: test.description,
                        webPath: test.path || ''
                    };
                });
                localVersionsCache = webVersions;
                lastFetchTime = now;
            } else {
                localVersionsCache = {};
            }
        } catch (err) {
            console.warn("Tryb Web: Błąd pobierania tests-registry.json", err);
            localVersionsCache = {};
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
export function flattenObject(obj, target, prefix = '', visited = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') return;
    if (visited.has(obj)) return; // circular ref guard
    visited.add(obj);
    
    for (const [key, value] of Object.entries(obj)) {
        // Oblicz nowy klucz, jeśli prefix jest pusty to nie dodawaj separatora na początku
        const newKey = prefix ? `${prefix} - ${key}` : key;
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenObject(value, target, newKey, visited);
        } else {
            target[newKey] = Array.isArray(value) ? JSON.stringify(value) : value;
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

// ==========================================================
// NEW COMMON UTILITIES
// ==========================================================

/**
 * Formats a Date object to a consistent display string.
 * @param {Date|string|number} date - The date to format.
 * @param {boolean} includeTime - Whether to include the time in the output.
 * @returns {string} - The formatted date string.
 */
export function formatDate(date, includeTime = true) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(includeTime && {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    };
    
    return d.toLocaleString(undefined, options);
}

/**
 * Copies text to the clipboard and handles success/error.
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers or insecure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                document.body.removeChild(textArea);
                console.error("Fallback copy to clipboard failed", err);
                return false;
            }
        }
    } catch (err) {
        console.error("Failed to copy to clipboard", err);
        return false;
    }
}

/**
 * Validates an ID against allowed characters (alphanumeric, dash, underscore).
 * @param {string} id - The ID to validate.
 * @returns {boolean}
 */
export function isValidId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[a-zA-Z0-9_-]+$/.test(id);
}
