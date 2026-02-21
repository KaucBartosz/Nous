// src/modules/library.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from './ui.js';
import { Dialog } from './dialog.js';
import { sortByInstallStatus, debounce, getLocalVersionsCached, invalidateLocalVersionsCache } from './utils.js';

let cachedTests = [];
let isSearchBound = false;
let listenersRegistered = false; // Flaga zapobiegająca wielokrotnej rejestracji
let currentViewMode = 'grid'; // 'grid', 'list', 'table', 'compact'
let isTrainingMode = false;
let isHpmEnabled = false;

export function getTrainingMode() {
    return isTrainingMode;
}

export function getHpmEnabled() {
    return isHpmEnabled;
}

// View mode button references
const viewButtons = {
    grid: null,
    list: null,
    table: null,
    compact: null
};

/**
 * Inicjalizuje listenery Electron API (wywołaj raz).
 */
export function initLibraryListeners() {
    if (listenersRegistered || !window.electronAPI) return;

    window.electronAPI.onDownloadProgress(({ test_id, percent }) => {
        const btn = document.getElementById(`start-test-${test_id}`);
        if (btn) {
            const progressText = btn.querySelector('.progress-text');
            const progressBar = btn.querySelector('.progress-bar');

            if (progressText && progressBar) {
                progressText.textContent = `${percent}%`;
                progressBar.style.width = `${percent}%`;
            } else {
                // Fallback / Initial structure
                btn.innerHTML = `
                    <div style="display:flex; align-items:center; gap:5px; z-index:1; position:relative;">
                         <span class="material-icons spin">sync</span> 
                         <span class="progress-text">${percent}%</span>
                    </div>
                    <div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:rgba(0,0,0,0.3);">
                        <div class="progress-bar" style="width:${percent}%; height:100%; background:#4caf50;"></div>
                    </div>
                `;
                btn.style.position = 'relative';
                btn.style.overflow = 'hidden';
                btn.disabled = true;
            }
        }
    });

    window.electronAPI.onTestInstalled((data) => {
        console.log("Test installed, refreshing library:", data);
        invalidateLocalVersionsCache(); // Unieważnij cache
        loadTestsList(undefined, true); // Force refresh
    });

    window.electronAPI.onHpmDownloadProgress((percent) => {
        console.log(`HPM Download: ${percent}%`);
        const statusLabel = document.getElementById('hpm-status-label');
        if (statusLabel) statusLabel.textContent = `Pobieranie: ${percent}%`;
    });

    window.electronAPI.onHpmInstalled((success) => {
        if (success) {
            Dialog.alert("Silnik Python (HPM) został zainstalowany pomyślnie!", 'success');
        } else {
            Dialog.alert("Błąd podczas instalacji silnika Python.", 'error');
            if (elements.toggleHPM) elements.toggleHPM.checked = false;
            isHpmEnabled = false;
        }
        const statusLabel = document.getElementById('hpm-status-label');
        if (statusLabel) statusLabel.textContent = '';
    });

    listenersRegistered = true;
}

export function initViewSwitcher() {
    viewButtons.grid = document.getElementById('view-grid');
    viewButtons.list = document.getElementById('view-list');
    viewButtons.table = document.getElementById('view-table');
    viewButtons.compact = document.getElementById('view-compact');

    // Load saved preference
    const savedView = localStorage.getItem('libraryViewMode');
    if (savedView && viewButtons[savedView]) {
        currentViewMode = savedView;
        updateViewButtonStates();
    }

    // Bind click events for view switching
    Object.entries(viewButtons).forEach(([mode, btn]) => {
        if (btn) {
            btn.addEventListener('click', () => {
                if (currentViewMode !== mode) {
                    currentViewMode = mode;
                    localStorage.setItem('libraryViewMode', mode);
                    updateViewButtonStates();
                    // Re-render with current filter
                    const searchInput = document.getElementById('library-search');
                    const filterText = searchInput ? searchInput.value : '';
                    renderTests(cachedTests, filterText);
                }
            });
        }
    });

    // Bind search input event with DEBOUNCE (only once)
    if (!isSearchBound) {
        const searchInput = document.getElementById('library-search');
        if (searchInput) {
            const debouncedSearch = debounce((filterText) => {
                renderTests(cachedTests, filterText);
            }, 200);

            searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });
            isSearchBound = true;
        }
    }

    // Bind Training Mode toggle
    if (elements.toggleTrainingMode) {
        isTrainingMode = localStorage.getItem('trainingMode') === 'true';
        elements.toggleTrainingMode.checked = isTrainingMode;

        elements.toggleTrainingMode.addEventListener('change', (e) => {
            isTrainingMode = e.target.checked;
            localStorage.setItem('trainingMode', isTrainingMode);
        });
    }

    // Bind HPM toggle
    if (elements.toggleHPM) {
        // Load HPM state from storage - Default to OFF (false)
        const savedHpm = localStorage.getItem('hpmEnabled');
        isHpmEnabled = savedHpm === 'true'; // If null or 'false', stays false
        elements.toggleHPM.checked = isHpmEnabled;

        elements.toggleHPM.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Check if user on Linux
                const isLinux = window.navigator.platform.toLowerCase().includes('linux');

                // Check if engine exists
                const engineExists = await window.electronAPI.getHpmStatus();
                if (!engineExists) {
                    if (isLinux) {
                        await Dialog.alert(
                            "<strong>Instalacja HPM na Linux</strong><br><br>" +
                            "Wsparcie dla Linux wymaga samodzielnego przygotowania środowiska Python. Launcher szuka interpretera w folderze:<br>" +
                            "<code>~/.config/nous/python_env/bin/python3</code><br><br>" +
                            "<strong>Wymagania:</strong><br>" +
                            "• <b>Środowisko:</b> Virtualenv oparty na <b>Python 3.11</b> (najlepsza kompatybilność).<br>" +
                            "• <b>Pakiety Python:</b> <code>psychopy, numpy, scipy, pandas, pyglet, wxPython</code>.<br>" +
                            "• <b>Zależności systemowe:</b> Biblioteki <i>SDL2, libjpeg (v8), libtiff (v5), GTK3</i>.<br><br>" +
                            "Przykładowa ścieżka instalacji (może wymagać dociągnięcia zależności systemowych):<br>" +
                            "<div style='position:relative; margin:10px 0;'>" +
                            "<pre id='linux-hpm-cmd' style='background:#1e1e1e;color:#eee;padding:12px 65px 12px 12px;font-size:12px;user-select:all;white-space:pre;text-align:left;border-radius:6px;border:1px solid #333;margin:0;line-height:1.4;max-height:150px;overflow:auto;'>" +
                            "mkdir -p ~/.config/nous/python_env\n" +
                            "python3.11 -m venv ~/.config/nous/python_env\n" +
                            "~/.config/nous/python_env/bin/python3 -m pip install -U pip setuptools wheel\n" +
                            "~/.config/nous/python_env/bin/python3 -m pip install psychopy numpy scipy pandas pyglet" +
                            "</pre>" +
                            "<button onclick=\"navigator.clipboard.writeText(document.getElementById('linux-hpm-cmd').innerText); this.textContent='OK!'; setTimeout(() => this.textContent='Kopiuj', 1500);\" style='position:absolute;top:8px;right:8px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:bold;transition:0.2s;'>Kopiuj</button>" +
                            "</div>" +
                            "Jeśli <i>wxPython</i> zgłasza błędy (np. brak <i>libjpeg.so.8</i>), należy zainstalować odpowiednie paczki 'compat' lub utworzyć symlinki w <code>/usr/lib64</code> zgodnie z dokumentacją Twojej dystrybucji.",
                            'info'
                        );
                        e.target.checked = false;
                        return;
                    }

                    const confirm = await Dialog.confirm(
                        "Tryb Wysokiej Precyzji (HPM) zapewnia najwyższą dokładność pomiaru parametrów czasowych poprzez natywne wykonywanie testów. Aktywacja tego trybu wymaga jednorazowego pobrania specjalistycznego pakietu zasobów (ok. 300MB). Czy chcesz kontynuować?",
                        'info'
                    );

                    if (confirm) {
                        isHpmEnabled = true;
                        localStorage.setItem('hpmEnabled', 'true');
                        // Dodaj label stanu pod toggle (opcjonalnie, lub użyj istniejącego mechanizmu)
                        let statusLabel = document.getElementById('hpm-status-label');
                        if (!statusLabel) {
                            statusLabel = document.createElement('span');
                            statusLabel.id = 'hpm-status-label';
                            statusLabel.style.cssText = 'font-size: 10px; color: var(--primary); margin-left: 10px;';
                            elements.toggleHPM.parentElement.parentElement.appendChild(statusLabel);
                        }
                        statusLabel.textContent = 'Pobieranie...';
                        window.electronAPI.downloadHpmEngine();
                    } else {
                        e.target.checked = false;
                        isHpmEnabled = false;
                    }
                } else {
                    isHpmEnabled = true;
                    localStorage.setItem('hpmEnabled', 'true');
                }
            } else {
                isHpmEnabled = false;
                localStorage.setItem('hpmEnabled', 'false');
            }
        });
    }

    // Init Electron listeners
    initLibraryListeners();
}

function updateViewButtonStates() {
    Object.entries(viewButtons).forEach(([mode, btn]) => {
        if (btn) {
            btn.classList.toggle('active', mode === currentViewMode);
        }
    });
}

export async function loadTestsList(filterText = '', forceRefresh = false) {
    // 1. Fetch from Cloud if needed
    if (!cachedTests.length || forceRefresh) {
        elements.testsGrid.innerHTML = '<p style="color:#888;">Ładowanie biblioteki...</p>';
        try {
            // Check if online before trying cloud fetch to avoid long timeouts
            if (!navigator.onLine) {
                throw new Error("Brak połączenia internetowego (navigator.onLine)");
            }

            const snap = await getDocs(collection(db, "tests"));
            cachedTests = []; // Clear cache

            if (snap.empty) {
                elements.testsGrid.innerHTML = '<p>Brak testów w chmurze.</p>';
                return;
            }

            snap.forEach(doc => {
                const t = doc.data();
                t.id = doc.id;
                t.local_ver = 0; // Will be updated below
                t.remote_ver = Number(t.version);
                cachedTests.push(t);
            });

            // Save to local cache for offline usage
            localStorage.setItem('cached_tests_metadata', JSON.stringify(cachedTests));

        } catch (e) {
            console.warn("Błąd ładowania danych z chmury (prawdopodobnie brak Internetu):", e);

            // Try to load from local storage cache
            const saved = localStorage.getItem('cached_tests_metadata');
            if (saved) {
                try {
                    cachedTests = JSON.parse(saved);
                    console.log("Załadowano listę testów z cache lokalnego.");
                } catch (jsonErr) {
                    console.error("Błąd parsowania cache lokalnego:", jsonErr);
                }
            }
        }
    }

    // 2. Always update local versions (using cached getter)
    const localVersions = await getLocalVersionsCached();
    const scannedPath = localVersions.__scannedDir || 'nieznana';

    cachedTests.forEach(t => {
        const local = localVersions[t.id];
        if (local) {
            t.local_ver = Number(local.version);
            t.hasPython = local.hasPython;
        } else {
            t.local_ver = 0;
            t.hasPython = false;
        }
    });

    // 3. Backfill tests from disk that are missing from metadata 
    // This allows showing already downloaded tests even if they are not in the cloud/cache list
    Object.keys(localVersions).forEach(testId => {
        if (testId === '__scannedDir') return; // Skip debug field

        if (!cachedTests.find(t => t.id === testId)) {
            const local = localVersions[testId];
            if (local.version >= 0) {
                cachedTests.push({
                    id: testId,
                    name: local.name || `Test lokalny (${testId})`,
                    description: local.description || 'Pobrano wcześniej.',
                    version: local.version || 0,
                    local_ver: Number(local.version || 0),
                    remote_ver: Number(local.version || 0),
                    hasPython: local.hasPython,
                    download_url: ''
                });
            }
        }
    });

    if (cachedTests.length === 0) {
        elements.testsGrid.innerHTML = `
            <div style="text-align:center; padding:40px; color:#888;">
                <span class="material-icons" style="font-size:48px; margin-bottom:15px;">signal_wifi_off</span>
                <p>Brak połączenia z Internetem i nie znaleziono pobranych testów.</p>
                <p style="font-size:11px; margin-top:10px;">Przeszukano folder:<br><code style="background:rgba(255,255,255,0.05); padding:2px 5px; border-radius:3px;">${scannedPath}</code></p>
                <button class="btn secondary small" onclick="location.reload()" style="margin-top:20px;">Spróbuj ponownie</button>
            </div>
        `;
    } else {
        renderTests(cachedTests, filterText);
    }
}

function getTestStatus(t) {
    const local_ver = t.local_ver;
    const remote_ver = t.remote_ver;

    if (local_ver === 0) {
        return {
            iconName: 'cloud_download',
            iconColor: '#888',
            iconTitle: 'Nie pobrano',
            btnText: 'Pobierz',
            btnClass: 'primary',
            statusText: 'Nie pobrano',
            versionParam: remote_ver
        };
    } else if (local_ver < remote_ver) {
        return {
            iconName: 'system_update',
            iconColor: '#ff9800',
            iconTitle: 'Dostępna aktualizacja',
            btnText: 'Uruchom',
            btnClass: 'outline',
            statusText: 'Aktualizacja dostępna',
            versionParam: local_ver
        };
    } else {
        return {
            iconName: 'check_circle',
            iconColor: '#4caf50',
            iconTitle: 'Zainstalowano',
            btnText: 'Uruchom',
            btnClass: 'primary',
            statusText: 'Zainstalowano',
            versionParam: local_ver
        };
    }
}

function renderTests(testsSource, filterText) {
    elements.testsGrid.innerHTML = '';

    let tests = [...testsSource];

    // 1. Filter
    if (filterText) {
        const lower = filterText.toLowerCase();
        tests = tests.filter(t => (t.name || '').toLowerCase().includes(lower));
    }

    if (tests.length === 0) {
        elements.testsGrid.innerHTML = '<p>Brak wyników wyszukiwania.</p>';
        return;
    }

    // 2. Sort (using shared utility)
    tests = sortByInstallStatus(tests);

    // 3. Render based on current view mode
    switch (currentViewMode) {
        case 'list':
            renderListView(tests);
            break;
        case 'table':
            renderTableView(tests);
            break;
        case 'compact':
            renderCompactView(tests);
            break;
        case 'grid':
        default:
            renderGridView(tests);
            break;
    }
}

function renderGridView(tests) {
    elements.testsGrid.className = 'grid-container';

    tests.forEach(t => {
        const status = getTestStatus(t);
        const test_id = t.id;

        // Create card structure safely
        const card = document.createElement('div');
        card.className = 'test-card';

        // Top section with icons
        const topDiv = document.createElement('div');
        topDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:start;';

        const iconsDiv = document.createElement('div');
        iconsDiv.style.cssText = 'display:flex; align-items:center; gap:10px;';

        const assignmentIcon = document.createElement('span');
        assignmentIcon.className = 'material-icons';
        assignmentIcon.style.cssText = 'font-size:40px; color:#444;';
        assignmentIcon.textContent = 'assignment';

        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.style.cssText = `color:${status.iconColor}; font-size:24px;`;
        statusIcon.title = status.iconTitle;
        statusIcon.textContent = status.iconName;

        iconsDiv.appendChild(assignmentIcon);
        iconsDiv.appendChild(statusIcon);

        const versionSpan = document.createElement('span');
        versionSpan.className = 'meta';
        versionSpan.style.cssText = 'color: #666; display: flex; align-items: center; gap: 8px;';

        if (t.hasPython) {
            const badge = document.createElement('span');
            badge.className = 'hpm-badge';
            badge.textContent = 'HPM';
            badge.title = 'Ten test wspiera tryb wysokiej precyzji (Python/PsychoPy)';
            versionSpan.appendChild(badge);
        }

        versionSpan.appendChild(document.createTextNode(`v${t.version}`));

        topDiv.appendChild(iconsDiv);
        topDiv.appendChild(versionSpan);

        // Title
        const title = document.createElement('h4');
        title.style.marginTop = '10px';
        title.textContent = t.name || 'Bez nazwy';

        // Description
        const description = document.createElement('p');
        description.textContent = t.description || 'Brak opisu';

        // Button
        const button = document.createElement('button');
        button.className = `btn ${status.btnClass} small`;
        button.style.marginTop = 'auto';
        button.id = `start-test-${test_id}`;

        const playIcon = document.createElement('span');
        playIcon.className = 'material-icons';
        playIcon.textContent = 'play_arrow';

        button.appendChild(playIcon);
        button.appendChild(document.createTextNode(` ${status.btnText}`));

        // Assemble card
        card.appendChild(topDiv);
        card.appendChild(title);
        card.appendChild(description);
        card.appendChild(button);

        elements.testsGrid.appendChild(card);

        // Bind click event
        button.addEventListener('click', () => {
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam, t.name, t.description);
        });
    });
}

function renderListView(tests) {
    elements.testsGrid.className = 'list-container';

    tests.forEach(t => {
        const status = getTestStatus(t);
        const test_id = t.id;

        const item = document.createElement('div');
        item.className = 'test-list-item';

        // Icon section
        const iconDiv = document.createElement('div');
        iconDiv.className = 'list-icon';

        const assignmentIcon = document.createElement('span');
        assignmentIcon.className = 'material-icons';
        assignmentIcon.textContent = 'assignment';

        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.style.color = status.iconColor;
        statusIcon.style.fontSize = '20px';
        statusIcon.title = status.iconTitle;
        statusIcon.textContent = status.iconName;

        iconDiv.appendChild(assignmentIcon);
        iconDiv.appendChild(statusIcon);

        // Info section
        const infoDiv = document.createElement('div');
        infoDiv.className = 'list-info';

        const title = document.createElement('h4');
        title.textContent = t.name || 'Bez nazwy';

        const desc = document.createElement('p');
        desc.textContent = t.description || 'Brak opisu';

        infoDiv.appendChild(title);
        infoDiv.appendChild(desc);

        // Meta section
        const metaDiv = document.createElement('div');
        metaDiv.className = 'list-meta';

        const versionSpan = document.createElement('span');
        versionSpan.style.display = 'flex';
        versionSpan.style.alignItems = 'center';
        versionSpan.style.gap = '8px';

        if (t.hasPython) {
            const badge = document.createElement('span');
            badge.className = 'hpm-badge small';
            badge.textContent = 'HPM';
            versionSpan.appendChild(badge);
        }
        versionSpan.appendChild(document.createTextNode(`v${t.version}`));

        const statusSpan = document.createElement('span');
        statusSpan.style.color = status.iconColor;
        statusSpan.textContent = status.statusText;

        metaDiv.appendChild(versionSpan);
        metaDiv.appendChild(statusSpan);

        // Actions section
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'list-actions';

        const button = document.createElement('button');
        button.className = `btn ${status.btnClass} small`;
        button.id = `start-test-${test_id}`;

        const playIcon = document.createElement('span');
        playIcon.className = 'material-icons';
        playIcon.textContent = 'play_arrow';

        button.appendChild(playIcon);
        button.appendChild(document.createTextNode(` ${status.btnText}`));

        actionsDiv.appendChild(button);

        // Assemble item
        item.appendChild(iconDiv);
        item.appendChild(infoDiv);
        item.appendChild(metaDiv);
        item.appendChild(actionsDiv);

        elements.testsGrid.appendChild(item);

        // Bind click event
        button.addEventListener('click', () => {
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam, t.name, t.description);
        });
    });
}

function renderTableView(tests) {
    elements.testsGrid.className = 'library-table-container';

    const table = document.createElement('table');
    table.className = 'library-table';

    // Header
    const thead = document.createElement('thead');
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
    const tbody = document.createElement('tbody');

    tests.forEach(t => {
        const status = getTestStatus(t);
        const test_id = t.id;

        const row = document.createElement('tr');

        // Name cell
        const nameCell = document.createElement('td');
        nameCell.style.fontWeight = '500';
        nameCell.textContent = t.name || 'Bez nazwy';

        // Description cell
        const descCell = document.createElement('td');
        descCell.style.color = '#888';
        descCell.style.maxWidth = '300px';
        descCell.style.overflow = 'hidden';
        descCell.style.textOverflow = 'ellipsis';
        descCell.style.whiteSpace = 'nowrap';
        descCell.textContent = t.description || 'Brak opisu';

        // Version cell
        const versionCell = document.createElement('td');
        versionCell.textContent = `v${t.version}`;

        // Status cell
        const statusCell = document.createElement('td');
        const statusDiv = document.createElement('div');
        statusDiv.className = 'status-cell';

        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.style.color = status.iconColor;
        statusIcon.style.fontSize = '18px';
        statusIcon.textContent = status.iconName;

        const statusText = document.createElement('span');
        statusText.style.color = status.iconColor;
        statusText.textContent = status.statusText;

        statusDiv.appendChild(statusIcon);
        statusDiv.appendChild(statusText);
        statusCell.appendChild(statusDiv);

        // Action cell
        const actionCell = document.createElement('td');
        const button = document.createElement('button');
        button.className = `btn ${status.btnClass} small`;
        button.id = `start-test-${test_id}`;

        const playIcon = document.createElement('span');
        playIcon.className = 'material-icons';
        playIcon.textContent = 'play_arrow';

        button.appendChild(playIcon);
        button.appendChild(document.createTextNode(` ${status.btnText}`));
        actionCell.appendChild(button);

        // Assemble row
        row.appendChild(nameCell);
        row.appendChild(descCell);
        row.appendChild(versionCell);
        row.appendChild(statusCell);
        row.appendChild(actionCell);

        tbody.appendChild(row);

        // Bind click event
        button.addEventListener('click', () => {
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam, t.name, t.description);
        });
    });

    table.appendChild(tbody);
    elements.testsGrid.appendChild(table);
}

function renderCompactView(tests) {
    elements.testsGrid.className = 'compact-grid';

    tests.forEach(t => {
        const status = getTestStatus(t);
        const test_id = t.id;

        const card = document.createElement('div');
        card.className = 'test-card-compact';

        // Header with status icon
        const headerDiv = document.createElement('div');
        headerDiv.className = 'compact-header';

        const statusIcon = document.createElement('span');
        statusIcon.className = 'material-icons';
        statusIcon.style.color = status.iconColor;
        statusIcon.title = status.iconTitle;
        statusIcon.textContent = status.iconName;

        headerDiv.appendChild(statusIcon);

        // Title
        const title = document.createElement('h4');
        title.textContent = t.name || 'Bez nazwy';

        // Footer with version and button
        const footerDiv = document.createElement('div');
        footerDiv.className = 'compact-footer';

        const versionSpan = document.createElement('span');
        versionSpan.className = 'compact-version';
        versionSpan.style.display = 'flex';
        versionSpan.style.alignItems = 'center';
        versionSpan.style.gap = '4px';

        if (t.hasPython) {
            const badge = document.createElement('span');
            badge.className = 'hpm-badge compact';
            badge.textContent = 'HPM';
            versionSpan.appendChild(badge);
        }
        versionSpan.appendChild(document.createTextNode(`v${t.version}`));

        const button = document.createElement('button');
        button.className = `btn ${status.btnClass} compact`;
        button.id = `start-test-${test_id}`;

        const playIcon = document.createElement('span');
        playIcon.className = 'material-icons';
        playIcon.style.fontSize = '14px';
        playIcon.textContent = 'play_arrow';

        button.appendChild(playIcon);

        footerDiv.appendChild(versionSpan);
        footerDiv.appendChild(button);

        // Assemble card
        card.appendChild(headerDiv);
        card.appendChild(title);
        card.appendChild(footerDiv);

        elements.testsGrid.appendChild(card);

        // Bind click event
        button.addEventListener('click', () => {
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam, t.name, t.description);
        });
    });
}

export async function startTestProcess(url, id, ver, name = '', description = '') {
    if (window.electronAPI) {
        // Change button state immediately
        const btn = document.getElementById(`start-test-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <div style="display:flex; align-items:center; gap:5px; z-index:1; position:relative;">
                    <span class="material-icons spin">sync</span>
                    <span class="progress-text">Inicjowanie...</span>
                </div>
                <div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:rgba(0,0,0,0.3);">
                    <div class="progress-bar" style="width:0%; height:100%; background:#4caf50;"></div>
                </div>
            `;
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
        }

        window.electronAPI.downloadAndRun(url, id, ver, false, isHpmEnabled, isTrainingMode, name, description);
    } else await Dialog.alert("Brak Electrona", 'error');
}
