// src/app.js
import { elements, switchView } from './modules/ui.js';
import { initAuth, login, register, logout, loginGuest } from './modules/auth.js';
import { loadTestsList, initViewSwitcher } from './modules/library.js';

import { loadHistoryData, exportHistoryToCSV, initHistoryView } from './modules/history.js';
import { loadUpdatesData } from './modules/updates.js';
import { initDemographics, saveDemographicsFromForm } from './modules/demographics.js';
import { initDemoCreator, refreshTemplatesList } from './modules/demoCreator.js';
import { initResultsHandler } from './modules/results.js';
import { initSyncService, setAutoSync, getAutoSyncState } from './modules/sync.js';
import { initSettings } from './modules/settings.js';
import { initAppUpdater } from './modules/appUpdater.js';

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {

    // 0. Initialize Settings (must be first to apply saved theme/colors)
    initSettings();

    // 1. Auth Setup
    initAuth(() => {
        loadTestsList();
    });

    // 1.5. Initialize library view switcher
    initViewSwitcher();

    // 2. Navigation
    elements.navLibrary.addEventListener('click', () => switchView('library', { onLibrary: loadTestsList }));
    elements.navHistory.addEventListener('click', () => switchView('history', { onHistory: loadHistoryData }));
    elements.navUpdates.addEventListener('click', () => switchView('updates', { onUpdates: loadUpdatesData }));
    elements.navDemographics.addEventListener('click', () => switchView('demographics'));
    elements.navDemoCreator.addEventListener('click', () => switchView('creator', { onCreator: refreshTemplatesList }));
    elements.navSettings.addEventListener('click', () => switchView('settings'));

    // 3. Auth Buttons
    elements.btnLogin.addEventListener('click', () => login(elements.emailInput.value, elements.passInput.value));
    elements.btnRegister.addEventListener('click', () => register(elements.emailInput.value, elements.passInput.value));
    elements.btnGuest.addEventListener('click', () => {
        loginGuest();
        loadTestsList();
    });
    elements.btnLogout.addEventListener('click', logout);
    elements.btnTogglePassword.addEventListener('click', () => {
        const type = elements.passInput.getAttribute('type') === 'password' ? 'text' : 'password';
        elements.passInput.setAttribute('type', type);
        elements.btnTogglePassword.querySelector('.material-icons').textContent = type === 'password' ? 'visibility' : 'visibility_off';
    });
    const handleEnterLogin = (e) => {
        if (e.key === 'Enter') {
            login(elements.emailInput.value, elements.passInput.value);
        }
    };
    elements.emailInput.addEventListener('keydown', handleEnterLogin);
    elements.passInput.addEventListener('keydown', handleEnterLogin);

    // 4. Feature Buttons
    document.getElementById('btn-export-csv').addEventListener('click', exportHistoryToCSV);

    // 5. About Modal
    if (elements.navAbout) elements.navAbout.addEventListener('click', () => elements.aboutModal.classList.remove('hidden'));
    if (elements.btnCloseAbout) elements.btnCloseAbout.addEventListener('click', () => elements.aboutModal.classList.add('hidden'));

    if (elements.btnAboutCloseFooter) elements.btnAboutCloseFooter.addEventListener('click', () => elements.aboutModal.classList.add('hidden'));

    // 5.5. History View Init
    initHistoryView();

    // 6. Subsystems
    initDemographics();
    initDemoCreator();
    initResultsHandler();
    initAppUpdater();

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

    // 8. Global Status/Error Handling
    if (window.electronAPI) {
        window.electronAPI.onStatusUpdate((message) => {
            console.log("[Electron Status]:", message);

            // Simple heuristic to detect errors
            if (message.startsWith("BŁĄD") || message.includes("Error")) {
                import('./modules/dialog.js').then(({ Dialog }) => {
                    Dialog.alert(message, 'error');
                });
            } else {
                // For non-error messages, we might just log them or show a toast if we had one.
                // Currently, many messages are handled by the button state updates in library.js (download progress/state).
                // However, some global messages might be useful to see.
            }
        });
    }

});