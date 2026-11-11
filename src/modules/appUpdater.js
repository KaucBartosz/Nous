
/**
 * Logic for handling Application Updates (Nous Launcher itself)
 */

import { updateUpdatesBadge } from './utils.js';
import { getPlatform } from '../platform/index.js';
import { toast } from '../notify/notify.js';
import { t } from '../i18n/index.js';

// Tracks whether an app update is available (so we can add/remove +1 from badge)
let _appUpdateAvailable = false;

export function initAppUpdater() {
    // C1: cały moduł przez seam (wcześniej 1x window.electronAPI + 15x api.*)
    const platform = getPlatform();
    const api = platform.updates;

    // Elements
    const versionSpan = document.getElementById('app-current-version');
    const statusDiv = document.getElementById('app-update-status');

    // Progress
    const progressContainer = document.getElementById('app-update-progress-container');
    const progressPercent = document.getElementById('app-update-percent');
    const progressBar = document.getElementById('app-update-bar');

    // Buttons
    const btnCheck = document.getElementById('btn-check-app-update');
    const btnDownload = document.getElementById('btn-download-app-update');
    const btnInstall = document.getElementById('btn-install-app-update');
    const actionContainer = document.getElementById('app-update-actions');


    if (platform.kind !== 'electron') {
        if (versionSpan) versionSpan.textContent = t('updates.webMode');
        if (statusDiv) statusDiv.textContent = t('updates.desktopOnly');
        if (actionContainer) actionContainer.style.display = 'none';
        return;
    }

    // 1. Get Current Version on Start
    api.getVersion().then(ver => {
        if (versionSpan) versionSpan.textContent = `v${ver}`;
    });

    // 2. Helpers
    const show = (el) => el && el.classList.remove('hidden');
    const hide = (el) => el && el.classList.add('hidden');

    const setStatus = (msg, color = '#aaa') => {
        if (statusDiv) {
            statusDiv.textContent = msg;
            statusDiv.style.color = color;
        }
    };

    // 3. Event Listeners (Frontend Buttons)
    if (btnCheck) {
        btnCheck.addEventListener('click', () => {
            hide(btnDownload);
            hide(btnInstall);
            hide(progressContainer);
            setStatus(t('updates.checkingShort'), '#aaa');
            api.check();
        });
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (platform.isMac) {
                platform.links.openExternal('https://github.com/KaucBartosz/Nous/releases/latest');
                return;
            }
            hide(btnDownload); // Hide download button to prevent double click
            show(progressContainer);
            setStatus(t('updates.initializing'), '#aaa');
            api.download();
        });
    }

    if (btnInstall) {
        btnInstall.addEventListener('click', () => {
            api.install();
        });
    }


    // 4. IPC Event Listeners (From Backend)

    api.onChecking(() => {
        setStatus(t('updates.checking'), '#aaa');
    });

    api.onAvailable((info) => {
        setStatus(t('updates.availableVersion', { version: info.version }), '#4caf50');

        if (platform.isMac) {
            btnDownload.innerHTML = `<span class="material-icons">open_in_new</span> ${t('updates.openGitHub')}`;
        }

        show(btnDownload);
        hide(btnInstall);

        // #12: Add +1 to updates badge for app update
        if (!_appUpdateAvailable) {
            _appUpdateAvailable = true;
            // Increment badge by reading current value and adding 1
            const badge = document.getElementById('updates-badge');
            const current = badge ? (parseInt(badge.textContent) || 0) : 0;
            updateUpdatesBadge(current + 1);
        }

        // Show Toast Notification
        showUpdateToast(info.version);

        console.log("Update available:", info);
    });

    // --- Helper: Create and Show Toast (C5: konstrukcja w notify, te same ID/klasy/teksty) ---
    function showUpdateToast(newVersion) {
        toast({
            id: "update-toast",
            titleHtml: t('updates.available'),
            messageHtml: t('updates.updateAvailable', {
                version: newVersion,
                manual: platform.isMac ? t('updates.macManualNote') : '',
            }),
            actions: [
                { id: "btn-toast-dismiss", label: t('updates.later') },
                {
                    id: "btn-toast-update",
                    label: platform.isMac ? t('updates.downloadFromGitHub') : t('updates.goToUpdate'),
                    primary: true,
                    onClick: (close) => {
                        close();
                        if (platform.isMac) {
                            platform.links.openExternal('https://github.com/KaucBartosz/Nous/releases/latest');
                        } else {
                            // Switch to Updates Tab
                            const updatesBtn = document.getElementById('nav-updates');
                            if (updatesBtn) updatesBtn.click();
                        }
                    },
                },
            ],
        });
    }

    api.onNotAvailable((info) => {
        // info may contain current version or update info
        setStatus(t('updates.upToDate'), '#4caf50');
        hide(btnDownload);
        hide(btnInstall);
        hide(progressContainer);
    });

    api.onError((msg) => {
        setStatus(t('updates.error', { message: msg }), '#ff5252');
        hide(progressContainer);
        show(btnCheck); // Allow retry
    });

    api.onDownloadProgress((progressObj) => {
        show(progressContainer);
        const p = Math.round(progressObj.percent);
        if (progressPercent) progressPercent.textContent = `${p}%`;
        if (progressBar) progressBar.style.width = `${p}%`;

        setStatus(t('updates.downloadingPercent', { percent: p }), '#aaa');
    });

    api.onDownloaded((info) => {
        setStatus(t('updates.downloadedReady'), '#4caf50');
        hide(progressContainer);
        hide(btnDownload);
        show(btnInstall);
    });


    // 5. Auto-check on startup
    // Wait a bit to not block initial render
    setTimeout(() => {
        if (navigator.onLine) {
            console.log("Online: Checking for app updates...");
            api.check();
        } else {
            console.log("Offline: Skipping update check.");
            setStatus(t('updates.noConnection'), '#e0e0e0');
        }
    }, 2000);

    // Optional: Check when coming back online
    window.addEventListener('online', () => {
        setStatus(t('updates.connectionRestored'), '#aaa');
        api.check();
    });
}
