// src/modules/results.js
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';
import { getActiveDemographics } from './demographics.js';
import { saveResult } from './database.js';
import { syncNow } from './sync.js';
import { Dialog } from './dialog.js';
import { loadTestsList, getTrainingMode } from './library.js';

let currentResultPackage = null;

// --- VALIDATION HELPERS ---

/**
 * Sanityzacja tekstu - usuwa potencjalnie niebezpieczne znaki
 */
function sanitizeText(input) {
    if (typeof input !== 'string') return input;
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Walidacja struktury danych wyników testu
 */
function validateTestResults(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Wyniki testu muszą być obiektem');
    }

    // Wymagane pola
    const requiredFields = ['testId'];
    for (const field of requiredFields) {
        if (!(field in raw)) {
            console.warn(`Brak wymaganego pola: ${field}, używam domyślnej wartości`);
        }
    }

    // Walidacja typów
    if (raw.testId && typeof raw.testId !== 'string') {
        throw new Error('testId musi być tekstem');
    }

    // Sanityzacja pól tekstowych
    const sanitized = { ...raw };
    if (sanitized.testId) sanitized.testId = sanitizeText(sanitized.testId);
    if (sanitized.subjectId) sanitized.subjectId = sanitizeText(sanitized.subjectId);

    return sanitized;
}

export function initResultsHandler() {
    if (window.electronAPI) {
        window.electronAPI.onTestResults((raw) => {
            console.log("Odebrano wyniki z testu. Przetwarzanie...");
            try {
                const validatedData = validateTestResults(raw);
                handleTestResults(validatedData);
            } catch (e) {
                console.error("Błąd walidacji wyników:", e);
                import('./dialog.js').then(({ Dialog }) => {
                    Dialog.alert(`Błąd walidacji wyników testu: ${e.message}`, 'error');
                });
            }
        });
    }

    elements.btnCloseModal.addEventListener('click', () => {
        elements.modalOverlay.classList.add('hidden');
        loadTestsList();
    });
    elements.btnDiscard.addEventListener('click', () => {
        elements.modalOverlay.classList.add('hidden');
        loadTestsList();
    });



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
        test_id: raw.testId || "test",
        timestamp: new Date().toISOString(),
        researcher_uid: user ? user.uid : "GUEST",
        subject_id: participantId,
        demographics: currentDemo,
        wyniki: raw,
        isTraining: getTrainingMode()
    };

    openModal(currentResultPackage);
}

function openModal(data) {
    const isTraining = data.isTraining;

    if (isTraining) {
        elements.modalHeaderTitle.textContent = "Badanie Zakończone (Tryb treningowy)";
        elements.normalResultsContent.classList.add('hidden');
        elements.trainingResultsContent.classList.remove('hidden');
        elements.btnDiscard.classList.add('hidden');
    } else {
        elements.modalHeaderTitle.textContent = "Badanie Zakończone";
        elements.normalResultsContent.classList.remove('hidden');
        elements.trainingResultsContent.classList.add('hidden');
        elements.btnDiscard.classList.remove('hidden');

        const s = data.wyniki.czas_reakcji ? `${data.wyniki.czas_reakcji} ms` : (data.wyniki.score || "Koniec");
        document.getElementById('modal-score').textContent = s;
        document.getElementById('modal-json-preview').textContent = JSON.stringify(data.wyniki, null, 2);
    }

    updateSaveButtonState(isTraining);
    elements.modalOverlay.classList.remove('hidden');
}

function updateSaveButtonState(isTraining) {
    if (isTraining) {
        elements.btnUploadCloud.disabled = false;
        elements.btnUploadCloud.textContent = "Zamknij";
        elements.modalUploadInfo.innerHTML = '';
    } else {
        elements.btnUploadCloud.disabled = false;
        elements.btnUploadCloud.textContent = "Zapisz i Zamknij";
        elements.modalUploadInfo.innerHTML = '';
    }
}

async function saveResultToSystem() {
    if (!currentResultPackage) return;

    if (currentResultPackage.isTraining) {
        elements.modalOverlay.classList.add('hidden');
        loadTestsList();
        return;
    }

    try {
        elements.btnUploadCloud.textContent = "Zapisywanie...";

        // Get current user ID for verification
        const user = getCurrentUser();
        const currentUserId = user ? user.uid : 'GUEST';

        // 1. Zapis do IndexedDB
        await saveResult(currentResultPackage, currentUserId);

        elements.btnUploadCloud.textContent = "Zapisano!";
        elements.modalOverlay.classList.add('hidden');
        loadTestsList();

        // 2. Próba synchronizacji (fire & forget)
        syncNow();

    } catch (e) {
        await Dialog.alert("Błąd zapisu bazy: " + e.message, 'error');
        elements.btnUploadCloud.textContent = "Błąd";
    }
}
