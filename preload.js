// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 1. Aktualizacja downloadAndRun (dodano parametr onlyDownload = false)
    downloadAndRun: (url, testId, version, onlyDownload = false) =>
        ipcRenderer.send('download-and-run', { url, testId, version, onlyDownload }),

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
    onTestInstalled: (callback) => ipcRenderer.on('test-installed', (event, data) => callback(data))
});