// src/app.js
import { elements, switchView } from './modules/ui.js';
import { initAuth, login, register, logout, loginGuest } from './modules/auth.js';
import { loadTestsList } from './modules/library.js';
import { loadHistoryData, exportHistoryToCSV } from './modules/history.js';
import { loadUpdatesData } from './modules/updates.js';
import { loadSavedDemographics, saveDemographicsFromForm } from './modules/demographics.js';
import { initResultsHandler } from './modules/results.js';

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {

    // 1. Auth Setup
    initAuth(() => {
        loadTestsList();
    });

    // 2. Navigation
    elements.navLibrary.addEventListener('click', () => switchView('library', { onLibrary: loadTestsList }));
    elements.navHistory.addEventListener('click', () => switchView('history', { onHistory: loadHistoryData }));
    elements.navUpdates.addEventListener('click', () => switchView('updates', { onUpdates: loadUpdatesData }));
    elements.navDemographics.addEventListener('click', () => switchView('demographics'));

    // 3. Auth Buttons
    elements.btnLogin.addEventListener('click', () => login(elements.emailInput.value, elements.passInput.value));
    elements.btnRegister.addEventListener('click', () => register(elements.emailInput.value, elements.passInput.value));
    elements.btnGuest.addEventListener('click', () => {
        loginGuest();
        loadTestsList();
    });
    elements.btnLogout.addEventListener('click', logout);

    // 4. Feature Buttons
    document.getElementById('btn-export-csv').addEventListener('click', exportHistoryToCSV);
    const btnSaveDemo = document.getElementById('btn-save-demo');
    if (btnSaveDemo) btnSaveDemo.addEventListener('click', saveDemographicsFromForm);

    // 5. About Modal
    if (elements.navAbout) elements.navAbout.addEventListener('click', () => elements.aboutModal.classList.remove('hidden'));
    if (elements.btnCloseAbout) elements.btnCloseAbout.addEventListener('click', () => elements.aboutModal.classList.add('hidden'));

    // 6. Subsystems
    loadSavedDemographics();
    initResultsHandler();

});