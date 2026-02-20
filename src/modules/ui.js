// src/modules/ui.js

// Lazy-loaded elements cache
let _elements = null;

/**
 * Pobiera elementy DOM (leniwe ładowanie).
 * Gwarantuje że elementy są pobierane dopiero po załadowaniu DOM.
 */
function getElementsLazy() {
    if (_elements) return _elements;

    _elements = {
        loginScreen: document.getElementById('login-screen'),
        dashboardScreen: document.getElementById('dashboard-screen'),
        emailInput: document.getElementById('email'),
        passInput: document.getElementById('password'),
        errorMsg: document.getElementById('error-msg'),

        navLibrary: document.getElementById('nav-library'),
        navHistory: document.getElementById('nav-history'),
        navUpdates: document.getElementById('nav-updates'),
        navDemographics: document.getElementById('nav-demographics'),
        navDemoCreator: document.getElementById('nav-demo-creator'),
        navSettings: document.getElementById('nav-settings'),
        navWhatsNew: document.getElementById('nav-whats-new'),
        navAbout: document.getElementById('nav-about'),

        viewLibrary: document.getElementById('library-view'),
        testsGrid: document.getElementById('tests-grid'),
        viewHistory: document.getElementById('history-view'),
        viewUpdates: document.getElementById('updates-view'),
        viewDemographics: document.getElementById('demographics-view'),
        viewDemoCreator: document.getElementById('demo-creator-view'),
        viewSettings: document.getElementById('settings-view'),
        viewWhatsNew: document.getElementById('whats-new-view'),

        historyTableBody: document.querySelector('#history-table tbody'),
        updatesTableBody: document.querySelector('#updates-table tbody'),

        // Demo Form
        demoTemplateSelect: document.getElementById('demo-template-select'),
        dynamicDemoForm: document.getElementById('dynamic-demo-form'),
        btnSaveDemo: document.getElementById('btn-save-demo'),

        modalOverlay: document.getElementById('results-modal'),
        btnCloseModal: document.getElementById('btn-close-modal'),
        btnDiscard: document.getElementById('btn-discard'),
        btnUploadCloud: document.getElementById('btn-upload-cloud'),
        modalUploadInfo: document.getElementById('modal-upload-info'),

        aboutModal: document.getElementById('about-modal'),
        btnCloseAbout: document.getElementById('btn-close-about'),
        btnAboutCloseFooter: document.getElementById('btn-about-close-footer'),

        userEmailDisplay: document.getElementById('user-email-display'),
        userStatusDisplay: document.getElementById('user-status-display'),
        btnLogout: document.getElementById('btn-logout'),

        // Auth buttons
        btnLogin: document.getElementById('btn-login'),
        btnRegister: document.getElementById('btn-register'),

        btnGuest: document.getElementById('btn-guest'),
        btnTogglePassword: document.getElementById('btn-toggle-password'),
        btnToggleGuestView: document.getElementById('btn-toggle-guest-view'),
        btnToggleCloudView: document.getElementById('btn-toggle-cloud-view'),
        cloudActionsContainer: document.getElementById('cloud-actions-container'),
        btnCloudImportAll: document.getElementById('btn-cloud-import-all'),
        btnCloudDownloadAll: document.getElementById('btn-cloud-download-all'),

        guestActionsContainer: document.getElementById('guest-actions-container'),
        btnGuestImportAll: document.getElementById('btn-guest-import-all'),
        btnGuestDownloadAll: document.getElementById('btn-guest-download-all'),

        localActionsContainer: document.getElementById('local-actions-container'),
        btnLocalDownloadAll: document.getElementById('btn-local-download-all'),

        // Sync Toggle
        toggleSync: document.getElementById('toggle-sync'),
        syncToggleContainer: document.getElementById('sync-toggle-container'),

        // Training Mode
        toggleTrainingMode: document.getElementById('toggle-training-mode'),
        trainingResultsContent: document.getElementById('training-results-content'),
        normalResultsContent: document.getElementById('normal-results-content'),
        modalHeaderTitle: document.querySelector('#results-modal .modal-header h3'),
    };

    return _elements;
}

// Proxy dla zachowania kompatybilności wstecznej
// Pozwala używać elements.XXX zamiast getElementsLazy().XXX
export const elements = new Proxy({}, {
    get(target, prop) {
        return getElementsLazy()[prop];
    }
});

// View configuration map
const VIEW_CONFIG = {
    library: {
        view: 'viewLibrary',
        nav: 'navLibrary',
        callback: 'onLibrary'
    },
    history: {
        view: 'viewHistory',
        nav: 'navHistory',
        callback: 'onHistory'
    },
    updates: {
        view: 'viewUpdates',
        nav: 'navUpdates',
        callback: 'onUpdates'
    },
    demographics: {
        view: 'viewDemographics',
        nav: 'navDemographics',
        callback: 'onDemographics'
    },
    creator: {
        view: 'viewDemoCreator',
        nav: 'navDemoCreator',
        callback: 'onCreator'
    },
    whatsNew: {
        view: 'viewWhatsNew',
        nav: 'navWhatsNew',
        callback: 'onWhatsNew'
    },
    settings: {
        view: 'viewSettings',
        nav: 'navSettings',
        callback: 'onSettings'
    }
};

export function switchView(viewName, callbacks = {}) {
    // Hide all views and deactivate all nav items
    Object.values(VIEW_CONFIG).forEach(config => {
        elements[config.view]?.classList.add('hidden');
        elements[config.nav]?.classList.remove('active');
    });

    // Show selected view and activate nav
    const config = VIEW_CONFIG[viewName];
    if (config) {
        elements[config.view]?.classList.remove('hidden');
        elements[config.nav]?.classList.add('active');

        // Execute callback if provided
        const callbackFn = callbacks[config.callback];
        if (callbackFn) {
            callbackFn();
        }
    } else {
        console.warn(`Unknown view: ${viewName}`);
    }
}

export function updateAuthUI(userEmail, userStatus) {
    elements.loginScreen.classList.add('hidden');
    elements.dashboardScreen.classList.remove('hidden');

    elements.userEmailDisplay.textContent = userEmail || "Gość";
    elements.userStatusDisplay.textContent = userStatus;

    if (userStatus === 'APPROVED') elements.userStatusDisplay.style.color = '#4caf50';
    else if (userStatus === 'PENDING') elements.userStatusDisplay.style.color = '#ff9800';
    else elements.userStatusDisplay.style.color = '#aaa';

    // Hide sync if Guest
    if (userStatus === 'GUEST') {
        elements.syncToggleContainer?.classList.add('hidden');
    } else {
        elements.syncToggleContainer?.classList.remove('hidden');
    }
}

export function showLoginScreen() {
    elements.loginScreen.classList.remove('hidden');
    elements.dashboardScreen.classList.add('hidden');
}

export function showError(message) {
    elements.errorMsg.textContent = message;

    // Shake animation for login card on error
    const card = elements.loginScreen.querySelector('.login-card');
    if (card && message && !message.includes("Logowanie") && !message.includes("Weryfikacja") && !message.includes("Tworzenie")) {
        card.classList.remove('shake');
        void card.offsetWidth; // force reflow
        card.classList.add('shake');
    }
}
