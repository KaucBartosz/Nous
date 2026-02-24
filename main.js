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

// Queue management for downloads
const downloadQueue = [];
let isDownloadingInProgress = false;
const activeDownloads = new Set();
let activeTestWindow = null;
let activePythonProcess = null;

function isTestRunning() {
    return !!activeTestWindow || !!activePythonProcess;
}

function processDownloadQueue() {
    if (isDownloadingInProgress || downloadQueue.length === 0) return;

    const task = downloadQueue.shift();
    isDownloadingInProgress = true;
    executeDownloadTask(task);
}

/**
 * Helper do znajdowania właściwego folderu danych na Linux (case-sensitivity)
 */
function getLinuxUserDataPath() {
    let userDataPath = app.getPath('userData');
    if (process.platform === 'linux') {
        const os = require('os');
        const candidates = [
            path.join(os.homedir(), '.config', 'nous'),
            path.join(os.homedir(), '.config', 'Nous')
        ];
        for (const cand of candidates) {
            if (fs.existsSync(path.join(cand, 'tests_library')) || fs.existsSync(path.join(cand, 'python_env'))) {
                return cand;
            }
        }
    }
    return userDataPath;
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
        width: 1280,
        height: 800,
        title: "Nous",
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('index.html');
}

// --- FUNKCJE POMOCNICZE: Szukanie plików w podfolderach ---
function findFileInSubfolders(folderPath, filename) {
    if (!fs.existsSync(folderPath)) return null;

    // 1. Sprawdź bezpośrednio
    const directPath = path.join(folderPath, filename);
    if (fs.existsSync(directPath)) return directPath;

    // 2. Sprawdź podfoldery (maksymalnie 1 poziom głębi - typowe dla ZIP z GitHub)
    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const subPath = path.join(folderPath, entry.name, filename);
                if (fs.existsSync(subPath)) return subPath;
            }
        }
    } catch (e) {
        console.error(`Błąd przeszukiwania folderu pod kątem ${filename}:`, e);
    }
    return null;
}

function findStartFile(folderPath) {
    return findFileInSubfolders(folderPath, 'index.html');
}

function findPythonFile(folderPath) {
    return findFileInSubfolders(folderPath, 'main.py');
}

// ==========================================================
// 1. OBSŁUGA POBIERANIA (ZIP) I URUCHAMIANIA
// ==========================================================

ipcMain.on('download-and-run', (event, taskData) => {
    const { testId, url, isLocalDev } = taskData;
    const sender = event.sender;

    // --- SECURITY CHECK: RATE LIMITING ---
    if (activeDownloads.has(testId)) {
        sender.send('test-status', 'Zadanie dla tego testu jest już w kolejce!');
        return;
    }

    // --- SECURITY CHECK: TEST ID VALIDATION ---
    if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
        sender.send('test-status', 'BŁĄD: Nieprawidłowe ID testu!');
        return;
    }

    // Skip URL validation for local dev tests
    if (!isLocalDev) {
        // --- SECURITY CHECK: DOMAIN & PROTOCOL ALLOWLIST ---
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:') {
                sender.send('test-status', 'BŁĄD: Tylko HTTPS!');
                return;
            }
            const allowedDomains = ['github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com'];
            if (!allowedDomains.some(d => parsedUrl.hostname.endsWith(d))) {
                sender.send('test-status', 'BŁĄD: Niedozwolona domena!');
                return;
            }
        } catch (e) {
            sender.send('test-status', 'BŁĄD: Nieprawidłowy URL!');
            return;
        }
    }

    // Add to queue
    activeDownloads.add(testId);
    downloadQueue.push({ ...taskData, sender });
    sender.send('test-status', 'Dodano do kolejki...');
    processDownloadQueue();
});

async function executeDownloadTask(task) {
    const { sender, url, testId, version, onlyDownload, hpmEnabled, trainingMode, testName, testDescription, isLocalDev } = task;

    const finishTask = () => {
        activeDownloads.delete(testId);
        isDownloadingInProgress = false;
        processDownloadQueue();
    };

    // Definicje ścieżek
    const userDataPath = getLinuxUserDataPath();
    const testsLibraryDir = path.join(userDataPath, 'tests_library');

    let testFolder = path.join(testsLibraryDir, testId);
    let entryFile = findStartFile(testFolder);

    const zipPath = path.join(testFolder, 'package.zip');
    const metaPath = path.join(testFolder, 'meta.json');

    // --- KROK 1: SPRAWDZANIE CACHE ---
    let needsDownload = !isLocalDev; // Local dev tests never need download

    if (!isLocalDev && fs.existsSync(testFolder) && fs.existsSync(metaPath) && entryFile) {
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
            if (isTestRunning()) {
                sender.send('test-status', 'Inny test w toku. Uruchomienie wstrzymane.');
            } else {
                sender.send('test-status', `Uruchamianie (v${version})...`);
                if (hpmEnabled) runPythonTestIfPossible(testFolder, sender, trainingMode);
                else openTestWindow(entryFile);
            }
        }
        finishTask();
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
            sender.send('test-status', 'BŁĄD: Za dużo przekierowań!');
            fs.unlink(zipPath, () => { });
            finishTask();
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
                sender.send('test-status', `Błąd HTTP: ${response.statusCode}`);
                fs.unlink(zipPath, () => { });
                finishTask();
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
                            sender.send('test-status', 'BŁĄD: Brak index.html!');
                            finishTask();
                            return;
                        }

                        if (onlyDownload) {
                            sender.send('test-status', 'Zainstalowano pomyślnie.');
                        } else {
                            if (isTestRunning()) {
                                sender.send('test-status', 'Pobrano. Uruchomienie wstrzymane - inny test w toku.');
                            } else {
                                sender.send('test-status', 'Uruchamianie...');
                                if (hpmEnabled) runPythonTestIfPossible(testFolder, sender, trainingMode);
                                else openTestWindow(entryFile);
                            }
                        }

                        finishTask();

                    } catch (err) {
                        console.error("Błąd ZIP:", err);
                        sender.send('test-status', `Błąd ZIP: ${err.message}`);
                        finishTask();
                    }
                });
            });

        }).on('error', (err) => {
            fs.unlink(zipPath, () => { });
            sender.send('test-status', `Błąd sieci: ${err.message}`);
            finishTask();
        });
    };

    downloadWithRedirect(url);
}


// ==========================================================
// 2. SKANOWANIE LOKALNEJ BIBLIOTEKI
// ==========================================================

ipcMain.handle('get-local-versions', async (event) => {
    let userDataPath = getLinuxUserDataPath();
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
            const hasPython = !!findPythonFile(testFolder);

            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf8');
                    const meta = JSON.parse(metaContent);
                    localVersions[testId] = {
                        version: meta.version,
                        hasPython: hasPython,
                        name: meta.name || '',
                        description: meta.description || '',
                        isLocalDev: false
                    };
                } catch (e) {
                    localVersions[testId] = { version: 0, hasPython: hasPython, isLocalDev: true };
                }
            } else {
                localVersions[testId] = { version: 0, hasPython: hasPython, isLocalDev: true };
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

    const userDataPath = getLinuxUserDataPath();
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

// Ścieżka do pliku z kluczem — lazy, żeby app.getPath() nie było
// wywoływane przed app.whenReady()
let _keyFilePath = null;
function getKeyFilePath() {
    if (!_keyFilePath) {
        _keyFilePath = path.join(getLinuxUserDataPath(), 'master_key.enc');
    }
    return _keyFilePath;
}

function getOrGenerateMasterKey() {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            throw new Error("safeStorage is not available on this system!");
        }

        if (fs.existsSync(getKeyFilePath())) {
            // 1. Load existing
            const encryptedKey = fs.readFileSync(getKeyFilePath());
            const decryptedKey = safeStorage.decryptString(encryptedKey);
            console.log("Master Key loaded successfully.");
            return decryptedKey; // Hex string expected
        } else {
            // 2. Generate new
            const newKey = crypto.randomBytes(32).toString('hex'); // 32 bytes = 256 bits
            const encryptedKey = safeStorage.encryptString(newKey);
            fs.writeFileSync(getKeyFilePath(), encryptedKey);
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

ipcMain.handle('is-test-running', async () => {
    return isTestRunning();
});

function openTestWindow(htmlPath) {
    if (isTestRunning()) return;

    activeTestWindow = new BrowserWindow({
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

    activeTestWindow.loadFile(htmlPath);

    activeTestWindow.on('closed', () => {
        activeTestWindow = null;
        if (mainWindow) mainWindow.webContents.send('test-process-stopped');
    });

    // Obsługa ESC (opcjonalna - pozwala wyjść z FullScreen)
    activeTestWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'Escape' && input.type === 'keyDown') {
            if (activeTestWindow) activeTestWindow.setFullScreen(false);
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
        // Używamy test_id (snake_case) jako primary, testId jako fallback
        defaultPath: `Wynik_${dataToSave.test_id || dataToSave.testId || 'wynik'}_${Date.now()}.json`,
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
                let csvContent = "\uFEFF"; // BOM
                const flat = {};
                flat['Data'] = new Date(res.timestamp || res.synced_at).toLocaleString();
                flat['Test ID'] = testId;
                flat['ID Badanego'] = subjectId;
                flat['Badacz ID'] = res.researcher_uid || 'unknown';

                // Dodaj dane metryczki (Demographics)
                const demographics = res.demographics || {};
                const demoData = demographics.data || demographics;
                if (demoData && typeof demoData === 'object') {
                    Object.keys(demoData).forEach(k => {
                        if (typeof demoData[k] !== 'object') {
                            flat[`Metryczka_${k}`] = demoData[k];
                        }
                    });
                }

                // Spłaszczanie wyników (wyniki/data)
                const resData = res.wyniki || res.data || {};
                const flatten = (obj, prefix = 'Wynik') => {
                    Object.keys(obj).forEach(k => {
                        const key = `${prefix}_${k}`;
                        if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
                            flatten(obj[k], key);
                        } else {
                            flat[key] = Array.isArray(obj[k]) ? JSON.stringify(obj[k]) : obj[k];
                        }
                    });
                };
                flatten(resData);

                const headers = Object.keys(flat);
                csvContent += headers.join(';') + "\r\n";
                csvContent += headers.map(h => {
                    let val = String(flat[h] === undefined ? '' : flat[h]);
                    if (val.includes(';') || val.includes('\n') || val.includes('"')) {
                        val = `"${val.replace(/"/g, '""')}"`;
                    }
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

app.on('will-quit', () => {
    if (activePythonProcess) {
        activePythonProcess.kill();
        activePythonProcess = null;
    }
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

// ==========================================================
// 8. HIGH PRECISION MODE (HPM) - ENGINE MANAGEMENT
// ==========================================================

const HPM_ENGINE_URLS = {
    // Windows
    'win32': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_win.zip',
    // macOS
    'darwin-x64': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_mac_x64.zip',
    'darwin-arm64': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_mac_arm64.zip',
    // Linux Debian/Ubuntu/Mint family
    'linux-x64-debian': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_linux_x64_debian.zip',
    'linux-arm64-debian': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_linux_x64_debian.zip', // fallback x64
    // Linux RHEL/Fedora/CentOS/Rocky family
    'linux-x64-rhel': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_linux_x64_rhel.zip',
    'linux-arm64-rhel': 'https://github.com/KaucBartosz/Nous/releases/download/hpm-precision-packs/python_env_linux_x64_rhel.zip'  // fallback x64
};

/**
 * Zwraca klucz platformy dla silnika HPM (np. 'win32', 'linux-x64-debian', 'darwin-arm64')
 */
function getHpmPlatformKey() {
    let platformKey = process.platform;
    if (process.platform !== 'win32') {
        const archKey = process.arch === 'arm64' ? 'arm64' : 'x64';
        if (process.platform === 'linux') {
            const distroFamily = getLinuxDistroFamily();
            platformKey = `linux-${archKey}-${distroFamily}`;
        } else {
            platformKey = `${process.platform}-${archKey}`;
        }
    }
    return platformKey;
}

/**
 * Pobiera metadane o wydaniu HPM z GitHub API.
 */
async function fetchLatestHpmMetadata() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: '/repos/KaucBartosz/Nous/releases/tags/hpm-precision-packs',
            headers: { 'User-Agent': 'Nous-Launcher' }
        };

        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
                    resolve(JSON.parse(data));
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

/**
 * Wykrywa rodzinę dystrybucji Linux na podstawie /etc/os-release.
 * @returns {'rhel'|'debian'} Rodzina dystrybucji.
 */
function getLinuxDistroFamily() {
    try {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');

        // Wyciągnij pola ID i ID_LIKE
        const getId = (key) => (osRelease.match(new RegExp(`^${key}=(.*)`, 'm')) || [])[1] || '';
        const id = getId('ID').replace(/"/g, '').toLowerCase().trim();
        const idLike = getId('ID_LIKE').replace(/"/g, '').toLowerCase().trim();
        const combined = `${id} ${idLike}`;

        // Rozpoznane dystrybucje rodziny RHEL
        const rhelFamily = ['rhel', 'fedora', 'centos', 'rocky', 'almalinux', 'oracle', 'scientific'];
        if (rhelFamily.some(f => combined.includes(f))) {
            console.log(`[HPM] Wykryto dystrybucję RHEL/Fedora (ID="${id}", ID_LIKE="${idLike}")`);
            return 'rhel';
        }

        console.log(`[HPM] Wykryto dystrybucję Debian/Ubuntu (ID="${id}", ID_LIKE="${idLike}")`);
        return 'debian';
    } catch (e) {
        console.warn('[HPM] Nie można odczytać /etc/os-release, zakładam Debian:', e.message);
        return 'debian'; // bezpieczny fallback
    }
}

function getPythonPath() {
    const userDataPath = getLinuxUserDataPath();
    const hpmDir = path.join(userDataPath, 'python_env');

    if (process.platform === 'win32') {
        const rootPath = path.join(hpmDir, 'python.exe');
        const nestedPath = path.join(hpmDir, 'python_env', 'python.exe');
        return fs.existsSync(nestedPath) ? nestedPath : rootPath;
    } else if (process.platform === 'linux') {
        // Na Linuxie preferuj wrapper skrypt który ustawia LD_LIBRARY_PATH
        // dla bundlowanych bibliotek systemowych (SDL2, OpenGL, itp.)
        const wrapperPath = path.join(hpmDir, 'bin', 'python3_nous');
        const wrapperNestedPath = path.join(hpmDir, 'python_env', 'bin', 'python3_nous');
        const rootPath = path.join(hpmDir, 'bin', 'python3');
        const nestedPath = path.join(hpmDir, 'python_env', 'bin', 'python3');

        if (fs.existsSync(wrapperNestedPath)) return wrapperNestedPath;
        if (fs.existsSync(wrapperPath)) return wrapperPath;
        if (fs.existsSync(nestedPath)) return nestedPath;
        return rootPath;
    } else {
        const rootPath = path.join(hpmDir, 'bin', 'python3');
        const nestedPath = path.join(hpmDir, 'python_env', 'bin', 'python3');
        return fs.existsSync(nestedPath) ? nestedPath : rootPath;
    }
}

ipcMain.handle('check-hpm-update', async () => {
    try {
        const userDataPath = getLinuxUserDataPath();
        const manifestPath = path.join(userDataPath, 'hpm_manifest.json');

        if (!fs.existsSync(manifestPath)) return { hasUpdate: false, engineExists: false };

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const metadata = await fetchLatestHpmMetadata();
        const platformKey = getHpmPlatformKey();
        const expectedUrl = HPM_ENGINE_URLS[platformKey];
        const fileName = path.basename(expectedUrl);

        const asset = metadata.assets.find(a => a.name === fileName);
        if (!asset) return { hasUpdate: false, error: 'Asset not found in release' };

        const latestDate = new Date(asset.updated_at);
        const currentDate = new Date(manifest.version_date);

        return {
            hasUpdate: latestDate > currentDate,
            latestDate: latestDate.toISOString(),
            currentDate: currentDate.toISOString(),
            engineExists: true
        };
    } catch (e) {
        console.error("[HPM Update Check] Error:", e);
        return { hasUpdate: false, error: e.message };
    }
});

ipcMain.handle('get-hpm-status', async () => {
    const pythonPath = getPythonPath();
    return fs.existsSync(pythonPath);
});

ipcMain.handle('get-linux-distro', async () => {
    if (process.platform !== 'linux') return { family: 'other', id: '', idLike: '' };
    const family = getLinuxDistroFamily();
    try {
        const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
        const getId = (key) => (osRelease.match(new RegExp(`^${key}=(.*)`, 'm')) || [])[1] || '';
        return {
            family,
            id: getId('ID').replace(/"/g, '').trim(),
            idLike: getId('ID_LIKE').replace(/"/g, '').trim()
        };
    } catch (e) {
        return { family, id: 'linux', idLike: '' };
    }
});


ipcMain.on('download-hpm-engine', async (event) => {
    const sender = event.sender;

    const userDataPath = getLinuxUserDataPath();
    const hpmDir = path.join(userDataPath, 'python_env');
    const zipPath = path.join(userDataPath, 'hpm_engine.zip');

    let platformKey = getHpmPlatformKey();

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
                        // Czyścimy folder przed rozpakowaniem, aby uniknąć konfliktów starych bibliotek
                        if (fs.existsSync(hpmDir)) {
                            fs.rmSync(hpmDir, { recursive: true, force: true });
                        }
                        fs.mkdirSync(hpmDir, { recursive: true });

                        // AdmZip extractAllTo(path, overwrite)
                        zip.extractAllTo(hpmDir, true);
                        try { fs.unlinkSync(zipPath); } catch (e) { }

                        // Fix for Mac/Linux: AdmZip strips executable permissions
                        if (process.platform !== 'win32') {
                            try {
                                const pyPath = getPythonPath();
                                if (fs.existsSync(pyPath)) {
                                    const binDir = path.dirname(pyPath);
                                    if (fs.existsSync(binDir)) {
                                        fs.readdirSync(binDir).forEach(file => {
                                            const filePath = path.join(binDir, file);
                                            try { fs.chmodSync(filePath, 0o755); } catch (e) { }
                                        });
                                    }
                                }
                            } catch (chmodErr) {
                                console.error("Chmod error:", chmodErr);
                            }
                        }

                        // Zapisz manifest z datą pobrania z GitHub
                        fetchLatestHpmMetadata().then(metadata => {
                            const expectedUrl = HPM_ENGINE_URLS[platformKey];
                            const fileName = path.basename(expectedUrl);
                            const asset = metadata.assets.find(a => a.name === fileName);
                            const versionDate = asset ? asset.updated_at : new Date().toISOString();

                            const manifest = {
                                version_date: versionDate,
                                platform: platformKey,
                                installed_at: new Date().toISOString()
                            };
                            fs.writeFileSync(path.join(userDataPath, 'hpm_manifest.json'), JSON.stringify(manifest, null, 2));
                            console.log(`[HPM] Manifest created successfully for ${platformKey} (v: ${versionDate})`);
                        }).catch(err => {
                            console.warn("[HPM] Could not fetch metadata for manifest, using current time:", err.message);
                            const manifest = {
                                version_date: new Date().toISOString(),
                                platform: platformKey,
                                installed_at: new Date().toISOString()
                            };
                            fs.writeFileSync(path.join(userDataPath, 'hpm_manifest.json'), JSON.stringify(manifest, null, 2));
                        }).finally(() => {
                            sender.send('hpm-installed', true);
                        });
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
    const mainPyPath = findPythonFile(testFolder);

    // 1. Sprawdź czy silnik w ogóle istnieje
    if (!fs.existsSync(pythonPath)) {
        sender.send('test-status', 'Silnik HPM brakujący. Uruchamiam wersję JS...');
        const entryFile = findStartFile(testFolder);
        if (entryFile) openTestWindow(entryFile);
        return;
    }

    // Fix permissions on Mac/Linux if they were lost
    if (process.platform !== 'win32') {
        try { fs.chmodSync(pythonPath, 0o755); } catch (e) { }
    }

    // 2. Sprawdź czy test wspiera Pythona
    if (!mainPyPath) {
        // Cichy fallback - nie straszymy użytkownika
        const entryFile = findStartFile(testFolder);
        if (entryFile) openTestWindow(entryFile);
        return;
    }

    sender.send('test-status', 'Uruchamianie natywne (HPM)...');
    if (isTestRunning()) {
        sender.send('test-status', 'BŁĄD: Test jest już uruchomiony!');
        return;
    }

    const workingDir = path.dirname(mainPyPath);

    activePythonProcess = spawn(pythonPath, [mainPyPath], {
        cwd: workingDir,
        env: {
            ...process.env,
            // Flagi launchera
            NOUS_LAUNCHER: '1',
            NOUS_TRAINING: trainingMode ? '1' : '0',
            // Ustaw PYTHONHOME na katalog standalone Pythona
            // aby uniknąć konfliktu z systemowym Pythonem lub Pythonem Electrona
            PYTHONHOME: path.dirname(path.dirname(pythonPath)), // np. .../python_env
            // Wyczyść zmienne które Electron ustawia i które mogą kolidować
            // ze standalone Python (szczególnie groźne na macOS)
            PYTHONPATH: '',
            DYLD_INSERT_LIBRARIES: '', // macOS: Electron wstrzykuje własne lib
            DYLD_LIBRARY_PATH: '',     // macOS: może wskazywać na biblioteki Electrona
            ELECTRON_RUN_AS_NODE: '',  // zapobiegaj uruchamianiu jako Node.js
        }
    });

    activePythonProcess.stdout.on('data', (data) => {
        console.log(`Python STDOUT: ${data.toString()}`);
    });

    activePythonProcess.stderr.on('data', (data) => {
        console.error(`Python STDERR: ${data.toString()}`);
    });

    activePythonProcess.on('error', (err) => {
        console.error("Python Error:", err);
        sender.send('test-status', `BŁĄD Pythona: ${err.message}`);
    });

    activePythonProcess.on('close', (code) => {
        console.log(`Python process closed with code ${code}`);
        activePythonProcess = null;
        if (mainWindow) mainWindow.webContents.send('test-process-stopped');
        // Po zamknięciu Pythona sprawdzamy czy wygenerował wyniki (np. results.json)
        const resultsPath = path.join(workingDir, 'results.json');
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
