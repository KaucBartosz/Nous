// src/app.js
import { elements, switchView } from './modules/ui.js';
import { initAuth, login, register, logout, loginGuest } from './modules/auth.js';
import { loadTestsList } from './modules/library.js';
import { loadHistoryData, exportHistoryToCSV } from './modules/history.js';
import { loadUpdatesData } from './modules/updates.js';
import { initDemographics, saveDemographicsFromForm } from './modules/demographics.js';
import { initDemoCreator, refreshTemplatesList } from './modules/demoCreator.js';
import { initResultsHandler } from './modules/results.js';
import { initSyncService, setAutoSync, getAutoSyncState } from './modules/sync.js';

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
    elements.navDemoCreator.addEventListener('click', () => switchView('creator', { onCreator: refreshTemplatesList }));

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
    // Note: btn-save-demo listener is now attached in initDemographics if handled there, 
    // but we can keep it here OR there. demographics.js init does it. 
    // Let's rely on initDemographics to keep app.js cleaner, OR double check demographics.js implementation.
    // demographics.js implementation: "if (elements.btnSaveDemo) elements.btnSaveDemo.addEventListener..."
    // So we don't need it here.

    // 5. About Modal
    if (elements.navAbout) elements.navAbout.addEventListener('click', () => elements.aboutModal.classList.remove('hidden'));
    if (elements.btnCloseAbout) elements.btnCloseAbout.addEventListener('click', () => elements.aboutModal.classList.add('hidden'));

    // 6. Subsystems
    initDemographics();
    initDemoCreator();
    initResultsHandler();

    // 7. Offline Sync & Toggle
    initSyncService();

    // Initialize toggle state
    if (elements.toggleSync) {
        elements.toggleSync.checked = getAutoSyncState();
        elements.toggleSync.addEventListener('change', (e) => {
            setAutoSync(e.target.checked);
        });
    }

    // Refresh history if sync updates something
    window.addEventListener('sync-complete', () => {
        // Only refresh if history view is active
        if (elements.navHistory.classList.contains('active')) {
            loadHistoryData();
        }
    });

});