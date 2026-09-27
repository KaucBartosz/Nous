import { elements } from './ui.js';
import { escapeHtml } from './utils.js';

const CACHE_KEY = 'whats_new_cache_v2';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

let isInitialized = false;
let allReleases = [];
let currentIndex = 0;

export function initWhatsNew() {
    if (isInitialized) return;

    // Inicjalizacja elementów DOM
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const errorEl = document.getElementById('whats-new-error');
    const refreshBtn = document.getElementById('btn-refresh-whats-new');
    const githubBtn = document.getElementById('btn-open-github');
    const prevBtn = document.getElementById('btn-prev-release');
    const nextBtn = document.getElementById('btn-next-release');

    if (!contentEl || !loadingEl || !errorEl || !refreshBtn || !githubBtn || !prevBtn || !nextBtn) {
        console.error('Nie można znaleźć elementów DOM dla "Co nowego".');
        return;
    }

    // Obsługa przycisku odświeżania
    refreshBtn.addEventListener('click', () => {
        loadWhatsNew(true);
    });

    // Obsługa nawigacji
    prevBtn.addEventListener('click', () => {
        if (currentIndex < allReleases.length - 1) {
            currentIndex++;
            displayWhatsNew(allReleases[currentIndex]);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
            currentIndex--;
            displayWhatsNew(allReleases[currentIndex]);
        }
    });

    // Obsługa przycisku otwierania GitHub
    githubBtn.addEventListener('click', () => {
        const url = 'https://github.com/KaucBartosz/Nous/releases/';
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    });

    // Przechwytywanie wszystkich linków w kontenerze (w tym tych z Markdown)
    const container = document.querySelector('.whats-new-container');
    if (container) {
        container.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href && link.href.startsWith('http')) {
                e.preventDefault();
                if (window.electronAPI && window.electronAPI.openExternal) {
                    window.electronAPI.openExternal(link.href);
                } else {
                    window.open(link.href, '_blank');
                }
            }
        });
    }

    isInitialized = true;
}

export function loadWhatsNew(forceRefresh = false) {
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const errorEl = document.getElementById('whats-new-error');

    // Pokaż loader i ukryj inne elementy
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';

    // Spróbuj pobrać cache, jeśli nie wymuszamy odświeżenia
    if (!forceRefresh) {
        const cachedData = getCacheData();
        if (cachedData && cachedData.length > 0) {
            allReleases = cachedData;
            currentIndex = 0;
            displayWhatsNew(allReleases[currentIndex]);
            return;
        }
    }

    // Pobierz dane z GitHub API (listę 10 ostatnich wersji)
    fetchReleases()
        .then(data => {
            allReleases = data;
            currentIndex = 0;
            cacheData(allReleases);
            displayWhatsNew(allReleases[currentIndex]);
        })
        .catch(err => {
            console.error('Błąd podczas pobierania danych "Co nowego":', err);
            showErrorState();
        });
}

async function fetchReleases() {
    try {
        const response = await fetch('https://api.github.com/repos/KaucBartosz/Nous/releases?per_page=10', {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API zwróciło błąd: ${response.status}`);
        }

        const releases = await response.json();

        if (!Array.isArray(releases) || releases.length === 0) {
            throw new Error('Brak wersji w repozytorium');
        }

        return releases.map(release => ({
            title: release.name || release.tag_name,
            version: release.tag_name,
            date: new Date(release.published_at).toLocaleDateString('pl-PL'),
            body: release.body || 'Brak opisu.',
            html_url: release.html_url
        }));
    } catch (error) {
        console.error('Błąd podczas pobierania danych z GitHub API:', error);
        throw error;
    }
}

function displayWhatsNew(data) {
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const prevBtn = document.getElementById('btn-prev-release');
    const nextBtn = document.getElementById('btn-next-release');
    const indexSpan = document.getElementById('release-nav-index');

    if (!data) return;

    // Ukryj loader
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Aktualizacja nawigacji (indeks 0 to najnowsza wersja)
    prevBtn.disabled = (currentIndex >= allReleases.length - 1);
    nextBtn.disabled = (currentIndex <= 0);
    indexSpan.textContent = `${currentIndex + 1} / ${allReleases.length}`;

    // Przewiń do góry przy zmianie wersji
    const container = document.querySelector('.content-area');
    if (container) container.scrollTop = 0;

    contentEl.innerHTML = `
        <div class="release-header">
            <h4>${escapeHtml(data.title)}</h4>
            <div class="release-meta">
                <span class="version-badge">Wersja: ${escapeHtml(data.version)}</span>
                <span class="release-date">Data wydania: ${escapeHtml(data.date)}</span>
            </div>
        </div>
        <div class="release-body"></div>
        <div class="release-actions">
            <a href="${escapeHtml(data.html_url)}" target="_blank" class="btn primary small">
                <span class="material-icons">open_in_new</span> Zobacz szczegóły tej wersji na GitHubie
            </a>
        </div>
    `;

    // Render treści opisu jako bezpieczny tekst (textContent — brak HTML z sieci)
    renderReleaseBody(contentEl.querySelector('.release-body'), data.body);
}

/**
 * Renderuje opis wydania (Markdown z GitHuba) jako zwykły tekst:
 * nagłówki #, listy -/*, reszta jako akapity. Wszystko przez textContent,
 * więc wstrzyknięcie HTML/JS jest niemożliwe (nie potrzeba sanitizera).
 */
function renderReleaseBody(container, markdown) {
    if (!container) return;
    container.textContent = '';
    if (!markdown) return;

    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    let list = null;
    lines.forEach(rawLine => {
        const line = rawLine.trim();
        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        const item = line.match(/^[-*]\s+(.*)$/);
        if (heading) {
            list = null;
            const h = document.createElement('h' + heading[1].length);
            h.textContent = heading[2];
            container.appendChild(h);
        } else if (item) {
            if (!list) {
                list = document.createElement('ul');
                container.appendChild(list);
            }
            const li = document.createElement('li');
            li.textContent = item[1];
            list.appendChild(li);
        } else if (line === '') {
            list = null;
        } else {
            list = null;
            const p = document.createElement('p');
            p.textContent = rawLine;
            container.appendChild(p);
        }
    });
}

function showErrorState() {
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const errorEl = document.getElementById('whats-new-error');

    loadingEl.style.display = 'none';
    contentEl.style.display = 'none';
    errorEl.style.display = 'block';
}

function cacheData(data) {
    try {
        const cache = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Błąd podczas zapisywania cache:', error);
    }
}

function getCacheData() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const cache = JSON.parse(cached);
        const now = Date.now();

        // Sprawdź ważność cache
        if (now - cache.timestamp > CACHE_EXPIRY) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        return cache.data;
    } catch (error) {
        console.error('Błąd podczas odczytywania cache:', error);
        return null;
    }
}

// Eksport funkcji przełączania widoku (dla app.js)
export function loadWhatsNewView() {
    initWhatsNew();
    loadWhatsNew(false);
}
