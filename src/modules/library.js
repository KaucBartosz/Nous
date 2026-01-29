// src/modules/library.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { elements } from './ui.js';
import { Dialog } from './dialog.js';

let cachedTests = [];
let isSearchBound = false;

export async function loadTestsList(filterText = '') {
    // Bind search input only once
    if (!isSearchBound) {
        const searchInput = document.getElementById('library-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => loadTestsList(e.target.value));
            isSearchBound = true;
        }
    }

    elements.testsGrid.innerHTML = '<p style="color:#888;">Ładowanie biblioteki...</p>';
    try {
        // Fetch only if not cached or force refresh needed (omitted for simplicity, fetch always for now to safe)
        // Actually, better to fetch every time to get updates, but sorting happens on client.
        const snap = await getDocs(collection(db, "tests"));

        let localVersions = {};
        if (window.electronAPI) {
            localVersions = await window.electronAPI.getLocalVersions();
        }

        elements.testsGrid.innerHTML = '';

        if (snap.empty) { elements.testsGrid.innerHTML = '<p>Brak testów.</p>'; return; }

        let tests = [];
        snap.forEach(doc => {
            const t = doc.data();
            t.id = doc.id; // Store ID
            t.localVer = localVersions[t.id] ? Number(localVersions[t.id]) : 0;
            t.remoteVer = Number(t.version);
            tests.push(t);
        });

        // 1. Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            tests = tests.filter(t => (t.name || '').toLowerCase().includes(lower));
        }

        // 2. Sort: Installed (localVer > 0) first, then Alphabetical
        tests.sort((a, b) => {
            const aInstalled = a.localVer > 0;
            const bInstalled = b.localVer > 0;

            if (aInstalled && !bInstalled) return -1;
            if (!aInstalled && bInstalled) return 1;

            return (a.name || '').localeCompare(b.name || '');
        });

        if (tests.length === 0) {
            elements.testsGrid.innerHTML = '<p>Brak wyników wyszukiwania.</p>';
            return;
        }

        // Render
        tests.forEach(t => {
            const localVer = t.localVer;
            const remoteVer = t.remoteVer;
            const testId = t.id;

            let iconName = '';
            let iconColor = '';
            let iconTitle = '';
            let btnText = 'Uruchom';
            let btnClass = 'primary';

            let versionParam = localVer > 0 ? localVer : remoteVer;

            if (localVer === 0) {
                iconName = 'cloud_download';
                iconColor = '#888';
                iconTitle = 'Nie pobrano';
                btnText = 'Pobierz';
                versionParam = remoteVer;
            } else if (localVer < remoteVer) {
                iconName = 'system_update';
                iconColor = '#ff9800';
                iconTitle = 'Dostępna aktualizacja w zakładce Aktualizacje';
                btnText = 'Uruchom';
                btnClass = 'outline';
                versionParam = localVer;
            } else {
                iconName = 'check_circle';
                iconColor = '#4caf50';
                iconTitle = 'Zainstalowano';
                btnText = 'Uruchom';
                versionParam = localVer;
            }

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
            statusIcon.style.cssText = `color:${iconColor}; font-size:24px;`;
            statusIcon.title = iconTitle;
            statusIcon.textContent = iconName;

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
            title.textContent = t.name || 'Bez nazwy'; // Safe fallback

            // Description
            const description = document.createElement('p');
            description.textContent = t.description || 'Brak opisu';

            // Button
            const button = document.createElement('button');
            button.className = `btn ${btnClass} small`;
            button.style.marginTop = 'auto';
            button.id = `start-test-${testId}`;

            const playIcon = document.createElement('span');
            playIcon.className = 'material-icons';
            playIcon.textContent = 'play_arrow';

            button.appendChild(playIcon);
            button.appendChild(document.createTextNode(` ${btnText}`));

            // Assemble card
            card.appendChild(topDiv);
            card.appendChild(title);
            card.appendChild(description);
            card.appendChild(button);

            elements.testsGrid.appendChild(card);

            // Bind click event
            button.addEventListener('click', () => {
                startTestProcess(t.downloadUrl, testId, versionParam);
            });
        });
    } catch (e) {
        console.error(e);
        elements.testsGrid.innerHTML = '<p>Błąd ładowania.</p>';
    }
}

// Listener for progress
if (window.electronAPI) {
    window.electronAPI.onDownloadProgress(({ testId, percent }) => {
        const btn = document.getElementById(`start-test-${testId}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `
                <span class="material-icons spin">sync</span> ${percent}%
                <div style="width:100%; height:4px; background:#333; margin-top:5px; border-radius:2px;">
                    <div style="width:${percent}%; height:100%; background:#4caf50; border-radius:2px;"></div>
                </div>
            `;
            // If near 100%, we might want to refresh soon
            if (percent >= 100) {
                setTimeout(() => loadTestsList(), 1500);
            }
        }
    });
}

export async function startTestProcess(url, id, ver) {
    if (window.electronAPI) {
        // Change button state immediately
        const btn = document.getElementById(`start-test-${id}`);
        if (btn) {
            btn.innerHTML = '<span class="material-icons spin">sync</span> Inicjowanie...';
            btn.disabled = true;
        }

        window.electronAPI.downloadAndRun(url, id, ver, false);
    } else await Dialog.alert("Brak Electrona", 'error');
}
