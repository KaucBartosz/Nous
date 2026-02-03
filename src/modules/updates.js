// src/modules/updates.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from './ui.js';
import { loadTestsList } from './library.js';
import { Dialog } from './dialog.js';

let isSearchBound = false;

export async function loadUpdatesData(filterText = '') {
    if (!isSearchBound) {
        const searchInput = document.getElementById('updates-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => loadUpdatesData(e.target.value));
            isSearchBound = true;
        }
    }

    elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Skanowanie...</td></tr>';
    try {
        const remoteSnap = await getDocs(collection(db, "tests"));
        let localVersions = {};
        if (window.electronAPI) localVersions = await window.electronAPI.getLocalVersions();

        elements.updatesTableBody.innerHTML = '';
        if (remoteSnap.empty) { elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak testów.</td></tr>'; return; }

        let tests = [];
        remoteSnap.forEach(doc => {
            const r = doc.data();
            r.id = doc.id;
            r.localVer = localVersions[r.id] ? Number(localVersions[r.id]) : 0;
            r.remoteVer = Number(r.version);
            tests.push(r);
        });

        // 1. Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            tests = tests.filter(t => (t.name || '').toLowerCase().includes(lower));
        }

        // 2. Sort: Installed/Update needed first. 
        // Logic: 
        // Priority 1: Update needed (local < remote && local > 0)
        // Priority 2: Installed (local > 0)
        // Priority 3: Not installed
        // Then Alphabetical
        tests.sort((a, b) => {
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


        if (tests.length === 0) {
            elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak wyników wyszukiwania.</td></tr>';
            return;
        }

        tests.forEach(r => {
            const id = r.id;
            const remoteVer = r.remoteVer;
            const localVer = r.localVer;

            // Create row safely
            const row = document.createElement('tr');

            // Column 1: Test Name (SAFE - use textContent)
            const nameCell = document.createElement('td');
            nameCell.textContent = r.name || 'Brak nazwy';
            row.appendChild(nameCell);

            // Column 2: Local Version
            const localVerCell = document.createElement('td');
            localVerCell.textContent = localVer || '-';
            row.appendChild(localVerCell);

            // Column 3: Remote Version
            const remoteVerCell = document.createElement('td');
            remoteVerCell.textContent = `v${remoteVer}`;
            row.appendChild(remoteVerCell);

            // Column 4: Status
            const statusCell = document.createElement('td');
            if (localVer === 0) {
                const statusSpan = document.createElement('span');
                statusSpan.style.color = '#888';
                statusSpan.textContent = 'Nie zainstalowano';
                statusCell.appendChild(statusSpan);
            } else if (localVer < remoteVer) {
                const statusSpan = document.createElement('span');
                statusSpan.style.cssText = 'color:#ff9800;font-weight:bold';
                statusSpan.textContent = `Aktualizacja! (v${localVer} → v${remoteVer})`;
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

            if (localVer === 0) {
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
                downloadBtn.addEventListener('click', () => forceUpdate(r.downloadUrl, id, remoteVer));

                actionsCell.appendChild(downloadBtn);
            } else {
                if (localVer < remoteVer) {
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
                    updateBtn.addEventListener('click', () => forceUpdate(r.downloadUrl, id, remoteVer));

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

// Listener for progress
if (window.electronAPI) {
    window.electronAPI.onDownloadProgress(({ testId, percent }) => {
        const btn = document.getElementById(`force-update-${testId}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <span class="material-icons spin" style="font-size:16px;">sync</span> ${percent}%
            `;
            // If near 100%
            if (percent >= 100) {
                setTimeout(() => {
                    loadUpdatesData();
                    loadTestsList();
                }, 1500);
            }
        }
    });
}

export function forceUpdate(url, id, ver) {
    if (window.electronAPI) {
        // Change button state
        const btn = document.getElementById(`force-update-${id}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="material-icons spin" style="font-size:16px;">sync</span> ...';
        }

        window.electronAPI.downloadAndRun(url, id, ver, true);
    }
}

export async function deleteLocalTest(testId) {
    if (window.electronAPI) {
        const confirmed = await Dialog.confirm("Czy na pewno chcesz usunąć ten test?");
        if (!confirmed) return;

        const res = await window.electronAPI.deleteTest(testId);
        if (res.success) {
            loadUpdatesData();
            loadTestsList();
        } else {
            await Dialog.alert("Błąd: " + res.error, 'error');
        }
    }
}
