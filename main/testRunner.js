// main/testRunner.js — TestRunner: okno testu (kanał run-test) + wyniki
// + zapis lokalny z HMAC. Uruchomienie zawsze z dysku, nigdy nie pobiera
// (pobieranie to kanał download-test w main/downloads.js).

function createTestRunner({
  BrowserWindow,
  screen,
  path,
  dialog,
  fs,
  crypto,
  getMainWindow,
  getMasterKey,
  preloadPath,
  platform = process.platform,
  // Wstrzyknięte leniwie przez main.js (run-test rozwiązuje entryFile z dysku).
  // Opcjonalne — stare testy jednostkowe ich nie podają.
  getTestsLibraryDir = null,
  findStartFile = null,
  getUiLanguage = null,
}) {
  let activeTestWindow = null;

  function isTestRunning() {
    return !!activeTestWindow;
  }

  function openTestWindow(htmlPath) {
    if (isTestRunning()) return;

    const isLinux = platform === "linux";

    // Na Linuksie (szczególnie Cinnamon/Mint):
    // - parent blokuje fullscreen w niektórych WM
    // - fullscreen w konstruktorze jest ignorowany przez Cinnamona
    // - okno musi być najpierw zmapowane (widoczne), zanim WM zaakceptuje fullscreen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    activeTestWindow = new BrowserWindow({
      width: isLinux ? width : 1024,
      height: isLinux ? height : 768,
      x: isLinux ? 0 : undefined,
      y: isLinux ? 0 : undefined,
      show: !isLinux, // Na Linuksie: ukryj, pokażemy ręcznie
      parent: isLinux ? undefined : getMainWindow(), // Na Linuksie: bez parent (Cinnamon blokuje FS dla child windows)
      title: "Nous",

      // --- PEŁNY EKRAN ---
      fullscreen: !isLinux, // Na Linuksie nie ustawiamy w konstruktorze
      fullscreenable: true,
      autoHideMenuBar: true,

      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: false,
        preload: preloadPath,
        additionalArguments: [`--nous-test-language=${resolveTestLanguage()}`],
      },
    });

    if (isLinux) {
      // Linux/Cinnamon: pokaż okno → poczekaj aż WM je zmapuje → dopiero wtedy fullscreen
      activeTestWindow.once("ready-to-show", () => {
        activeTestWindow.show();
        activeTestWindow.maximize();

        setTimeout(() => {
          if (activeTestWindow && !activeTestWindow.isDestroyed()) {
            activeTestWindow.setFullScreen(true);

            // Fallback: jeśli po kolejnych 500ms nadal nie jest fullscreen, zostaje zmaksymalizowane
            setTimeout(() => {
              if (activeTestWindow && !activeTestWindow.isDestroyed() && !activeTestWindow.isFullScreen()) {
                console.log("[FullScreen] Natywny fullscreen nie zadziałał — fallback: maximize");
                activeTestWindow.maximize();
              }
            }, 500);
          }
        }, 500);
      });
    }

    activeTestWindow.loadFile(htmlPath);

    activeTestWindow.on("closed", () => {
      activeTestWindow = null;
      const mainWindow = getMainWindow();
      if (mainWindow) mainWindow.webContents.send("test-process-stopped");
    });

    // Obsługa ESC (opcjonalna - pozwala wyjść z FullScreen)
    activeTestWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape" && input.type === "keyDown") {
        if (activeTestWindow) activeTestWindow.setFullScreen(false);
      }
    });
  }

  function onTestFinished(event, results) {
    const testWin = BrowserWindow.fromWebContents(event.sender);
    if (testWin) testWin.close();

    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send("test-results-forwarded", results);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  }

  function onTestClose(event) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  }

  /**
   * Kanał run-test: uruchomienie testu z dysku. Nigdy nie pobiera.
   * Polityka: Uruchom zawsze uruchamia lokalną wersję; aktualizacje
   * robi wyłącznie kanał download-test (zakładka Aktualizacje).
   */
  function onRunTest(event, payload) {
    const sender = event.sender;
    const testId = payload && (payload.testId || payload.test_id);

    // --- SECURITY CHECK: TEST ID VALIDATION (jak delete-test) ---
    if (!/^[a-zA-Z0-9_-]+$/.test(testId || "")) {
      sender.send("test-status", { code: "error", error: "invalidTestId" });
      return;
    }

    if (!getTestsLibraryDir || !findStartFile) {
      sender.send("test-status", { code: "error", error: "runConfig" });
      return;
    }

    const testFolder = path.join(getTestsLibraryDir(), testId);
    const entryFile = findStartFile(testFolder);

    if (!entryFile) {
      sender.send("test-status", { code: "error", error: "testNotDownloaded" });
      return;
    }

    if (isTestRunning()) {
      sender.send("test-status", { code: "anotherTestRunning" });
      return;
    }

    sender.send("test-status", { code: "starting" });
    openTestWindow(entryFile);
  }

  /**
   * Język interfejsu (pl/en) świeżo dla każdego okna testu — czyta go
   * getter preload_test.js, więc test dostaje język z chwili uruchomienia.
   * Nieznana/brakująca wartość → pl (język źródłowy).
   */
  function resolveTestLanguage() {
    const lang = typeof getUiLanguage === "function" ? getUiLanguage() : "pl";
    return lang === "en" ? "en" : "pl";
  }

  function onSaveLocalResult(event, dataToSave) {
    // Użyj Master Key z safeStorage zamiast hardcodowanego klucza
    const masterKey = getMasterKey();
    if (!masterKey) {
      console.error("Could not get master key for HMAC!");
      event.sender.send("test-status", {
        code: "error",
        error: "signingKeyUnavailable",
      });
      return;
    }

    const hmac = crypto.createHmac("sha256", masterKey);
    hmac.update(JSON.stringify(dataToSave.wyniki));
    const signature = hmac.digest("hex");

    const finalFileContent = {
      meta: {
        app: "Nous",
        version: "2.0",
        signature: signature,
      },
      data: dataToSave,
    };

    dialog
      .showSaveDialog(getMainWindow(), {
        // Tytuł dialogu podaje renderer (i18n) zamiast main — patrz src/platform/electron.js.
        title: (dataToSave && dataToSave.dialogTitle) || "Save result",
        // Używamy test_id (snake_case) jako primary, testId jako fallback
        defaultPath: `${(dataToSave && dataToSave.fileBaseName) || "Result"}_${dataToSave.test_id || dataToSave.testId || "result"}_${Date.now()}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      })
      .then((result) => {
        if (!result.canceled) {
          try {
            fs.writeFileSync(result.filePath, JSON.stringify(finalFileContent, null, 2));
            event.sender.send("test-status", { code: "resultSaved" });
          } catch (writeErr) {
            console.error("Save error:", writeErr);
            event.sender.send("test-status", { code: "error", error: "fileSave" });
          }
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }

  function registerIpc(ipcMain) {
    ipcMain.on("run-test", onRunTest);
    ipcMain.on("test-finished", onTestFinished);
    ipcMain.on("test-close", onTestClose);
    ipcMain.on("save-local-result", onSaveLocalResult);
  }

  return {
    isTestRunning,
    openTestWindow,
    onRunTest,
    onTestFinished,
    onTestClose,
    onSaveLocalResult,
    registerIpc,
    // Tylko testy: podgląd stanu.
    getActiveWindow: () => activeTestWindow,
  };
}

module.exports = { createTestRunner };
