import { elements } from './ui.js';

const CACHE_KEY = 'whats_new_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

let isInitialized = false;

export function initWhatsNew() {
    if (isInitialized) return;

    // Inicjalizacja elementów DOM - używamy document.getElementById zamiast elements.XXX
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const errorEl = document.getElementById('whats-new-error');
    const refreshBtn = document.getElementById('btn-refresh-whats-new');
    const githubBtn = document.getElementById('btn-open-github');

    console.log('Elements for Whats New:', {
        contentEl,
        loadingEl,
        errorEl,
        refreshBtn,
        githubBtn
    });

    if (!contentEl || !loadingEl || !errorEl || !refreshBtn || !githubBtn) {
        console.error('Nie można znaleźć elementów DOM dla "Co nowego".');
        return;
    }

    // Obsługa przycisku odświeżania
    refreshBtn.addEventListener('click', () => {
        loadWhatsNew(true);
    });

    // Obsługa przycisku otwierania GitHub
    githubBtn.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal('https://github.com/KaucBartosz/Nous/releases/');
        } else {
            window.open('https://github.com/KaucBartosz/Nous/releases/', '_blank');
        }
    });

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
        if (cachedData) {
            displayWhatsNew(cachedData);
            return;
        }
    }

    // Pobierz dane z GitHub API
    fetchLatestRelease()
        .then(data => {
            cacheData(data);
            displayWhatsNew(data);
        })
        .catch(err => {
            console.error('Błąd podczas pobierania danych "Co nowego":', err);
            showErrorState();
        });
}

async function fetchLatestRelease() {
    try {
        const response = await fetch('https://api.github.com/repos/KaucBartosz/Nous/releases/latest', {
            headers: {
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API zwróciło błąd: ${response.status}`);
        }

        const release = await response.json();

        if (!release || !release.tag_name || !release.body) {
            throw new Error('Nieprawidłowa odpowiedź z GitHub API');
        }

        return {
            title: release.name || release.tag_name,
            version: release.tag_name,
            date: new Date(release.published_at).toLocaleDateString('pl-PL'),
            body: release.body || 'Brak opisu.',
            html_url: release.html_url
        };
    } catch (error) {
        console.error('Błąd podczas pobierania danych z GitHub API:', error);
        throw error;
    }
}

function displayWhatsNew(data) {
    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');

    // Ukryj loader
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    // Konwersja Markdown na HTML (prosta implementacja)
    const htmlContent = convertMarkdownToHTML(data.body);

    contentEl.innerHTML = `
        <div class="release-header">
            <h4>${escapeHtml(data.title)}</h4>
            <div class="release-meta">
                <span class="version-badge">Wersja: ${escapeHtml(data.version)}</span>
                <span class="release-date">Data wydania: ${escapeHtml(data.date)}</span>
            </div>
        </div>
        <div class="release-body">
            ${htmlContent}
        </div>
        <div class="release-actions">
            <a href="${escapeHtml(data.html_url)}" target="_blank" class="btn primary small">
                <span class="material-icons">open_in_new</span> Zobacz na GitHubie
            </a>
        </div>
    `;
}

function convertMarkdownToHTML(markdown) {
    if (!markdown) return '';

    // Normalize line endings
    let html = markdown.replace(/\r\n/g, '\n');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Images syntax: ![alt](url)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; border-radius: 4px; margin: 10px 0; display: block;">');

    // Links: [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // Existing <img ... /> tags (often produced by GitHub for attachments)
    // We adjust them to ensure they are responsive and block-level
    html = html.replace(/<img (.*?)src=["'](.*?)["'](.*?)>/g, '<img src="$2" $1 $3 style="max-width: 100%; height: auto; border-radius: 4px; margin: 10px 0; display: block;">');

    // List items (dash and asterisk)
    const lines = html.split('\n');
    let inList = false;
    const processedLines = lines.map(line => {
        const listMatch = line.match(/^[*-] (.+)$/);
        if (listMatch) {
            let result = '';
            if (!inList) {
                result = '<ul>';
                inList = true;
            }
            result += `<li>${listMatch[1]}</li>`;
            return result;
        } else {
            if (inList) {
                inList = false;
                return '</ul>' + line;
            }
            return line;
        }
    });

    if (inList) processedLines.push('</ul>');
    html = processedLines.join('\n');

    // Newlines to <br> (only for lines that don't look like HTML block tags)
    html = html.split('\n').map(line => {
        if (line.match(/^<(h[1-3]|ul|li|img|div)/) || line.match(/<\/(ul|li|div)>$/)) return line;
        if (line.trim() === '') return '<br>';
        return line + '<br>';
    }).join('\n');

    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
