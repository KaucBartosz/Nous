// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 1. Pobieranie testów (tylko JS) — download XOR run, nigdy AND.
    // Pobranie zapisuje paczkę na dysk, nie uruchamia. Uruchomienie robi runTest.
    downloadTest: (payload) =>
        ipcRenderer.send('download-test', payload),

    // 1b. Uruchomienie testu z dysku (nigdy nie pobiera).
    runTest: (testId) =>
        ipcRenderer.send('run-test', { testId }),

    onStatusUpdate: (callback) => ipcRenderer.on('test-status', (event, message) => callback(message)),
    onTestResults: (callback) => ipcRenderer.on('test-results-forwarded', (event, data) => callback(data)),
    saveResultToDisk: (data) => ipcRenderer.send('save-local-result', data),
    getLocalVersions: () => ipcRenderer.invoke('get-local-versions'),

    // 2. NOWA FUNKCJA USUWANIA
    deleteTest: (testId) => ipcRenderer.invoke('delete-test', testId),

    // 3. NOWA FUNKCJA PROGRESS
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),

    // 4. SZYFROWANIE
    getEncryptionKey: () => ipcRenderer.invoke('get-encryption-key'),
    getE2EKey: () => ipcRenderer.invoke('get-e2e-key'),
    setE2EKey: (key) => ipcRenderer.invoke('set-e2e-key', key),
    clearE2EKey: () => ipcRenderer.invoke('clear-e2e-key'),

    // 5. ZDARZENIA INSTALACJI
    onTestInstalled: (callback) => ipcRenderer.on('test-installed', (event, data) => callback(data)),

    // 6. AKTUALIZACJE APLIKACJI
    checkAppUpdate: () => ipcRenderer.send('check-app-update'),
    downloadAppUpdate: () => ipcRenderer.send('download-app-update'),
    installAppUpdate: () => ipcRenderer.send('install-app-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    onAppUpdateChecking: (callback) => ipcRenderer.on('app-update-checking', (event) => callback()),
    onAppUpdateAvailable: (callback) => ipcRenderer.on('app-update-available', (event, info) => callback(info)),
    onAppUpdateNotAvailable: (callback) => ipcRenderer.on('app-update-not-available', (event, info) => callback(info)),
    onAppUpdateError: (callback) => ipcRenderer.on('app-update-error', (event, message) => callback(message)),
    onAppDownloadProgress: (callback) => ipcRenderer.on('app-download-progress', (event, progressObj) => callback(progressObj)),
    onAppUpdateDownloaded: (callback) => ipcRenderer.on('app-update-downloaded', (event, info) => callback(info)),

    // 7. IMPORT / EKSPORT SZABLONÓW
    exportTemplate: (data) => ipcRenderer.invoke('export-template', data),
    importTemplate: () => ipcRenderer.invoke('import-template'),

    // 8. ZAPIS PACZKI ZIP
    downloadBulkZip: (data) => ipcRenderer.invoke('download-bulk-zip', data),

    // 8b. CICHE POBIERANIE (opcja w Ustawieniach; domyślnie dialog systemowy)
    getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
    pickDownloadFolder: (current) => ipcRenderer.invoke('pick-download-folder', current),
    setSilentDownloads: (mode) => ipcRenderer.send('set-silent-downloads', mode),

    // 9. OTWIERANIE LINKÓW
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // 10. ZDARZENIA PROCESU TESTU
    onTestProcessStopped: (callback) => ipcRenderer.on('test-process-stopped', () => callback()),

    // 11. SYSTEM INFO
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux'
});
