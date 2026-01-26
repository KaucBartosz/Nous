// src/modules/library.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

            let iconBadge = '';
            let btnText = 'Uruchom';
            let btnClass = 'primary';

            let versionParam = localVer > 0 ? localVer : remoteVer;

            if (localVer === 0) {
                iconBadge = `<span class="material-icons" style="color:#888; font-size:24px;" title="Nie pobrano">cloud_download</span>`;
                btnText = 'Pobierz';
                versionParam = remoteVer;
            } else if (localVer < remoteVer) {
                iconBadge = `<span class="material-icons" style="color:#ff9800; font-size:24px;" title="Dostępna aktualizacja w zakładce Aktualizacje">system_update</span>`;
                btnText = 'Uruchom';
                btnClass = 'outline';
                versionParam = localVer;
            } else {
                iconBadge = `<span class="material-icons" style="color:#4caf50; font-size:24px;" title="Zainstalowano">check_circle</span>`;
                btnText = 'Uruchom';
                versionParam = localVer;
            }

            const card = document.createElement('div');
            card.className = 'test-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-icons" style="font-size:40px; color:#444;">assignment</span>
                        ${iconBadge} 
                    </div>
                    <span class="meta" style="color:#666;">v${t.version}</span>
                </div>
                
                <h4 style="margin-top:10px;">${t.name}</h4>
                <p>${t.description}</p>
                
                <button class="btn ${btnClass} small" style="margin-top:auto;" id="start-test-${testId}">
                    <span class="material-icons">play_arrow</span> ${btnText}
                </button>
            `;
            elements.viewLibrary.appendChild(card);

            // Bind click event
            document.getElementById(`start-test-${testId}`).addEventListener('click', () => {
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
