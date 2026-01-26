// src/modules/results.js
import { db } from '../firebaseConfig.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';
import { getActiveDemographics } from './demographics.js';

let currentResultPackage = null;

export function initResultsHandler() {
    if (window.electronAPI) {
        window.electronAPI.onTestResults((raw) => {
            console.log("Odebrano wyniki z testu. Przetwarzanie...");
            handleTestResults(raw);
        });
    }

    elements.btnCloseModal.addEventListener('click', () => elements.modalOverlay.classList.add('hidden'));
    elements.btnDiscard.addEventListener('click', () => { if (confirm("Odrzucić?")) elements.modalOverlay.classList.add('hidden'); });

    elements.btnSaveDisk.addEventListener('click', () => {
        if (currentResultPackage) window.electronAPI.saveResultToDisk(currentResultPackage);
    });

    elements.btnUploadCloud.addEventListener('click', uploadResultToCloud);
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
    document.getElementById('modal-score').innerText = s;
    document.getElementById('modal-json-preview').innerText = JSON.stringify(data.wyniki, null, 2);
    checkPermissions();
    elements.modalOverlay.classList.remove('hidden');
}

function checkPermissions() {
    const isAppr = elements.userStatusDisplay.innerText === 'APPROVED';
    const isOnline = navigator.onLine;
    const isLog = getCurrentUser() !== null;

    if (isAppr && isOnline && isLog) {
        elements.btnUploadCloud.disabled = false;
        elements.modalUploadInfo.innerHTML = '<span class="material-icons" style="color:#4caf50">check</span> Gotowy';
    } else {
        elements.btnUploadCloud.disabled = true;
        elements.modalUploadInfo.innerHTML = '<span class="material-icons" style="color:orange">block</span> Brak uprawnień/sieci';
    }
}

async function uploadResultToCloud() {
    if (!currentResultPackage) return;
    try {
        elements.btnUploadCloud.innerText = "Wysyłanie...";
        await addDoc(collection(db, "results"), {
            researcher_id: getCurrentUser().uid,
            test_id: currentResultPackage.testId,
            subject_id: currentResultPackage.subject_id,
            demographics: currentResultPackage.demographics,
            data: currentResultPackage.wyniki,
            timestamp: currentResultPackage.timestamp
        });
        alert("Wysłano pomyślnie!");
        elements.modalOverlay.classList.add('hidden');
    } catch (e) { alert("Błąd: " + e.message); }
    finally { elements.btnUploadCloud.innerText = "Wyślij do Chmury"; }
}
