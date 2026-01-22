// main.js - Wersja Finalna (ZIP Support)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const AdmZip = require('adm-zip'); // Biblioteka do rozpakowywania

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "PsychoLauncher",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

// ==========================================================
// 1. OBSŁUGA POBIERANIA (ZIP) I URUCHAMIANIA
// ==========================================================

ipcMain.on('download-and-run', (event, { url, testId, version, onlyDownload }) => {
    const sender = event.sender;
    
    // Definicje ścieżek
    const userDataPath = app.getPath('userData');
    const testsDir = path.join(userDataPath, 'tests_library');
    const testFolder = path.join(testsDir, testId);
    
    // Pliki wewnątrz folderu testu
    const zipPath = path.join(testFolder, 'package.zip');   // Tymczasowy plik ZIP
    const metaPath = path.join(testFolder, 'meta.json');    // Plik wersji
    const entryFile = path.join(testFolder, 'index.html');  // Plik startowy testu

    // --- KROK 1: SPRAWDZANIE CACHE ---
    let needsDownload = true;

    // Sprawdzamy czy folder istnieje, czy jest plik startowy i czy wersja się zgadza
    if (fs.existsSync(testFolder) && fs.existsSync(entryFile) && fs.existsSync(metaPath)) {
        try {
            const localMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            // Jeśli lokalna wersja jest >= wersji z chmury, nie pobieramy
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
            sender.send('test-status', `Test (v${version}) jest już pobrany i gotowy.`);
        } else {
            sender.send('test-status', `Uruchamianie z pamięci podręcznej (v${version})...`);
            openTestWindow(entryFile);
        }
        return; // Kończymy, nie pobieramy
    }

    // --- KROK 3: POBIERANIE (SCENARIUSZ UPDATE) ---
    
    // Upewnij się, że folder istnieje
    if (!fs.existsSync(testFolder)) {
        fs.mkdirSync(testFolder, { recursive: true });
    }

    sender.send('test-status', `Pobieranie paczki ZIP (v${version})...`);
    
    const file = fs.createWriteStream(zipPath);
    
    https.get(url, (response) => {
        // Obsługa błędów HTTP (np. 404)
        if (response.statusCode !== 200 && response.statusCode !== 302) {
            sender.send('test-status', `Błąd serwera: ${response.statusCode}`);
            fs.unlink(zipPath, () => {}); // Usuń pusty plik
            return;
        }

        response.pipe(file);

        file.on('finish', () => {
            file.close();
            
            // --- KROK 4: ROZPAKOWYWANIE ---
            sender.send('test-status', 'Rozpakowywanie plików...');
            
            try {
                const zip = new AdmZip(zipPath);
                zip.extractAllTo(testFolder, true); // true = nadpisz istniejące pliki
                
                // Usuwamy plik ZIP po rozpakowaniu, żeby nie zajmował miejsca
                fs.unlinkSync(zipPath);

                // Aktualizujemy plik meta.json nową wersją
                const metaData = { 
                    version: Number(version), 
                    lastUpdated: new Date().toISOString() 
                };
                fs.writeFileSync(metaPath, JSON.stringify(metaData));

                // Sukces!
                if (onlyDownload) {
                    sender.send('test-status', 'Pobrano i zainstalowano pomyślnie.');
                } else {
                    sender.send('test-status', 'Gotowe. Uruchamianie...');
                    openTestWindow(entryFile);
                }

            } catch (err) {
                console.error("Błąd ZIP:", err);
                sender.send('test-status', 'Błąd rozpakowywania archiwum!');
                // Opcjonalnie: usuń uszkodzony folder
            }
        });
    }).on('error', (err) => {
        fs.unlink(zipPath, () => {}); // Sprzątanie
        sender.send('test-status', `Błąd sieci: ${err.message}`);
    });
});


// ==========================================================
// 2. SKANOWANIE LOKALNEJ BIBLIOTEKI (Dla zakładki Aktualizacje)
// ==========================================================

ipcMain.handle('get-local-versions', async (event) => {
    const userDataPath = app.getPath('userData');
    const testsDir = path.join(userDataPath, 'tests_library');
    const localVersions = {};

    if (!fs.existsSync(testsDir)) return {}; // Brak folderu = brak testów

    try {
        // Pobierz listę folderów (każdy folder to ID testu)
        const testFolders = fs.readdirSync(testsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        // Sprawdź meta.json w każdym folderze
        testFolders.forEach(testId => {
            const metaPath = path.join(testsDir, testId, 'meta.json');
            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf8');
                    const meta = JSON.parse(metaContent);
                    localVersions[testId] = meta.version;
                } catch (e) {
                    localVersions[testId] = 0; // Plik uszkodzony
                }
            } else {
                localVersions[testId] = 0; // Brak wersji
            }
        });
    } catch (error) {
        console.error("Błąd skanowania:", error);
    }
    return localVersions; // Zwraca np. { "test_reakcji": 2, "test_pamieci": 5 }
});


// ==========================================================
// 3. USUWANIE TESTÓW Z DYSKU
// ==========================================================

ipcMain.handle('delete-test', async (event, testId) => {
    const userDataPath = app.getPath('userData');
    const testFolder = path.join(userDataPath, 'tests_library', testId);

    try {
        if (fs.existsSync(testFolder)) {
            // Usuwa folder rekurencyjnie (wymaga Node 14.14+)
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
// 4. OKNO TESTOWE I KOMUNIKACJA
// ==========================================================

function openTestWindow(htmlPath) {
    const testWindow = new BrowserWindow({
        width: 1024,
        height: 768,
        parent: mainWindow,
        title: "Badanie w toku...",
        // Tryb Kiosk (Pełny ekran, brak możliwości wyjścia) - Opcjonalne
        // kiosk: true, 
        // autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Specjalny most dla okna testowego
            preload: path.join(__dirname, 'preload_test.js')
        }
    });

    testWindow.loadFile(htmlPath);
    // testWindow.webContents.openDevTools(); // Odkomentuj do debugowania testu
}

// Odbieranie wyników z okna testowego
ipcMain.on('test-finished', (event, results) => {
    // Zamknij okno testu
    const testWin = BrowserWindow.fromWebContents(event.sender);
    if (testWin) testWin.close();

    // Przekaż wyniki do głównego Dashboardu
    if (mainWindow) {
        mainWindow.webContents.send('test-results-forwarded', results);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

// Awaryjne zamknięcie testu
ipcMain.on('test-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
});


// ==========================================================
// 5. ZAPIS LOKALNY Z PODPISEM CYFROWYM (HMAC)
// ==========================================================

ipcMain.on('save-local-result', (event, dataToSave) => {
    const dialog = require('electron').dialog;
    const SECRET_KEY = "Inzynierka_Secret_Key_2026"; // Klucz do podpisu
    
    // Generowanie podpisu
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(JSON.stringify(dataToSave.wyniki));
    const signature = hmac.digest('hex');

    // Struktura pliku wyjściowego
    const finalFileContent = {
        meta: { 
            app: "PsychoLauncher", 
            version: "2.0", 
            signature: signature 
        },
        data: dataToSave
    };

    // Okno dialogowe "Zapisz jako..."
    dialog.showSaveDialog(mainWindow, {
        title: 'Zapisz wynik badania',
        defaultPath: `Wynik_${dataToSave.testId}_${Date.now()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    }).then(result => {
        if (!result.canceled) {
            fs.writeFileSync(result.filePath, JSON.stringify(finalFileContent, null, 2));
            event.sender.send('test-status', 'Wynik zapisany pomyślnie na dysku.');
        }
    }).catch(err => {
        console.error(err);
    });
});


// ==========================================================
// START APLIKACJI
// ==========================================================

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});