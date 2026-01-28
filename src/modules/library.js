// src/modules/library.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { elements } from './ui.js';

export async function loadTestsList() {
    elements.viewLibrary.innerHTML = '<p style="color:#888;">Ładowanie biblioteki...</p>';
    try {
        const snap = await getDocs(collection(db, "tests"));

        let localVersions = {};
        if (window.electronAPI) {
            localVersions = await window.electronAPI.getLocalVersions();
        }

        elements.viewLibrary.innerHTML = '';

        if (snap.empty) { elements.viewLibrary.innerHTML = '<p>Brak testów.</p>'; return; }

        snap.forEach(doc => {
            const t = doc.data();
            const testId = doc.id;

            const localVer = localVersions[testId] ? Number(localVersions[testId]) : 0;
            const remoteVer = Number(t.version);

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

            elements.viewLibrary.appendChild(card);

            // Bind click event
            button.addEventListener('click', () => {
                startTestProcess(t.downloadUrl, testId, versionParam);
            });
        });
    } catch (e) {
        console.error(e);
        elements.viewLibrary.innerHTML = '<p>Błąd ładowania.</p>';
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

export function startTestProcess(url, id, ver) {
    if (window.electronAPI) {
        // Change button state immediately
        const btn = document.getElementById(`start-test-${id}`);
        if (btn) {
            btn.innerHTML = '<span class="material-icons spin">sync</span> Inicjowanie...';
            btn.disabled = true;
        }

        window.electronAPI.downloadAndRun(url, id, ver, false);
    } else alert("Brak Electrona");
}
