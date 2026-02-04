// src/modules/library.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from './ui.js';
import { Dialog } from './dialog.js';

let cachedTests = [];
let isSearchBound = false;
let currentViewMode = 'grid'; // 'grid', 'list', 'table', 'compact'

// View mode button references
const viewButtons = {
    grid: null,
    list: null,
    table: null,
    compact: null
};

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

    // Bind search input event (only once)
    if (!isSearchBound) {
        const searchInput = document.getElementById('library-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const filterText = e.target.value;
                renderTests(cachedTests, filterText);
            });
            isSearchBound = true;
        }
    }
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
                t.localVer = 0; // Will be updated below
                t.remoteVer = Number(t.version);
                cachedTests.push(t);
            });
        } catch (e) {
            console.error(e);
            elements.testsGrid.innerHTML = '<p>Błąd ładowania danych z chmury.</p>';
            return;
        }
    }

    // 2. Always update local versions (fast fs check) to ensure buttons are correct
    if (window.electronAPI) {
        const localVersions = await window.electronAPI.getLocalVersions();
        cachedTests.forEach(t => {
            t.localVer = localVersions[t.id] ? Number(localVersions[t.id]) : 0;
        });
    }

    renderTests(cachedTests, filterText);
}

function getTestStatus(t) {
    const localVer = t.localVer;
    const remoteVer = t.remoteVer;

    if (localVer === 0) {
        return {
            iconName: 'cloud_download',
            iconColor: '#888',
            iconTitle: 'Nie pobrano',
            btnText: 'Pobierz',
            btnClass: 'primary',
            statusText: 'Nie pobrano',
            versionParam: remoteVer
        };
    } else if (localVer < remoteVer) {
        return {
            iconName: 'system_update',
            iconColor: '#ff9800',
            iconTitle: 'Dostępna aktualizacja',
            btnText: 'Uruchom',
            btnClass: 'outline',
            statusText: 'Aktualizacja dostępna',
            versionParam: localVer
        };
    } else {
        return {
            iconName: 'check_circle',
            iconColor: '#4caf50',
            iconTitle: 'Zainstalowano',
            btnText: 'Uruchom',
            btnClass: 'primary',
            statusText: 'Zainstalowano',
            versionParam: localVer
        };
    }
}

function sortTests(tests) {
    return tests.sort((a, b) => {
        const aUpdate = a.localVer > 0 && a.localVer < a.remoteVer;
        const bUpdate = b.localVer > 0 && b.localVer < b.remoteVer;

        if (aUpdate && !bUpdate) return -1;
        if (!aUpdate && bUpdate) return 1;

        const aInstalled = a.localVer > 0;
        const bInstalled = b.localVer > 0;

        if (aInstalled && !bInstalled) return -1;
        if (!aInstalled && bInstalled) return 1;

        return (a.name || '').localeCompare(b.name || '');
    });
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

    // 2. Sort
    tests = sortTests(tests);

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
        const testId = t.id;

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
        versionSpan.style.color = '#666';
        versionSpan.textContent = `v${t.version}`;

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
        button.id = `start-test-${testId}`;

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
            startTestProcess(t.downloadUrl, testId, status.versionParam);
        });
    });
}

function renderListView(tests) {
    elements.testsGrid.className = 'list-container';

    tests.forEach(t => {
        const status = getTestStatus(t);
        const testId = t.id;

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
        versionSpan.textContent = `v${t.version}`;

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
        button.id = `start-test-${testId}`;

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
            startTestProcess(t.downloadUrl, testId, status.versionParam);
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
        const testId = t.id;

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
        button.id = `start-test-${testId}`;

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
            startTestProcess(t.downloadUrl, testId, status.versionParam);
        });
    });

    table.appendChild(tbody);
    elements.testsGrid.appendChild(table);
}

function renderCompactView(tests) {
    elements.testsGrid.className = 'compact-grid';

    tests.forEach(t => {
        const status = getTestStatus(t);
        const testId = t.id;

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
        versionSpan.textContent = `v${t.version}`;

        const button = document.createElement('button');
        button.className = `btn ${status.btnClass} compact`;
        button.id = `start-test-${testId}`;

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
            startTestProcess(t.downloadUrl, testId, status.versionParam);
        });
    });
}

// Listener for progress
// Listener for progress
if (window.electronAPI) {
    window.electronAPI.onDownloadProgress(({ testId, percent }) => {
        const btn = document.getElementById(`start-test-${testId}`);
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

    // --- OPTIMIZED REFRESH ---
    // Listen for completion event instead of timeout
    window.electronAPI.onTestInstalled((data) => {
        console.log("Test installed, refreshing library:", data);
        loadTestsList(undefined, true); // Force refresh
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

        window.electronAPI.downloadAndRun(url, id, ver, false);
    } else await Dialog.alert("Brak Electrona", 'error');
}
