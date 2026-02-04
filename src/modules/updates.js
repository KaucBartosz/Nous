// src/modules/updates.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from './ui.js';
import { loadTestsList } from './library.js';
import { Dialog } from './dialog.js';
import { sortByInstallStatus, debounce, getLocalVersionsCached, invalidateLocalVersionsCache } from './utils.js';

let isSearchBound = false;
let listenersRegistered = false; // Flaga zapobiegająca wielokrotnej rejestracji

/**
 * Inicjalizuje listenery Electron API dla updates (wywołaj raz).
 */
export function initUpdatesListeners() {
    if (listenersRegistered || !window.electronAPI) return;

    window.electronAPI.onDownloadProgress(({ test_id, percent }) => {
        const btn = document.getElementById(`force-update-${test_id}`);
        if (btn) {
            const progressText = btn.querySelector('.progress-text');

            if (progressText) {
                progressText.textContent = `${percent}%`;
            } else {
                btn.innerHTML = `
                    <span class="material-icons spin" style="font-size:16px;">sync</span> 
                    <span class="progress-text">${percent}%</span>
                `;
                btn.disabled = true;
            }
        }
    });

    window.electronAPI.onTestInstalled((data) => {
        console.log("Test installed (update), refreshing...", data);
        invalidateLocalVersionsCache(); // Unieważnij cache
        loadUpdatesData();
        loadTestsList(undefined, true);
    });

    listenersRegistered = true;
}

export async function loadUpdatesData(filterText = '') {
    // Bind search input with DEBOUNCE (only once)
    if (!isSearchBound) {
        const searchInput = document.getElementById('updates-search');
        if (searchInput) {
            const debouncedSearch = debounce((value) => {
                loadUpdatesData(value);
            }, 200);

            searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
            isSearchBound = true;
        }
    }

    // Init listeners on first load
    initUpdatesListeners();

    elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Skanowanie...</td></tr>';
    try {
        const remoteSnap = await getDocs(collection(db, "tests"));
        const localVersions = await getLocalVersionsCached();

        elements.updatesTableBody.innerHTML = '';
        if (remoteSnap.empty) {
            elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak testów.</td></tr>';
            return;
        }

        let tests = [];
        remoteSnap.forEach(doc => {
            const r = doc.data();
            r.id = doc.id;
            r.local_ver = localVersions[r.id] ? Number(localVersions[r.id]) : 0;
            r.remote_ver = Number(r.version);
            tests.push(r);
        });

        // 1. Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            tests = tests.filter(t => (t.name || '').toLowerCase().includes(lower));
        }

        // 2. Sort (using shared utility)
        tests = sortByInstallStatus(tests);

        if (tests.length === 0) {
            elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak wyników wyszukiwania.</td></tr>';
            return;
        }

        tests.forEach(r => {
            const id = r.id;
            const remote_ver = r.remote_ver;
            const local_ver = r.local_ver;

            // Create row safely
            const row = document.createElement('tr');

            // Column 1: Test Name (SAFE - use textContent)
            const nameCell = document.createElement('td');
            nameCell.textContent = r.name || 'Brak nazwy';
            row.appendChild(nameCell);

            // Column 2: Local Version
            const localVerCell = document.createElement('td');
            localVerCell.textContent = local_ver || '-';
            row.appendChild(localVerCell);

            // Column 3: Remote Version
            const remoteVerCell = document.createElement('td');
            remoteVerCell.textContent = `v${remote_ver}`;
            row.appendChild(remoteVerCell);

            // Column 4: Status
            const statusCell = document.createElement('td');
            if (local_ver === 0) {
                const statusSpan = document.createElement('span');
                statusSpan.style.color = '#888';
                statusSpan.textContent = 'Nie zainstalowano';
                statusCell.appendChild(statusSpan);
            } else if (local_ver < remote_ver) {
                const statusSpan = document.createElement('span');
                statusSpan.style.cssText = 'color:#ff9800;font-weight:bold';
                statusSpan.textContent = `Aktualizacja! (v${local_ver} → v${remote_ver})`;
                statusCell.appendChild(statusSpan);
            } else {
                const statusSpan = document.createElement('span');
                statusSpan.style.color = '#4caf50';
                statusSpan.textContent = 'Aktualne';
                statusCell.appendChild(statusSpan);
            }
            row.appendChild(statusCell);

            // Column 5: Action Buttons
            const actionsCell = document.createElement('td');

            if (local_ver === 0) {
                // Download button
                const downloadBtn = document.createElement('button');
                downloadBtn.className = 'btn primary small';
                downloadBtn.id = `force-update-${id}`;

                const downloadIcon = document.createElement('span');
                downloadIcon.className = 'material-icons';
                downloadIcon.style.fontSize = '16px';
                downloadIcon.textContent = 'download';

                downloadBtn.appendChild(downloadIcon);
                downloadBtn.appendChild(document.createTextNode(' Pobierz'));
                downloadBtn.addEventListener('click', () => forceUpdate(r.download_url || r.downloadUrl, id, remote_ver));

                actionsCell.appendChild(downloadBtn);
            } else {
                if (local_ver < remote_ver) {
                    // Update button
                    const updateBtn = document.createElement('button');
                    updateBtn.className = 'btn primary small';
                    updateBtn.id = `force-update-${id}`;

                    const updateIcon = document.createElement('span');
                    updateIcon.className = 'material-icons';
                    updateIcon.style.fontSize = '16px';
                    updateIcon.textContent = 'system_update_alt';

                    updateBtn.appendChild(updateIcon);
                    updateBtn.appendChild(document.createTextNode(' Aktualizuj'));
                    updateBtn.addEventListener('click', () => forceUpdate(r.download_url || r.downloadUrl, id, remote_ver));

                    actionsCell.appendChild(updateBtn);
                } else {
                    // Current button (disabled)
                    const currentBtn = document.createElement('button');
                    currentBtn.className = 'btn outline small';
                    currentBtn.disabled = true;
                    currentBtn.textContent = 'Aktualne';
                    actionsCell.appendChild(currentBtn);
                }

                // Delete button (always show if installed)
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn danger small';
                deleteBtn.style.marginLeft = '5px';
                deleteBtn.id = `delete-test-${id}`;

                const deleteIcon = document.createElement('span');
                deleteIcon.className = 'material-icons';
                deleteIcon.style.fontSize = '16px';
                deleteIcon.textContent = 'delete';

                deleteBtn.appendChild(deleteIcon);
                deleteBtn.appendChild(document.createTextNode(' Usuń'));
                deleteBtn.addEventListener('click', () => deleteLocalTest(id));

                actionsCell.appendChild(deleteBtn);
            }

            row.appendChild(actionsCell);
            elements.updatesTableBody.appendChild(row);
        });
    } catch (e) {
        // Safe error rendering
        elements.updatesTableBody.innerHTML = '';
        const errorRow = document.createElement('tr');
        const errorCell = document.createElement('td');
        errorCell.colSpan = 5;
        errorCell.textContent = `Błąd: ${e.message}`;
        errorRow.appendChild(errorCell);
        elements.updatesTableBody.appendChild(errorRow);
    }
}

export function forceUpdate(url, id, ver) {
    if (window.electronAPI) {
        // Change button state
        const btn = document.getElementById(`force-update-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <span class="material-icons spin" style="font-size:16px;">sync</span> 
                <span class="progress-text">...</span>
            `;
        }

        window.electronAPI.downloadAndRun(url, id, ver, true);
    }
}

export async function deleteLocalTest(test_id) {
    if (window.electronAPI) {
        const confirmed = await Dialog.confirm("Czy na pewno chcesz usunąć ten test?");
        if (!confirmed) return;

        const res = await window.electronAPI.deleteTest(test_id);
        if (res.success) {
            invalidateLocalVersionsCache(); // Unieważnij cache po usunięciu
            loadUpdatesData();
            loadTestsList();
        } else {
            await Dialog.alert("Błąd: " + res.error, 'error');
        }
    }
}
