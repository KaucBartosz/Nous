// src/modules/results.js
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';
import { getActiveDemographics } from './demographics.js';
import { saveResult } from './database.js';
import { syncNow } from './sync.js';
import { Dialog } from './dialog.js';

let currentResultPackage = null;

export function initResultsHandler() {
    if (window.electronAPI) {
        window.electronAPI.onTestResults((raw) => {
            console.log("Odebrano wyniki z testu. Przetwarzanie...");
            handleTestResults(raw);
        });
    }

    elements.btnCloseModal.addEventListener('click', () => elements.modalOverlay.classList.add('hidden'));
    elements.btnDiscard.addEventListener('click', () => elements.modalOverlay.classList.add('hidden'));



    // Zmiana: Button teraz służy do "Zapisu w systemie" (Local -> Cloud)
    elements.btnUploadCloud.addEventListener('click', saveResultToSystem);
}

function handleTestResults(raw) {
    const user = getCurrentUser();

    // 1. Get Demographics
    const currentDemo = getActiveDemographics();

    // 2. Determine Participant ID
    let participantId = "GUEST";
    if (currentDemo && currentDemo.participant_id) {
        participantId = currentDemo.participant_id;
    } else if (raw.subjectId && raw.subjectId !== "participant") {
        participantId = raw.subjectId;
    }

    // 3. Build Package
    currentResultPackage = {
        testId: raw.testId || "test",
        timestamp: new Date().toISOString(),
        researcher_uid: user ? user.uid : "GUEST",
        subject_id: participantId,
        demographics: currentDemo,
        wyniki: raw
    };

    openModal(currentResultPackage);
}

function openModal(data) {
    const s = data.wyniki.czas_reakcji ? `${data.wyniki.czas_reakcji} ms` : (data.wyniki.score || "Koniec");
    document.getElementById('modal-score').textContent = s;
    document.getElementById('modal-json-preview').textContent = JSON.stringify(data.wyniki, null, 2);

    updateSaveButtonState();
    elements.modalOverlay.classList.remove('hidden');
}

function updateSaveButtonState() {
    // Teraz zawsze pozwalamy zapisać (chyba że guest?)
    // Guest też może zapisać lokalnie, ale nie wyśle do chmury.
    elements.btnUploadCloud.disabled = false;
    elements.btnUploadCloud.textContent = "Zapisz i Zamknij";
    elements.modalUploadInfo.innerHTML = '';
}

async function saveResultToSystem() {
    if (!currentResultPackage) return;
    try {
        elements.btnUploadCloud.textContent = "Zapisywanie...";

        // 1. Zapis do IndexedDB
        await saveResult(currentResultPackage);

        elements.btnUploadCloud.textContent = "Zapisano!";
        elements.modalOverlay.classList.add('hidden');

        // 2. Próba synchronizacji (fire & forget)
        syncNow();

    } catch (e) {
        await Dialog.alert("Błąd zapisu bazy: " + e.message, 'error');
        elements.btnUploadCloud.textContent = "Błąd";
    }
}
