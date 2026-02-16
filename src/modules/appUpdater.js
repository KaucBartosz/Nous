
/**
 * Logic for handling Application Updates (Nous Launcher itself)
 */

export function initAppUpdater() {
    const api = window.electronAPI;

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


    if (!api) {
        if (versionSpan) versionSpan.textContent = "Web Mode";
        if (statusDiv) statusDiv.textContent = "Aktualizacje dostępne tylko w aplikacji desktopowej.";
        if (actionContainer) actionContainer.style.display = 'none';
        return;
    }

    // 1. Get Current Version on Start
    api.getAppVersion().then(ver => {
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
            setStatus('Sprawdzanie aktualizacji...', '#aaa');
            api.checkAppUpdate();
        });
    }

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            hide(btnDownload); // Hide download button to prevent double click
            show(progressContainer);
            setStatus('Inicjowanie pobierania...', '#aaa');
            api.downloadAppUpdate();
        });
    }

    if (btnInstall) {
        btnInstall.addEventListener('click', () => {
            api.installAppUpdate();
        });
    }


    // 4. IPC Event Listeners (From Backend)

    api.onAppUpdateChecking(() => {
        setStatus('Sprawdzanie dostępności aktualizacji...', '#aaa');
    });

    api.onAppUpdateAvailable((info) => {
        setStatus(`Dostępna nowa wersja: v${info.version}`, '#4caf50');
        show(btnDownload);
        hide(btnInstall);

        // Auto-show updates tab notification if we were implementing notifications
        console.log("Update available:", info);
    });

    api.onAppUpdateNotAvailable((info) => {
        // info may contain current version or update info
        setStatus('Posiadasz najnowszą wersję.', '#4caf50');
        hide(btnDownload);
        hide(btnInstall);
        hide(progressContainer);
    });

    api.onAppUpdateError((msg) => {
        setStatus(`Błąd: ${msg}`, '#ff5252');
        hide(progressContainer);
        show(btnCheck); // Allow retry
    });

    api.onAppDownloadProgress((progressObj) => {
        show(progressContainer);
        const p = Math.round(progressObj.percent);
        if (progressPercent) progressPercent.textContent = `${p}%`;
        if (progressBar) progressBar.style.width = `${p}%`;

        setStatus(`Pobieranie: ${p}%`, '#aaa');
    });

    api.onAppUpdateDownloaded((info) => {
        setStatus('Aktualizacja pobrana. Gotowa do instalacji.', '#4caf50');
        hide(progressContainer);
        hide(btnDownload);
        show(btnInstall);
    });


    // 5. Auto-check on startup
    // Wait a bit to not block initial render
    setTimeout(() => {
        if (navigator.onLine) {
            console.log("Online: Checking for app updates...");
            api.checkAppUpdate();
        } else {
            console.log("Offline: Skipping update check.");
            setStatus('Brak połączenia. Nie można sprawdzić aktualizacji.', '#e0e0e0');
        }
    }, 2000);

    // Optional: Check when coming back online
    window.addEventListener('online', () => {
        setStatus('Odzyskano połączenie. Sprawdzam aktualizacje...', '#aaa');
        api.checkAppUpdate();
    });
}
