// src/modules/ui.js

export const elements = {
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
    navAbout: document.getElementById('nav-about'),

    viewLibrary: document.getElementById('tests-grid'),
    viewHistory: document.getElementById('history-view'),
    viewUpdates: document.getElementById('updates-view'),
    viewDemographics: document.getElementById('demographics-view'),
    viewDemoCreator: document.getElementById('demo-creator-view'),

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

    userEmailDisplay: document.getElementById('user-email-display'),
    userStatusDisplay: document.getElementById('user-status-display'),
    btnLogout: document.getElementById('btn-logout'),

    // Auth buttons
    btnLogin: document.getElementById('btn-login'),
    btnRegister: document.getElementById('btn-register'),
    btnGuest: document.getElementById('btn-guest'),

    // Sync Toggle
    toggleSync: document.getElementById('toggle-sync'),
};

export function switchView(viewName, callbacks = {}) {
    const { viewLibrary, viewHistory, viewUpdates, viewDemographics, viewDemoCreator } = elements;
    const { navLibrary, navHistory, navUpdates, navDemographics, navDemoCreator } = elements;

    // Hide all
    viewLibrary.classList.add('hidden');
    viewHistory.classList.add('hidden');
    viewUpdates.classList.add('hidden');
    viewDemographics.classList.add('hidden');
    viewDemoCreator.classList.add('hidden');

    // Deactivate navs
    navLibrary.classList.remove('active');
    navHistory.classList.remove('active');
    navUpdates.classList.remove('active');
    navDemographics.classList.remove('active');
    navDemoCreator.classList.remove('active');

    if (viewName === 'library') {
        viewLibrary.classList.remove('hidden');
        navLibrary.classList.add('active');
        if (callbacks.onLibrary) callbacks.onLibrary();
    } else if (viewName === 'history') {
        viewHistory.classList.remove('hidden');
        navHistory.classList.add('active');
        if (callbacks.onHistory) callbacks.onHistory();
    } else if (viewName === 'updates') {
        viewUpdates.classList.remove('hidden');
        navUpdates.classList.add('active');
        if (callbacks.onUpdates) callbacks.onUpdates();
    } else if (viewName === 'demographics') {
        viewDemographics.classList.remove('hidden');
        navDemographics.classList.add('active');
        if (callbacks.onDemographics) callbacks.onDemographics();
    } else if (viewName === 'creator') {
        viewDemoCreator.classList.remove('hidden');
        navDemoCreator.classList.add('active');
        if (callbacks.onCreator) callbacks.onCreator();
    }
}

export function updateAuthUI(userEmail, userStatus) {
    elements.loginScreen.classList.add('hidden');
    elements.dashboardScreen.classList.remove('hidden');

    elements.userEmailDisplay.innerText = userEmail || "Gość";
    elements.userStatusDisplay.innerText = userStatus;

    if (userStatus === 'APPROVED') elements.userStatusDisplay.style.color = '#4caf50';
    else if (userStatus === 'PENDING') elements.userStatusDisplay.style.color = '#ff9800';
    else elements.userStatusDisplay.style.color = '#aaa';
}

export function showLoginScreen() {
    elements.loginScreen.classList.remove('hidden');
    elements.dashboardScreen.classList.add('hidden');
}

export function showError(message) {
    elements.errorMsg.innerText = message;
}
