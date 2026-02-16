// main.js - Wersja Finalna (Fullscreen + Icons Support)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');

// WYMUSZENIE PUBLICZNEGO REPOZYTORIUM JAKO ŹRÓDŁA AKTUALIZACJI
autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'KaucBartosz',
    repo: 'BBTP-Release'
});
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;


// Logowanie updater
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";



let mainWindow;

// Rate limiting: Track active downloads to prevent concurrent downloads of the same test
const activeDownloads = new Set();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Nous",
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
}

// --- FUNKCJA POMOCNICZA: Szukanie index.html w podfolderach ---
function findStartFile(folderPath) {
    if (!fs.existsSync(folderPath)) return null;

    // 1. Sprawdź bezpośrednio
    const directPath = path.join(folderPath, 'index.html');
    if (fs.existsSync(directPath)) return directPath;

    // 2. Sprawdź podfoldery
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = path.join(folderPath, entry.name, 'index.html');
                if (fs.existsSync(subPath)) return subPath;
            }
        }
    } catch (e) {
        console.error("Błąd przeszukiwania folderu:", e);
    }
    return null;
}

// ==========================================================
// 1. OBSŁUGA POBIERANIA (ZIP) I URUCHAMIANIA
// ==========================================================

ipcMain.on('download-and-run', (event, { url, testId, version, onlyDownload }) => {
    const sender = event.sender;

    // --- SECURITY CHECK: RATE LIMITING ---
    // Prevent concurrent downloads of the same test
    if (activeDownloads.has(testId)) {
        console.log(`Download already in progress for testId: ${testId}`);
        sender.send('test-status', 'Pobieranie już w toku!');
        return;
    }

    // --- SECURITY CHECK: TEST ID VALIDATION ---
    // Prevent Path Traversal (e.g. "../../../Windows")
    if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
        console.error(`Blocked invalid testId: ${testId}`);
        sender.send('test-status', 'BŁĄD BEZPIECZEŃSTWA: Nieprawidłowe ID testu!');
        activeDownloads.delete(testId); // Clean up
        return;
    }

    // --- SECURITY CHECK: DOMAIN & PROTOCOL ALLOWLIST ---
    try {
        const parsedUrl = new URL(url);

        // Walidacja protokołu - tylko HTTPS
        if (parsedUrl.protocol !== 'https:') {
            console.error(`Blocked download: non-HTTPS protocol: ${parsedUrl.protocol}`);
            sender.send('test-status', 'BŁĄD BEZPIECZEŃSTWA: Tylko HTTPS jest dozwolony!');
            activeDownloads.delete(testId);
            return;
        }

        const allowedDomains = ['github.com', 'raw.githubusercontent.com', 'www.github.com', 'www.raw.githubusercontent.com'];
        if (!allowedDomains.includes(parsedUrl.hostname)) {
            console.error(`Blocked download from unauthorized domain: ${parsedUrl.hostname}`);
            sender.send('test-status', 'BŁĄD BEZPIECZEŃSTWA: Niedozwolona domena pobierania!');
            activeDownloads.delete(testId);
            return;
        }
    } catch (e) {
        console.error(`Invalid URL blocked: ${url}`);
        sender.send('test-status', 'BŁĄD: Nieprawidłowy adres URL!');
        activeDownloads.delete(testId);
        return;
    }

    // Mark download as active
    activeDownloads.add(testId);

    // Definicje ścieżek
    const userDataPath = app.getPath('userData');
    const testsDir = path.join(userDataPath, 'tests_library');
    const testFolder = path.join(testsDir, testId);

    const zipPath = path.join(testFolder, 'package.zip');
    const metaPath = path.join(testFolder, 'meta.json');

    // Szukamy pliku startowego (może być głębiej)
    let entryFile = findStartFile(testFolder);

    // --- KROK 1: SPRAWDZANIE CACHE ---
    let needsDownload = true;

    if (fs.existsSync(testFolder) && fs.existsSync(metaPath) && entryFile) {
        try {
            const localMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (Number(localMeta.version) >= Number(version)) {
                needsDownload = false;
            }
        } catch (e) {
            console.log("Błąd odczytu meta.json, wymuszam pobieranie.");
        }
    }

    // --- KROK 2: DECYZJA - URUCHOM Z DYSKU ---
    if (!needsDownload) {
        if (onlyDownload) {
            sender.send('test-status', `Test (v${version}) jest gotowy.`);
        } else {
            sender.send('test-status', `Uruchamianie z cache (v${version})...`);
            openTestWindow(entryFile);
        }
        activeDownloads.delete(testId); // Clean up
        return;
    }

    // --- KROK 3: POBIERANIE ---
    if (!fs.existsSync(testFolder)) {
        fs.mkdirSync(testFolder, { recursive: true });
    }

    sender.send('test-status', `Pobieranie paczki ZIP (v${version})...`);

    const file = fs.createWriteStream(zipPath);

    // Funkcja do obsługi przekierowań
    const downloadWithRedirect = (downloadUrl, maxRedirects = 5) => {
        if (maxRedirects <= 0) {
            sender.send('test-status', 'BŁĄD: Zbyt wiele przekierowań!');
            fs.unlink(zipPath, () => { });
            activeDownloads.delete(testId);
            return;
        }

        https.get(downloadUrl, (response) => {
            // Obsługa przekierowań (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    console.log(`Przekierowanie: ${response.statusCode} -> ${redirectUrl}`);
                    downloadWithRedirect(redirectUrl, maxRedirects - 1);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                sender.send('test-status', `Błąd serwera: ${response.statusCode}`);
                fs.unlink(zipPath, () => { });
                activeDownloads.delete(testId);
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'], 10);
            let receivedBytes = 0;
            let lastUpdate = 0;

            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                file.write(chunk);

                if (totalBytes) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    const now = Date.now();
                    // Throttle updates to every 100ms
                    if (now - lastUpdate > 100 || percent === 100) {
                        sender.send('download-progress', { test_id: testId, percent });
                        lastUpdate = now;
                    }
                }
            });

            response.on('end', () => {
                file.end(); // Important!

                // Wait for file stream to finish closing
                file.on('finish', async () => {
                    file.close();

                    // --- KROK 4: ROZPAKOWYWANIE ---
                    sender.send('test-status', 'Rozpakowywanie plików...');

                    try {
                        const zip = new AdmZip(zipPath);

                        // --- SECURITY CHECK: ZIP SLIP VULNERABILITY ---
                        const zipEntries = zip.getEntries();
                        for (const entry of zipEntries) {
                            const entryName = entry.entryName;
                            const targetPath = path.join(testFolder, entryName);

                            // Check if extracted path is still within the target folder
                            if (!targetPath.startsWith(testFolder)) {
                                throw new Error(`Malicious ZIP detected! File "${entryName}" attempts to traverse out of target directory.`);
                            }
                        }

                        zip.extractAllTo(testFolder, true); // Nadpisz

                        // Use async file operations (non-blocking)
                        await fs.promises.unlink(zipPath); // Usuń ZIP

                        // Aktualizacja meta
                        const metaData = { version: Number(version), lastUpdated: new Date().toISOString() };
                        await fs.promises.writeFile(metaPath, JSON.stringify(metaData));

                        // Szukamy pliku ponownie po rozpakowaniu
                        entryFile = findStartFile(testFolder);

                        // --- NEW EVENT FOR UI REFRESH ---
                        sender.send('test-installed', { test_id: testId, version: Number(version) });

                        if (!entryFile) {
                            sender.send('test-status', 'BŁĄD KRYTYCZNY: Brak index.html w paczce!');
                            activeDownloads.delete(testId);
                            return;
                        }

                        if (onlyDownload) {
                            sender.send('test-status', 'Pobrano i zainstalowano pomyślnie.');
                        } else {
                            sender.send('test-status', 'Gotowe. Uruchamianie...');
                            openTestWindow(entryFile);
                        }

                        // Success - cleanup
                        activeDownloads.delete(testId);

                    } catch (err) {
                        console.error("Błąd ZIP:", err);
                        sender.send('test-status', 'Błąd rozpakowywania archiwum!');
                        activeDownloads.delete(testId);
                    }
                });
            });

        }).on('error', (err) => {
            fs.unlink(zipPath, () => { });
            sender.send('test-status', `Błąd sieci: ${err.message}`);
            activeDownloads.delete(testId);
        });
    };

    // Rozpocznij pobieranie z obsługą przekierowań
    downloadWithRedirect(url);
});


// ==========================================================
// 2. SKANOWANIE LOKALNEJ BIBLIOTEKI
// ==========================================================

ipcMain.handle('get-local-versions', async (event) => {
    const userDataPath = app.getPath('userData');
    const testsDir = path.join(userDataPath, 'tests_library');
    const localVersions = {};

    if (!fs.existsSync(testsDir)) return {};

    try {
        const testFolders = fs.readdirSync(testsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        testFolders.forEach(testId => {
            const metaPath = path.join(testsDir, testId, 'meta.json');
            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf8');
                    const meta = JSON.parse(metaContent);
                    localVersions[testId] = meta.version;
                } catch (e) {
                    localVersions[testId] = 0;
                }
            } else {
                localVersions[testId] = 0;
            }
        });
    } catch (error) {
        console.error("Błąd skanowania:", error);
    }
    return localVersions;
});


// ==========================================================
// 3. USUWANIE TESTÓW
// ==========================================================

ipcMain.handle('delete-test', async (event, testId) => {
    // --- SECURITY CHECK: TEST ID VALIDATION ---
    if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
        console.error(`Blocked delete attempt for invalid testId: ${testId}`);
        return { success: false, error: "Nieprawidłowe ID testu" };
    }

    const userDataPath = app.getPath('userData');
    const testFolder = path.join(userDataPath, 'tests_library', testId);

    try {
        if (fs.existsSync(testFolder)) {
            fs.rmSync(testFolder, { recursive: true, force: true });
            return { success: true };
        } else {
            return { success: false, error: "Folder nie istnieje" };
        }
    } catch (error) {
        console.error("Błąd usuwania:", error);
        return { success: false, error: error.message };
    }
});


// ==========================================================
// 4. OKNO TESTOWE (PEŁNY EKRAN)
// ==========================================================

// --- SZYFROWANIE (Key Management) ---
const { safeStorage } = require('electron');

// Ścieżka do pliku z kluczem
const keyFilePath = path.join(app.getPath('userData'), 'master_key.enc');

function getOrGenerateMasterKey() {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("safeStorage is not available on this system!");
        }

        if (fs.existsSync(keyFilePath)) {
            // 1. Load existing
            const encryptedKey = fs.readFileSync(keyFilePath);
            const decryptedKey = safeStorage.decryptString(encryptedKey);
            console.log("Master Key loaded successfully.");
            return decryptedKey; // Hex string expected
        } else {
            // 2. Generate new
            const newKey = crypto.randomBytes(32).toString('hex'); // 32 bytes = 256 bits
            const encryptedKey = safeStorage.encryptString(newKey);
            fs.writeFileSync(keyFilePath, encryptedKey);
            console.log("New Master Key generated and secured.");
            return newKey;
        }
    } catch (e) {
        console.error("Encryption Key Error:", e);
        return null;
    }
}

ipcMain.handle('get-encryption-key', async () => {
    return getOrGenerateMasterKey();
});

function openTestWindow(htmlPath) {
    const testWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        parent: mainWindow,
        title: "Badanie w toku...",

        // --- PEŁNY EKRAN ---
        fullscreen: true,       // Odpala na cały ekran
        autoHideMenuBar: true,  // Ukrywa menu

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload_test.js')
        }
    });

    testWindow.loadFile(htmlPath);

    // Obsługa ESC (opcjonalna - pozwala wyjść z FullScreen)
    testWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && input.type === 'keyDown') {
            testWindow.setFullScreen(false);
        }
    });
}

ipcMain.on('test-finished', (event, results) => {
    const testWin = BrowserWindow.fromWebContents(event.sender);
    if (testWin) testWin.close();

    if (mainWindow) {
        mainWindow.webContents.send('test-results-forwarded', results);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

ipcMain.on('test-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});


// ==========================================================
// 5. ZAPIS LOKALNY Z HMAC
// ==========================================================

ipcMain.on('save-local-result', (event, dataToSave) => {
    const dialog = require('electron').dialog;

    // Użyj Master Key z safeStorage zamiast hardcodowanego klucza
    const masterKey = getOrGenerateMasterKey();
    if (!masterKey) {
        console.error('Could not get master key for HMAC!');
        event.sender.send('test-status', 'BŁĄD: Nie można wygenerować klucza podpisu!');
        return;
    }

    const hmac = crypto.createHmac('sha256', masterKey);
    hmac.update(JSON.stringify(dataToSave.wyniki));
    const signature = hmac.digest('hex');

    const finalFileContent = {
        meta: {
            app: "Nous",
            version: "2.0",
            signature: signature
        },
        data: dataToSave
    };

    dialog.showSaveDialog(mainWindow, {
        title: 'Zapisz wynik badania',
        defaultPath: `Wynik_${dataToSave.testId}_${Date.now()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    }).then(result => {
        if (!result.canceled) {
            try {
                fs.writeFileSync(result.filePath, JSON.stringify(finalFileContent, null, 2));
                event.sender.send('test-status', 'Wynik zapisany pomyślnie.');
            } catch (writeErr) {
                console.error("Save error:", writeErr);
                event.sender.send('test-status', 'BŁĄD: Nie udało się zapisać pliku!');
            }
        }
    }).catch(err => {
        console.error(err);
    });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ==========================================================
// 6. OBSŁUGA AKTUALIZACJI APLIKACJI (IPC)
// ==========================================================

// Sprawdź aktualizacje
ipcMain.on('check-app-update', () => {
    if (!app.isPackaged) {
        mainWindow.webContents.send('app-update-not-available', { version: app.getVersion() });
        return;
    }
    autoUpdater.checkForUpdates();
});

// Pobierz aktualizację
ipcMain.on('download-app-update', () => {
    autoUpdater.downloadUpdate();
});

// Zainstaluj i zrestartuj
ipcMain.on('install-app-update', () => {
    autoUpdater.quitAndInstall();
});

// Zwróć obecną wersję
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});


// --- ZDARZENIA AUTO-UPDATERA ---

autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('app-update-checking');
});

autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('app-update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('app-update-not-available', info);
});

autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('app-update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) mainWindow.webContents.send('app-download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('app-update-downloaded', info);
});