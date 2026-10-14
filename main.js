const { app, BrowserWindow, ipcMain, shell, Menu, safeStorage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { createBulkExport } = require('./main/bulkExport');
const { createShell } = require('./main/shell');
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
    getMasterKey: () => keyStore.getOrGenerateMasterKey(),
    preloadPath: path.join(__dirname, 'preload_test.js'),
});
testRunner.registerIpc(ipcMain);

// E5: kolejka pobierania + skan + usuwanie w main/downloads.js
// (funkcje fabryk podpięte leniwie — aliasy-wrappery usunięte w C6).
const downloader = createDownloader({
    fs,
    path,
    https,
    AdmZip,
    getUserDataPath: () => nodePaths.getUserDataPath(app),
    findStartFile: (folderPath) => nodePaths.findStartFile(folderPath),
    openTestWindow: (htmlPath) => testRunner.openTestWindow(htmlPath),
    isTestRunning: () => testRunner.isTestRunning(),
});
downloader.registerIpc(ipcMain);

// E1: ścieżki w main/paths.js (te same sygnatury — reszta pliku bez zmian)
const nodePaths = createPaths({ fs, path });

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

// --- SZYFROWANIE (Key Management) — E1: main/keyStore.js ---
// getUserDataPath wołane lazy wewnątrz store'a (app.getPath() dopiero po whenReady).
const keyStore = createKeyStore({ getUserDataPath: () => nodePaths.getUserDataPath(app), fs, path, safeStorage, crypto });
keyStore.registerIpc(ipcMain);

// E2: okno testu + test-finished/close w main/testRunner.js (rejestracja wyżej;
// downloader dostaje (htmlPath) => testRunner.openTestWindow(htmlPath) wprost).


// E2: zapis lokalny z HMAC w main/testRunner.js (onSaveLocalResult, rejestracja wyżej).

// C6: paczka wyników (ZIP) w main/bulkExport.js (createBulkExport + registerIpc).
// Kanał 'download-bulk-zip' i format CSV (2b/b) bez zmian.
// Domyślnie natywne okno (default w Downloads); cicho tylko gdy renderer
// poda destDir (opcja "Ciche pobieranie" w Ustawieniach).
const bulkExport = createBulkExport({
  dialog,
  AdmZip,
  path,
  getDownloadsDir: () => app.getPath('downloads'),
});
bulkExport.registerIpc(ipcMain, () => mainWindow);

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

// C6: linki zewnętrzne w main/shell.js (allowlista protokołów, kanał bez zmian).
const appShell = createShell({ shell });
appShell.registerIpc(ipcMain);
