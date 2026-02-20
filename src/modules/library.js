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
                        // Linux Manual Instructions
                        await Dialog.alert(
                            "Instalacja HPM na Linux",
                            "Na systemie Linux zalecamy ręczną instalację środowiska ze względu na różnorodność dystrybucji.<br><br>" +
                            "Otwórz terminal i wklej poniższe komendy:<br>" +
                            "<pre style='background:#f4f4f4;padding:10px;font-size:11px;user-select:all;'>" +
                            "mkdir -p ~/.config/Nous/python_env\n" +
                            "python3 -m venv ~/.config/Nous/python_env\n" +
                            "~/.config/Nous/python_env/bin/python3 -m pip install psychopy numpy scipy pandas pyglet" +
                            "</pre><br>" +
                            "Po zakończeniu zamknij i otwórz ponownie Launcher.",
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
            const snap = await getDocs(collection(db, "tests"));
            cachedTests = []; // Clear cache

            if (snap.empty) {
                elements.testsGrid.innerHTML = '<p>Brak testów.</p>';
                return;
            }

            snap.forEach(doc => {
                const t = doc.data();
                t.id = doc.id;
                t.local_ver = 0; // Will be updated below
                t.remote_ver = Number(t.version);
                cachedTests.push(t);
            });
        } catch (e) {
            console.error(e);
            elements.testsGrid.innerHTML = '<p>Błąd ładowania danych z chmury.</p>';
            return;
        }
    }

    // 2. Always update local versions (using cached getter)
    const localVersions = await getLocalVersionsCached();
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

    renderTests(cachedTests, filterText);
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
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam);
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
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam);
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
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam);
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
            startTestProcess(t.download_url || t.downloadUrl, test_id, status.versionParam);
        });
    });
}

export async function startTestProcess(url, id, ver) {
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

        window.electronAPI.downloadAndRun(url, id, ver, false, isHpmEnabled, isTrainingMode);
    } else await Dialog.alert("Brak Electrona", 'error');
}
