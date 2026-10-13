const { app, BrowserWindow, ipcMain, shell, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { buildBulkCsv } = require('./main/bulkExport');
const { createPaths } = require('./main/paths');
const { createKeyStore } = require('./main/keyStore');
const { createTestRunner } = require('./main/testRunner');
const { createUpdater } = require('./main/updater');
const { createTemplates } = require('./main/templates');
const { createDownloader } = require('./main/downloads');
const { autoUpdater } = require('electron-updater');

// WYMUSZENIE PUBLICZNEGO REPOZYTORIUM JAKO ŹRÓDŁA AKTUALIZACJI
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'KaucBartosz',
    repo: 'Nous'
});
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;


// Logowanie updater
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";



let mainWindow;

// E2: okno testu w main/testRunner.js (stan activeTestWindow żyje tam)
const testRunner = createTestRunner({
    BrowserWindow,
    screen: require('electron').screen,
    path,
    dialog: require('electron').dialog,
    fs,
    crypto,
    getMainWindow: () => mainWindow,
    getMasterKey: () => getOrGenerateMasterKey(),
    preloadPath: path.join(__dirname, 'preload_test.js'),
});
testRunner.registerIpc(ipcMain);

function isTestRunning() {
    return testRunner.isTestRunning();
}

// E5: kolejka pobierania + skan + usuwanie w main/downloads.js
const downloader = createDownloader({
    fs,
    path,
    https,
    AdmZip,
    getUserDataPath,
    findStartFile,
    openTestWindow,
    isTestRunning,
});
downloader.registerIpc(ipcMain);

// E1: ścieżki w main/paths.js (te same sygnatury — reszta pliku bez zmian)
const nodePaths = createPaths({ fs, path });
function getUserDataPath() {
    return nodePaths.getUserDataPath(app);
}

function createWindow() {
    // Dobierz ikonę odpowiednią dla platformy
    let iconPath;
    if (process.platform === 'darwin') {
        iconPath = path.join(__dirname, 'icon.icns'); // macOS wymaga .icns
    } else if (process.platform === 'win32') {
        iconPath = path.join(__dirname, 'icon.ico');  // Windows wymaga .ico
    } else {
        iconPath = path.join(__dirname, 'logo.png');  // Linux: PNG
    }

    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        title: "Nous",
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
}

// E1: szukanie plików w main/paths.js (te same sygnatury)
function findFileInSubfolders(folderPath, filename) {
    return nodePaths.findFileInSubfolders(folderPath, filename);
}

function findStartFile(folderPath) {
    return nodePaths.findStartFile(folderPath);
}

// ==========================================================
// 1. OBSŁUGA POBIERANIA (ZIP) I URUCHAMIANIA
// ==========================================================

// E5: download-and-run w main/downloads.js (rejestracja wyżej).

// E5: executeDownloadTask w main/downloads.js (bez zmian, ze wstrzykniętymi deps).


// ==========================================================
// 2. SKANOWANIE LOKALNEJ BIBLIOTEKI
// ==========================================================

// E5: get-local-versions w main/downloads.js (scanLocalVersions, rejestracja wyżej).


// ==========================================================
// 3. USUWANIE TESTÓW
// ==========================================================

// E5: delete-test w main/downloads.js (deleteTestById, rejestracja wyżej).


// ==========================================================
// 4. OKNO TESTOWE (PEŁNY EKRAN)
// ==========================================================

// --- SZYFROWANIE (Key Management) — E1: main/keyStore.js ---
// getUserDataPath wołane lazy wewnątrz store'a (app.getPath() dopiero po whenReady).
const keyStore = createKeyStore({ getUserDataPath, fs, path, safeStorage, crypto });
function getOrGenerateMasterKey() {
    return keyStore.getOrGenerateMasterKey();
}
keyStore.registerIpc(ipcMain);

// E2: okno testu + test-finished/close w main/testRunner.js (rejestracja wyżej).
// Alias dla kodu kolejki pobierania (do E5).
function openTestWindow(htmlPath) {
    return testRunner.openTestWindow(htmlPath);
}


// E2: zapis lokalny z HMAC w main/testRunner.js (onSaveLocalResult, rejestracja wyżej).

ipcMain.handle('download-bulk-zip', async (event, { results, filename, format }) => {
    const dialog = require('electron').dialog;
    const zip = new AdmZip();

    try {
        results.forEach((res, index) => {
            const dateStr = new Date(res.timestamp || res.synced_at).toISOString().replace(/[:.]/g, '-');
            const testId = res.test_id || res.testId || 'unknown';
            const subjectId = res.subject_id || 'unknown';
            const baseName = `Wynik_${testId}_${subjectId}_${dateStr}`;

            if (format === 'csv') {
                let csvContent = buildBulkCsv(res); // C (2b/b): wiersz jak ResultExporter (main/bulkExport.js)
                // (wiersz w buildBulkCsv: nagłówki ` - `, `Badacz UID`, braki `-`)
                zip.addFile(`${baseName}.csv`, Buffer.from(csvContent, 'utf8'));
            } else {
                const jsonStr = JSON.stringify(res, null, 2);
                zip.addFile(`${baseName}.json`, Buffer.from(jsonStr, 'utf8'));
            }
        });

        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Zapisz paczkę wyników (ZIP)',
            defaultPath: filename,
            filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (filePath) {
            zip.writeZip(filePath);
            return { success: true };
        }
        return { success: false, cancelled: true };
    } catch (e) {
        console.error("Bulk Zip Error:", e);
        return { success: false, error: e.message };
    }
});

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    mainWindow.webContents.on('before-input-event', (event, input) => {
        const { key, control, shift } = input;
        if (key === 'F12' ||
            key === 'F5' && control ||
            (control && shift && (key === 'I' || key === 'i' || key === 'J' || key === 'j' || key === 'C' || key === 'c'))) {
            event.preventDefault();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==========================================================
// 6. OBSŁUGA AKTUALIZACJI APLIKACJI (IPC) — E3: main/updater.js
// ==========================================================

const updater = createUpdater({ app, autoUpdater });
updater.registerIpc(ipcMain, () => mainWindow);
updater.registerFeedEvents(() => mainWindow);


// ==========================================================
// 7. IMPORT / EKSPORT SZABLONÓW (IPC) — E4: main/templates.js
// ==========================================================

const templates = createTemplates({ dialog: require('electron').dialog, fs });
templates.registerIpc(ipcMain, () => mainWindow);

ipcMain.on('open-external', (event, url) => {
    // Walidacja: tylko bezpieczne protokoły (zapobieganie SSRF przez shell.openExternal)
    try {
        const parsed = new URL(url);
        if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
            console.error(`[Security] Zablokowano open-external dla protokołu: ${parsed.protocol}`);
            return;
        }
        shell.openExternal(url);
    } catch (e) {
        console.error(`[Security] Nieprawidłowy URL w open-external: ${url}`);
    }
});
