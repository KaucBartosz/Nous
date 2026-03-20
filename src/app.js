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
import { initWhatsNew, loadWhatsNewView } from './modules/whatsNew.js';

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {

    // 0. Initialize Settings (must be first to apply saved theme/colors)
    initSettings();

    // 1. Auth Setup
    if (!window.electronAPI) {
        // --- WEB MODE ---
        // Zablokuj przyciski tagów globalnie przez nadpisanie stylów CSS
        const webStyles = document.createElement('style');
        webStyles.innerHTML = `.tag-btn { opacity: 0.3 !important; pointer-events: none !important; }`;
        document.head.appendChild(webStyles);

        // Ostrzeżenie do nagłówka
        const titleDiv = document.querySelector('.header-title');
        if (titleDiv) {
            const warning = document.createElement('span');
            warning.style.cssText = 'color: #ff9800; font-size: 11px; margin-left: 10px; font-weight: normal;';
            warning.textContent = '[Wersja Przeglądarkowa - Wyniki mogą być mniej precyzyjne]';
            titleDiv.appendChild(warning);
        }

        // Zablokuj funkcje desktopowe w menu głównym
        const disableNav = (el, msg) => {
            if (el) {
                el.style.opacity = '0.5';
                el.style.pointerEvents = 'none'; // Zapobiega css hover
                el.parentElement.style.cursor = 'not-allowed';
                el.parentElement.title = msg;
                // Przechwytywanie kliknięcia na elemencie nadrzędnym (np. <li>)
                el.parentElement.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    import('./modules/dialog.js').then(({ Dialog }) => Dialog.alert(msg, 'info'));
                }, true);
            }
        };

        disableNav(elements.navHistory, "Historia wyników dostępna jest tylko w aplikacji Desktopowej. Z poziomu przeglądarki pobierasz plik po zrealizowanym badaniu.");
        disableNav(elements.navUpdates, "Zarządzanie aktualizacjami dotyczy wyłącznie aplikacji Desktopowej.");
        
        // Zablokuj HPM
        if (elements.toggleHPM) {
            elements.toggleHPM.disabled = true;
            elements.toggleHPM.checked = false;
            elements.toggleHPM.parentElement.parentElement.title = "Tryb HPM wymaga natywnej aplikacji Desktopowej.";
            elements.toggleHPM.parentElement.parentElement.style.opacity = '0.5';
        }

        // Blokada urządzeń mobilnych (ekranów dotykowych)
        if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0)) {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#0f172a; color:white; padding:40px; text-align:center; font-family:sans-serif;">
                    <span class="material-icons" style="font-size:64px; color:#ff9800; margin-bottom:20px;">mouse</span>
                    <h2 style="margin-bottom:10px;">Aplikacja niedostępna na ekranach dotykowych</h2>
                    <p style="color:#94a3b8; max-width:400px; line-height:1.5;">Wersja przeglądarkowa platformy Nous wymaga użycia komputera z kursorem myszy i/lub klawiaturą ze względu na specyfikę testów psychometrycznych.</p>
                </div>
            `;
            return;
        }

        // W wersji WEB od razu logujemy jako Gość i ładujemy bibliotekę (pomijając ekran logowania)
        loginGuest();
        loadTestsList();
    } else {
        // --- DESKTOP MODE ---
        initAuth(() => {
            loadTestsList();
        });
    }

    // 1.5. Initialize library view switcher
    initViewSwitcher();

    // 2. Navigation
    elements.navLibrary.addEventListener('click', () => switchView('library', { onLibrary: loadTestsList }));
    elements.navHistory.addEventListener('click', () => switchView('history', { onHistory: loadHistoryData }));
    elements.navUpdates.addEventListener('click', () => switchView('updates', { onUpdates: loadUpdatesData }));
    elements.navDemographics.addEventListener('click', () => switchView('demographics'));
    elements.navDemoCreator.addEventListener('click', () => switchView('creator', { onCreator: refreshTemplatesList }));
    elements.navWhatsNew.addEventListener('click', () => switchView('whatsNew', { onWhatsNew: loadWhatsNewView }));
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

    document.getElementById('btn-about-project').addEventListener('click', () => {
        const url = 'https://kaucbartosz.github.io/Nous/';
        if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    });

    // 5.5. History View Init
    initHistoryView();

    // 6. Subsystems
    initDemographics();
    initDemoCreator();
    initResultsHandler();
    initAppUpdater();
    initWhatsNew();

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