// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 1. Aktualizacja downloadAndRun (dodano parametr onlyDownload, hpmEnabled i trainingMode)
    downloadAndRun: (url, testId, version, onlyDownload = false, hpmEnabled = false, trainingMode = false, testName = '', testDescription = '', isLocalDev = false) =>
        ipcRenderer.send('download-and-run', { url, testId, version, onlyDownload, hpmEnabled, trainingMode, testName, testDescription, isLocalDev }),

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

    // 9. OTWIERANIE LINKÓW
    openExternal: (url) => ipcRenderer.send('open-external', url),

    // 10. HIGH PRECISION MODE (HPM)
    getHpmStatus: () => ipcRenderer.invoke('get-hpm-status'),
    downloadHpmEngine: () => ipcRenderer.send('download-hpm-engine'),
    onHpmDownloadProgress: (callback) => ipcRenderer.on('hpm-download-progress', (event, percent) => callback(percent)),
    onHpmInstalled: (callback) => ipcRenderer.on('hpm-installed', (event, success) => callback(success)),

    // 11. ZDARZENIA PROCESU TESTU
    onTestProcessStopped: (callback) => ipcRenderer.on('test-process-stopped', () => callback()),

    // 12. SYSTEM INFO
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    getLinuxDistro: () => ipcRenderer.invoke('get-linux-distro'),
    checkHpmUpdate: () => ipcRenderer.invoke('check-hpm-update')
});
