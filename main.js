const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');

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

ipcMain.on('download-and-run', (event, { url, testId, version, onlyDownload, hpmEnabled, trainingMode, testName, testDescription }) => {
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

        const allowedDomains = [
            'github.com',
            'raw.githubusercontent.com',
            'www.github.com',
            'www.raw.githubusercontent.com',
            'objects.githubusercontent.com' // Dodane dla przekierowań pobierania
        ];
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

            if (hpmEnabled) {
                runPythonTestIfPossible(testFolder, sender, trainingMode);
            } else {
                openTestWindow(entryFile);
            }
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
                        const metaData = {
                            version: Number(version),
                            lastUpdated: new Date().toISOString(),
                            name: testName || '',
                            description: testDescription || ''
                        };
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

                            // Wybór silnika (JS vs Python)
                            if (hpmEnabled) {
                                runPythonTestIfPossible(testFolder, sender, trainingMode);
                            } else {
                                openTestWindow(entryFile);
                            }
                        }

                        // Success - cleanup
                        activeDownloads.delete(testId);

                    } catch (err) {
                        console.error("Błąd ZIP:", err);
                        sender.send('test-status', `Błąd rozpakowywania: ${err.message}`);
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
    let userDataPath = app.getPath('userData');
    let testsDir = path.join(userDataPath, 'tests_library');

    // Linux-specific fallback: Check common paths as Electron behavior on Linux 
    // can vary depending on whether it's running via AppImage, generic electron, or local build.
    if (process.platform === 'linux' && !fs.existsSync(testsDir)) {
        const os = require('os');
        const altPaths = [
            path.join(os.homedir(), '.config', 'nous', 'tests_library'),
            path.join(os.homedir(), '.config', 'Nous', 'tests_library'),
            path.join(os.homedir(), '.config', 'nous-launcher', 'tests_library'),
            path.join(os.homedir(), '.config', 'Electron', 'tests_library'),
            path.join(os.homedir(), '.config', 'electron', 'tests_library'),
            path.join(__dirname, 'tests_library') // Check current directory as well
        ];

        for (const altPath of altPaths) {
            if (fs.existsSync(altPath)) {
                console.log(`Found tests_library in alternative path: ${altPath}`);
                testsDir = altPath;
                break;
            }
        }
    }

    const localVersions = {};
    // Store the path we used for debugging in a special key
    localVersions.__scannedDir = testsDir;

    if (!fs.existsSync(testsDir)) {
        console.log(`Tests directory not found at: ${testsDir}`);
        return localVersions; // Still return with __scannedDir
    }

    try {
        const testFolders = fs.readdirSync(testsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        testFolders.forEach(testId => {
            const testFolder = path.join(testsDir, testId);
            const metaPath = path.join(testFolder, 'meta.json');
            const hasPython = fs.existsSync(path.join(testFolder, 'main.py'));

            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf8');
                    const meta = JSON.parse(metaContent);
                    localVersions[testId] = {
                        version: meta.version,
                        hasPython: hasPython,
                        name: meta.name || '',
                        description: meta.description || ''
                    };
                } catch (e) {
                    localVersions[testId] = { version: 0, hasPython: hasPython };
                }
            } else {
                localVersions[testId] = { version: 0, hasPython: hasPython };
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
                // We'll receive pre-formatted CSV content or format it here.
                // To keep main.js clean, let's assume the renderer sends the content 
                // but that might be heavy for IPC. 
                // Better: Renderer sends raw data, we format here.

                let csvContent = "\uFEFF"; // BOM
                const flat = {};
                flat['Data'] = new Date(res.timestamp || res.synced_at).toLocaleString();
                flat['Test ID'] = testId;
                flat['ID Badanego'] = subjectId;

                const resData = res.wyniki || res.data || {};
                // Simple flattening for CSV
                Object.keys(resData).forEach(k => {
                    if (typeof resData[k] === 'object') {
                        flat[k] = JSON.stringify(resData[k]);
                    } else {
                        flat[k] = resData[k];
                    }
                });

                const headers = Object.keys(flat);
                csvContent += headers.join(';') + "\r\n";
                csvContent += headers.map(h => {
                    let val = String(flat[h]);
                    if (val.includes(';') || val.includes('\n')) val = `"${val.replace(/"/g, '""')}"`;
                    return val;
                }).join(';') + "\r\n";

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


// ==========================================================
// 7. IMPORT / EKSPORT SZABLONÓW (IPC)
// ==========================================================

ipcMain.handle('export-template', async (event, templateData) => {
    const dialog = require('electron').dialog;

    // Sanity check name
    const safeName = (templateData.name || 'szablon').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // Structure to save
    const fileContent = {
        meta: {
            app: "Nous",
            type: "demographics_template",
            version: "1.0",
            exportedAt: new Date().toISOString()
        },
        template: templateData
    };

    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Eksportuj Szablon Metryczki',
        defaultPath: `szablon_${safeName}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(fileContent, null, 2));
            return { success: true };
        } catch (e) {
            console.error("Export template error:", e);
            return { success: false, error: e.message };
        }
    }
    return { success: false, cancelled: true };
});

ipcMain.handle('import-template', async (event) => {
    const dialog = require('electron').dialog;

    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Importuj Szablon Metryczki',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (filePaths && filePaths.length > 0) {
        try {
            const content = fs.readFileSync(filePaths[0], 'utf8');
            const json = JSON.parse(content);

            // Validation basics
            if (!json.template || !json.template.fields) {
                // Try direct template object fallback (if user saved raw JSON manually)
                if (json.name && json.fields) {
                    return { success: true, data: json };
                }
                throw new Error("Nieprawidłowy format pliku (brak pola template lub fields).");
            }

            return { success: true, data: json.template };
        } catch (e) {
            console.error("Import template error:", e);
            return { success: false, error: e.message };
        }
    }
    return { success: false, cancelled: true };
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// ==========================================================
// 8. HIGH PRECISION MODE (HPM) - ENGINE MANAGEMENT
// ==========================================================

const HPM_ENGINE_URLS = {
    'win32': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_win.zip',
    'darwin-x64': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_mac_x64.zip',
    'darwin-arm64': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_mac_arm64.zip'
};

function getPythonPath() {
    let userDataPath = app.getPath('userData');

    // Linux case-sensitivity parity: check both 'nous' and 'Nous'
    if (process.platform === 'linux') {
        const os = require('os');
        const nousLower = path.join(os.homedir(), '.config', 'nous');
        const nousUpper = path.join(os.homedir(), '.config', 'Nous');

        if (fs.existsSync(path.join(nousLower, 'python_env'))) {
            userDataPath = nousLower;
        } else if (fs.existsSync(path.join(nousUpper, 'python_env'))) {
            userDataPath = nousUpper;
        }
    }

    const hpmDir = path.join(userDataPath, 'python_env');

    if (process.platform === 'win32') {
        const rootPath = path.join(hpmDir, 'python.exe');
        const nestedPath = path.join(hpmDir, 'python_env', 'python.exe');
        return fs.existsSync(nestedPath) ? nestedPath : rootPath;
    } else {
        return path.join(hpmDir, 'bin', 'python3');
    }
}

ipcMain.handle('get-hpm-status', async () => {
    const pythonPath = getPythonPath();
    return fs.existsSync(pythonPath);
});

ipcMain.on('download-hpm-engine', async (event) => {
    const sender = event.sender;

    // Check if already exists to prevent redundant downloads
    const pythonPath = getPythonPath();
    if (fs.existsSync(pythonPath)) {
        console.log("HPM Engine already exists, skipping download.");
        sender.send('hpm-installed', true);
        return;
    }

    const userDataPath = app.getPath('userData');
    const hpmDir = path.join(userDataPath, 'python_env');
    const zipPath = path.join(userDataPath, 'hpm_engine.zip');

    let platformKey = process.platform;
    if (process.platform !== 'win32') {
        platformKey = `${process.platform}-${process.arch}`;
    }

    const initialUrl = HPM_ENGINE_URLS[platformKey];
    if (!initialUrl) {
        console.error("Unsupported platform/arch for HPM:", platformKey);
        sender.send('hpm-installed', false);
        return;
    }

    if (!fs.existsSync(hpmDir)) {
        fs.mkdirSync(hpmDir, { recursive: true });
    }

    // Funkcja do pobierania z obsługą przekierowań (GitHub releases!)
    const downloadHpmWithRedirect = (currentUrl, redirects = 5) => {
        if (redirects === 0) {
            console.error("Too many redirects for HPM download");
            sender.send('hpm-installed', false);
            return;
        }

        https.get(currentUrl, (response) => {
            // Obsługa przekierowań (301, 302, 303, 307, 308)
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                const redirectUrl = response.headers.location;
                if (redirectUrl) {
                    downloadHpmWithRedirect(redirectUrl, redirects - 1);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                console.error(`HPM Download failed with status: ${response.statusCode}`);
                sender.send('hpm-installed', false);
                return;
            }

            const file = fs.createWriteStream(zipPath);
            const totalBytes = parseInt(response.headers['content-length'], 10);
            let receivedBytes = 0;

            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                file.write(chunk);
                if (totalBytes) {
                    const percent = Math.round((receivedBytes / totalBytes) * 100);
                    sender.send('hpm-download-progress', percent);
                }
            });

            response.on('end', () => {
                file.end();
                file.on('finish', () => {
                    try {
                        const zip = new AdmZip(zipPath);
                        // Folder nadrzędny 'python_env' już istnieje (hpmDir),
                        // AdmZip extractAllTo(path, overwrite)
                        zip.extractAllTo(hpmDir, true);
                        try { fs.unlinkSync(zipPath); } catch (e) { }
                        sender.send('hpm-installed', true);
                    } catch (e) {
                        console.error("HPM Engine Extract Error:", e);
                        sender.send('hpm-installed', false);
                    }
                });
            });
        }).on('error', (err) => {
            console.error("HPM Network Error:", err);
            sender.send('hpm-installed', false);
        });
    };

    downloadHpmWithRedirect(initialUrl);
});

function runPythonTestIfPossible(testFolder, sender, trainingMode = false) {
    const pythonPath = getPythonPath();
    const mainPyPath = path.join(testFolder, 'main.py');

    // 1. Sprawdź czy silnik w ogóle istnieje
    if (!fs.existsSync(pythonPath)) {
        sender.send('test-status', 'Silnik HPM brakujący. Uruchamiam wersję JS...');
        const entryFile = findStartFile(testFolder);
        if (entryFile) openTestWindow(entryFile);
        return;
    }

    // 2. Sprawdź czy test wspiera Pythona
    if (!fs.existsSync(mainPyPath)) {
        // Cichy fallback - nie straszymy użytkownika
        const entryFile = findStartFile(testFolder);
        if (entryFile) openTestWindow(entryFile);
        return;
    }

    sender.send('test-status', 'Uruchamianie natywne (HPM)...');

    const pythonProcess = spawn(pythonPath, [mainPyPath], {
        cwd: testFolder,
        env: {
            ...process.env,
            NOUS_LAUNCHER: '1',
            NOUS_TRAINING: trainingMode ? '1' : '0'
        }
    });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python STDOUT: ${data.toString()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python STDERR: ${data.toString()}`);
    });

    pythonProcess.on('error', (err) => {
        console.error("Python Error:", err);
        sender.send('test-status', `Błąd Pythona: ${err.message}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process closed with code ${code}`);
        // Po zamknięciu Pythona sprawdzamy czy wygenerował wyniki (np. results.json)
        const resultsPath = path.join(testFolder, 'results.json');
        if (fs.existsSync(resultsPath)) {
            try {
                const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
                results.__hpm_context = true; // Flaga dla launchera
                sender.send('test-results-forwarded', results);
            } catch (e) {
                console.error("Error reading Python results:", e);
            }
        }
    });
}
