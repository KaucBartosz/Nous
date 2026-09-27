const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
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

function isTestRunning() {
    return !!activeTestWindow;
}

function processDownloadQueue() {
    if (isDownloadingInProgress || downloadQueue.length === 0) return;

    const task = downloadQueue.shift();
    isDownloadingInProgress = true;
    executeDownloadTask(task);
}

/**
 * Helper do znajdowania właściwego folderu danych na wszystkich platformach
 */
function getUserDataPath() {
    const userDataPath = app.getPath('userData');

    // macOS: ~/Library/Application Support/Nous
    if (process.platform === 'darwin') {
        return path.join(app.getPath('home'), 'Library', 'Application Support', 'Nous');
    }

    // Linux: ~/.config/nous (nazwa z package.json:name; brak setName).
    // Windows: domyślna ścieżka Electrona.
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

// --- FUNKCJE POMOCNICZE: Szukanie plików w podfolderach ---
function findFileInSubfolders(folderPath, filename) {
    if (!fs.existsSync(folderPath)) return null;

    // 1. Sprawdź bezpośrednio
    const directPath = path.join(folderPath, filename);
    if (fs.existsSync(directPath)) return directPath;

    // 2. Sprawdź podfoldery (maksymalnie 1 poziom głębi - częste przy pobieraniu z GitHub)
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
            // --- SECURITY CHECK: OWNER ALLOWLIST ---
            // Dozwolone są wyłącznie oficjalne repozytorium BBTP.
            // objects.githubusercontent.com to CDN GitHub Releases – nie ma tam ścieżki /owner/.
            const allowedOwner = 'KaucBartosz';
            const cdnDomain = 'objects.githubusercontent.com';
            const allowedRepoDomains = ['github.com', 'raw.githubusercontent.com'];

            if (parsedUrl.hostname === cdnDomain) {
                // CDN - dozwolony bez walidacji ścieżki (hasze URL)
            } else if (allowedRepoDomains.some(d => parsedUrl.hostname.endsWith(d))) {
                // Sprawdź, czy ścieżka zaczyna się od /KaucBartosz/
                if (!parsedUrl.pathname.startsWith(`/${allowedOwner}/`)) {
                    sender.send('test-status', `BŁĄD: Dozwolone są wyłącznie repozytoria ${allowedOwner}!`);
                    return;
                }
            } else {
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

    // TODO/Do zrobienia: usunąć "onlyDownload" gdyż jest to teraz domyślne ustawienie (nie potrzebne ify itd.)
    // Uwaga: ładunek 'download-and-run' może nadal zawierać trainingMode (używane po stronie renderera); main go ignoruje (JS-only).
    const { sender, url, testId, version, onlyDownload, testName, testDescription, isLocalDev } = task;

    const finishTask = () => {
        activeDownloads.delete(testId);
        isDownloadingInProgress = false;
        processDownloadQueue();
    };

    // Definicje ścieżek
    const userDataPath = getUserDataPath();
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
                openTestWindow(entryFile);
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
            // 404 itd. wyrzuci błąd
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

                // Koniec pracy na pliku -> próbujemy rozpakować zip
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

                        // Info przez IPC aby odświeżyć liste testów
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
                                openTestWindow(entryFile);
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

    let finalUrl = url;
    if (finalUrl.includes('github.com') || finalUrl.includes('githubusercontent.com')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
    }
    downloadWithRedirect(finalUrl);
}


// ==========================================================
// 2. SKANOWANIE LOKALNEJ BIBLIOTEKI
// ==========================================================

ipcMain.handle('get-local-versions', async (event) => {
    const userDataPath = getUserDataPath();
    const testsDir = path.join(userDataPath, 'tests_library');

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

            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf8');
                    const meta = JSON.parse(metaContent);
                    localVersions[testId] = {
                        version: meta.version,
                        name: meta.name || '',
                        description: meta.description || '',
                        isLocalDev: false
                    };
                } catch (e) {
                    localVersions[testId] = { version: 0, isLocalDev: true };
                }
            } else {
                localVersions[testId] = { version: 0, isLocalDev: true };
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

    const userDataPath = getUserDataPath();
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
        _keyFilePath = path.join(getUserDataPath(), 'master_key.enc');
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

// --- E2E KEY STORAGE (CLOUD MAC KEYS) ---
let _e2eKeyFilePath = null;
function getE2EKeyFilePath() {
    if (!_e2eKeyFilePath) {
        _e2eKeyFilePath = path.join(getUserDataPath(), 'e2e_key.enc');
    }
    return _e2eKeyFilePath;
}

ipcMain.handle('set-e2e-key', async (event, hexKey) => {
    try {
        if (!safeStorage.isEncryptionAvailable()) return false;
        const encryptedKey = safeStorage.encryptString(hexKey);
        fs.writeFileSync(getE2EKeyFilePath(), encryptedKey);
        console.log("E2E Key securely written to disk via safeStorage.");
        return true;
    } catch (e) {
        console.error("Set E2E Key Error:", e);
        return false;
    }
});

ipcMain.handle('get-e2e-key', async () => {
    try {
        if (!safeStorage.isEncryptionAvailable()) return null;
        if (fs.existsSync(getE2EKeyFilePath())) {
            const encryptedKey = fs.readFileSync(getE2EKeyFilePath());
            console.log("E2E Key loaded from safeStorage.");
            return safeStorage.decryptString(encryptedKey);
        }
    } catch (e) {
        console.error("Get E2E Key Error:", e);
        return null; // Corrupted or unreadable
    }
    return null;
});

ipcMain.handle('clear-e2e-key', async () => {
    try {
        if (fs.existsSync(getE2EKeyFilePath())) {
            fs.unlinkSync(getE2EKeyFilePath());
            console.log("E2E Key cleared from safeStorage.");
        }
        return true;
    } catch (e) {
        console.error("Clear E2E Key Error:", e);
        return false;
    }
});

ipcMain.handle('is-test-running', async () => {
    return isTestRunning();
});

function openTestWindow(htmlPath) {
    if (isTestRunning()) return;

    const isLinux = process.platform === 'linux';

    // Na Linuksie (szczególnie Cinnamon/Mint):
    // - parent blokuje fullscreen w niektórych WM
    // - fullscreen w konstruktorze jest ignorowany przez Cinnamona
    // - okno musi być najpierw zmapowane (widoczne), zanim WM zaakceptuje fullscreen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    activeTestWindow = new BrowserWindow({
        width: isLinux ? width : 1024,
        height: isLinux ? height : 768,
        x: isLinux ? 0 : undefined,
        y: isLinux ? 0 : undefined,
        show: !isLinux,              // Na Linuksie: ukryj, pokażemy ręcznie
        parent: isLinux ? undefined : mainWindow,  // Na Linuksie: bez parent (Cinnamon blokuje FS dla child windows)
        title: "Badanie w toku...",

        // --- PEŁNY EKRAN ---
        fullscreen: !isLinux,        // Na Linuksie nie ustawiamy w konstruktorze
        fullscreenable: true,
        autoHideMenuBar: true,

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false,
            preload: path.join(__dirname, 'preload_test.js')
        }
    });

    if (isLinux) {
        // Linux/Cinnamon: pokaż okno → poczekaj aż WM je zmapuje → dopiero wtedy fullscreen
        activeTestWindow.once('ready-to-show', () => {
            activeTestWindow.show();
            activeTestWindow.maximize();

            setTimeout(() => {
                if (activeTestWindow && !activeTestWindow.isDestroyed()) {
                    activeTestWindow.setFullScreen(true);

                    // Fallback: jeśli po kolejnych 500ms nadal nie jest fullscreen, zostaje zmaksymalizowane
                    setTimeout(() => {
                        if (activeTestWindow && !activeTestWindow.isDestroyed() && !activeTestWindow.isFullScreen()) {
                            console.log('[FullScreen] Natywny fullscreen nie zadziałał — fallback: maximize');
                            activeTestWindow.maximize();
                        }
                    }, 500);
                }
            }, 500);
        });
    }

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
