// src/modules/updates.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { elements } from './ui.js';
import { loadTestsList } from './library.js';

export async function loadUpdatesData() {
    elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Skanowanie...</td></tr>';
    try {
        const remoteSnap = await getDocs(collection(db, "tests"));
        let localVersions = {};
        if (window.electronAPI) localVersions = await window.electronAPI.getLocalVersions();

        elements.updatesTableBody.innerHTML = '';
        if (remoteSnap.empty) { elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak testów.</td></tr>'; return; }

        remoteSnap.forEach(doc => {
            const r = doc.data();
            const id = doc.id;
            const remoteVer = Number(r.version);
            const localVer = localVersions[id] ? Number(localVersions[id]) : 0;

            let status = '';
            let buttons = '';

            if (localVer === 0) {
                status = '<span style="color:#888">Nie zainstalowano</span>';
                buttons = `<button class="btn primary small" id="force-update-${id}">
                    <span class="material-icons" style="font-size:16px;">download</span> Pobierz
                </button>`;
            } else {
                if (localVer < remoteVer) {
                    status = `<span style="color:#ff9800;font-weight:bold">Aktualizacja! (v${localVer} &#8594; v${remoteVer})</span>`;
                    buttons = `<button class="btn primary small" id="force-update-${id}">
                        <span class="material-icons" style="font-size:16px;">system_update_alt</span> Aktualizuj
                    </button>`;
                } else {
                    status = '<span style="color:#4caf50">Aktualne</span>';
                    buttons = `<button class="btn outline small" disabled>Aktualne</button>`;
                }
                buttons += `<button class="btn danger small" style="margin-left:5px;" id="delete-test-${id}">
                    <span class="material-icons" style="font-size:16px;">delete</span> Usuń
                </button>`;
            }

            const row = document.createElement('tr');
            row.innerHTML = `<td>${r.name}</td><td>${localVer || '-'}</td><td>v${remoteVer}</td><td>${status}</td><td>${buttons}</td>`;
            elements.updatesTableBody.appendChild(row);

            // Bind events
            const updateBtn = document.getElementById(`force-update-${id}`);
            if (updateBtn) updateBtn.addEventListener('click', () => forceUpdate(r.downloadUrl, id, remoteVer));

            const delBtn = document.getElementById(`delete-test-${id}`);
            if (delBtn) delBtn.addEventListener('click', () => deleteLocalTest(id));
        });
    } catch (e) {
        elements.updatesTableBody.innerHTML = `<tr><td colspan="5">Błąd: ${e.message}</td></tr>`;
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
    if (!confirm("Usunąć ten test z dysku?")) return;
    if (window.electronAPI) {
        const res = await window.electronAPI.deleteTest(testId);
        if (res.success) {
            loadUpdatesData();
            loadTestsList();
        } else {
            alert("Błąd: " + res.error);
        }
    }
}
