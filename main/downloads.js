// main/downloads.js — Downloads (E5): kolejka pobierania + allowlista URL + ZipSlip
// + skanowanie biblioteki + usuwanie. Przeniesione 1:1 z main.js.
// Testowane: walidatory, ZipSlip, cache, skan, usuwanie, kolejkowanie.
// Streaming https/AdmZip przeniesiony bez zmian (cover przez E2E + ręczny test).

const ALLOWED_OWNER = "KaucBartosz";
const CDN_DOMAIN = "objects.githubusercontent.com";
const ALLOWED_REPO_DOMAINS = ["github.com", "raw.githubusercontent.com"];

/** null = OK, inaczej komunikat BŁĄD (reguła z download-and-run, bez zmian). */
function validateTestId(testId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(testId || "")) {
    return "BŁĄD: Nieprawidłowe ID testu!";
  }
  return null;
}

/**
 * Allowlista URL (reguła z download-and-run; SEC: match z granicą domeny —
 * `evilgithub.com` odpada, legalne subdomeny jak `codeload.github.com` działają).
 */
function validateDownloadUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") {
      return "BŁĄD: Tylko HTTPS!";
    }
    // URL normalizuje hostname do małych liter; toLowerCase dla pewności.
    const host = parsedUrl.hostname.toLowerCase();
    const domainAllowed = (d) => host === d || host.endsWith(`.${d}`);
    if (host === CDN_DOMAIN) {
      // CDN - dozwolony bez walidacji ścieżki (hasze URL)
    } else if (ALLOWED_REPO_DOMAINS.some(domainAllowed)) {
      // Sprawdź, czy ścieżka zaczyna się od /KaucBartosz/
      if (!parsedUrl.pathname.startsWith(`/${ALLOWED_OWNER}/`)) {
        return `BŁĄD: Dozwolone są wyłącznie repozytoria ${ALLOWED_OWNER}!`;
      }
    } else {
      return "BŁĄD: Niedozwolona domena!";
    }
  } catch (e) {
    return "BŁĄD: Nieprawidłowy URL!";
  }
  return null;
}

/**
 * Cel redirectu przechodzi tę samą allowlistę co URL startowy (SEC: wcześniej
 * Location nie był walidowany wcale). null = brak błędu: śledź albo — przy
 * braku Location — stara ścieżka (Błąd HTTP: 3xx).
 */
function validateRedirectTarget(location) {
  if (!location) return null;
  return validateDownloadUrl(location);
}

/** Limit paczki: AdmZip trzyma ~2–3× rozmiar w RAM; ZIP-y testów mają ≤100 MB. */
const MAX_ZIP_BYTES = 200 * 1024 * 1024;

/**
 * Strażnik przed `new AdmZip` (OOM z zatrutego rejestru). null = OK.
 * Limit parametryzowany dla testów (nie piszemy 200 MB na dysk).
 */
function checkDownloadedSize({ fs, zipPath, limitBytes = MAX_ZIP_BYTES }) {
  try {
    const { size } = fs.statSync(zipPath);
    if (size > limitBytes) {
      return `BŁĄD: Paczka przekracza limit ${Math.round(limitBytes / 1024 / 1024)} MB!`;
    }
  } catch (e) {
    return `Błąd odczytu paczki: ${e.message}`;
  }
  return null;
}

/**
 * ZipSlip: każdy wpis po join musi zostać w folderze docelowym (rzuca jak wcześniej).
 * @param {Array<{entryName: string}>} zipEntries
 */
function assertZipSafe(zipEntries, path, testFolder) {
  for (const entry of zipEntries) {
    const entryName = entry.entryName;
    const targetPath = path.join(testFolder, entryName);

    // Check if extracted path is still within the target folder
    if (!targetPath.startsWith(testFolder)) {
      throw new Error(
        `Malicious ZIP detected! File "${entryName}" attempts to traverse out of target directory.`,
      );
    }
  }
}

/**
 * KROK 1 z executeDownloadTask: czy trzeba pobierać? (false = uruchom z dysku)
 */
function checkCacheNeedsDownload({ fs, testFolder, metaPath, entryFile, version, isLocalDev }) {
  let needsDownload = !isLocalDev; // Local dev tests never need download

  if (!isLocalDev && fs.existsSync(testFolder) && fs.existsSync(metaPath) && entryFile) {
    try {
      const localMeta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (Number(localMeta.version) >= Number(version)) {
        needsDownload = false;
      }
    } catch (e) {
      console.log("Błąd odczytu meta.json, wymuszam pobieranie.");
    }
  }
  return needsDownload;
}

/** Skan tests_library (treść handlera get-local-versions). */
function scanLocalVersions({ fs, path, testsDir }) {
  const localVersions = {};
  // Store the path we used for debugging in a special key
  localVersions.__scannedDir = testsDir;

  if (!fs.existsSync(testsDir)) {
    console.log(`Tests directory not found at: ${testsDir}`);
    return localVersions; // Still return with __scannedDir
  }

  try {
    const testFolders = fs
      .readdirSync(testsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    testFolders.forEach((testId) => {
      const testFolder = path.join(testsDir, testId);
      const metaPath = path.join(testFolder, "meta.json");

      if (fs.existsSync(metaPath)) {
        try {
          const metaContent = fs.readFileSync(metaPath, "utf8");
          const meta = JSON.parse(metaContent);
          localVersions[testId] = {
            version: meta.version,
            name: meta.name || "",
            description: meta.description || "",
            isLocalDev: false,
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
}

/** Usuwanie testu (treść handlera delete-test). */
function deleteTestById({ fs, path, testsDir, testId }) {
  // --- SECURITY CHECK: TEST ID VALIDATION ---
  if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
    console.error(`Blocked delete attempt for invalid testId: ${testId}`);
    return { success: false, error: "Nieprawidłowe ID testu" };
  }

  const testFolder = path.join(testsDir, testId);

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
}

function createDownloader({
  fs,
  path,
  https,
  AdmZip,
  getUserDataPath,
  findStartFile,
  openTestWindow,
  isTestRunning,
}) {
  // Queue management for downloads (stan żyje tu)
  const downloadQueue = [];
  let isDownloadingInProgress = false;
  const activeDownloads = new Set();

  function processDownloadQueue() {
    if (isDownloadingInProgress || downloadQueue.length === 0) return;

    const task = downloadQueue.shift();
    isDownloadingInProgress = true;
    executeDownloadTask(task);
  }

  /**
   * Wejście do kolejki (treść początku download-and-run: te same checki,
   * ta sama kolejność, ten sam add+push).
   * @returns {{ ok: true } | { ok: false, message }} — handler wysyła message lub potwierdzenie
   */
  function enqueueDownload(taskData, sender) {
    const { testId, url, isLocalDev } = taskData;

    // --- SECURITY CHECK: RATE LIMITING ---
    if (activeDownloads.has(testId)) {
      return { ok: false, message: "Zadanie dla tego testu jest już w kolejce!" };
    }

    // --- SECURITY CHECK: TEST ID VALIDATION ---
    const idError = validateTestId(testId);
    if (idError) return { ok: false, message: idError };

    // Skip URL validation for local dev tests
    if (!isLocalDev) {
      const urlError = validateDownloadUrl(url);
      if (urlError) return { ok: false, message: urlError };
    }

    // Add to queue
    activeDownloads.add(testId);
    downloadQueue.push({ ...taskData, sender });
    return { ok: true };
  }

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
    const testsLibraryDir = path.join(userDataPath, "tests_library");

    let testFolder = path.join(testsLibraryDir, testId);
    let entryFile = findStartFile(testFolder);

    const zipPath = path.join(testFolder, "package.zip");
    const metaPath = path.join(testFolder, "meta.json");

    // --- KROK 1: SPRAWDZANIE CACHE ---
    const needsDownload = checkCacheNeedsDownload({
      fs,
      testFolder,
      metaPath,
      entryFile,
      version,
      isLocalDev,
    });

    // --- KROK 2: DECYZJA - URUCHOM Z DYSKU ---
    if (!needsDownload) {
      if (onlyDownload) {
        sender.send("test-status", `Test (v${version}) jest gotowy.`);
      } else {
        if (isTestRunning()) {
          sender.send("test-status", "Inny test w toku. Uruchomienie wstrzymane.");
        } else {
          sender.send("test-status", `Uruchamianie (v${version})...`);
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

    sender.send("test-status", `Pobieranie paczki ZIP (v${version})...`);

    const file = fs.createWriteStream(zipPath);

    // Funkcja do obsługi przekierowań
    const downloadWithRedirect = (downloadUrl, maxRedirects = 5) => {
      if (maxRedirects <= 0) {
        sender.send("test-status", "BŁĄD: Za dużo przekierowań!");
        fs.unlink(zipPath, () => {});
        finishTask();
        return;
      }

      https
        .get(downloadUrl, (response) => {
          // Obsługa przekierowań (301, 302, 303, 307, 308)
          if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              // SEC: allowlista obowiązuje też cele redirectów (nie tylko URL startowy)
              const redirectError = validateRedirectTarget(redirectUrl);
              if (redirectError) {
                sender.send("test-status", redirectError);
                fs.unlink(zipPath, () => {});
                finishTask();
                return;
              }
              console.log(`Przekierowanie: ${response.statusCode} -> ${redirectUrl}`);
              downloadWithRedirect(redirectUrl, maxRedirects - 1);
              return;
            }
          }
          // 404 itd. wyrzuci błąd
          if (response.statusCode !== 200) {
            sender.send("test-status", `Błąd HTTP: ${response.statusCode}`);
            fs.unlink(zipPath, () => {});
            finishTask();
            return;
          }

          const totalBytes = parseInt(response.headers["content-length"], 10);
          let receivedBytes = 0;
          let lastUpdate = 0;

          response.on("data", (chunk) => {
            receivedBytes += chunk.length;
            file.write(chunk);

            if (totalBytes) {
              const percent = Math.round((receivedBytes / totalBytes) * 100);
              const now = Date.now();
              // Throttle updates to every 100ms
              if (now - lastUpdate > 100 || percent === 100) {
                sender.send("download-progress", { test_id: testId, percent });
                lastUpdate = now;
              }
            }
          });

          response.on("end", () => {
            file.end(); // Important!

            // Koniec pracy na pliku -> próbujemy rozpakować zip
            file.on("finish", async () => {
              file.close();

              // SEC: strażnik RAM przed new AdmZip (zatruty rejestr → OOM)
              const sizeError = checkDownloadedSize({ fs, zipPath });
              if (sizeError) {
                sender.send("test-status", sizeError);
                fs.unlink(zipPath, () => {});
                finishTask();
                return;
              }

              // --- KROK 4: ROZPAKOWYWANIE ---
              sender.send("test-status", "Rozpakowywanie plików...");

              try {
                const zip = new AdmZip(zipPath);

                // --- SECURITY CHECK: ZIP SLIP VULNERABILITY ---
                assertZipSafe(zip.getEntries(), path, testFolder);

                zip.extractAllTo(testFolder, true); // Nadpisz

                // Use async file operations (non-blocking)
                await fs.promises.unlink(zipPath); // Usuń ZIP

                // Aktualizacja meta
                const metaData = {
                  version: Number(version),
                  lastUpdated: new Date().toISOString(),
                  name: testName || "",
                  description: testDescription || "",
                };
                await fs.promises.writeFile(metaPath, JSON.stringify(metaData));

                // Szukamy pliku ponownie po rozpakowaniu
                entryFile = findStartFile(testFolder);

                // Info przez IPC aby odświeżyć liste testów
                sender.send("test-installed", { test_id: testId, version: Number(version) });

                if (!entryFile) {
                  sender.send("test-status", "BŁĄD: Brak index.html!");
                  finishTask();
                  return;
                }

                if (onlyDownload) {
                  sender.send("test-status", "Zainstalowano pomyślnie.");
                } else {
                  if (isTestRunning()) {
                    sender.send("test-status", "Pobrano. Uruchomienie wstrzymane - inny test w toku.");
                  } else {
                    sender.send("test-status", "Uruchamianie...");
                    openTestWindow(entryFile);
                  }
                }

                finishTask();
              } catch (err) {
                console.error("Błąd ZIP:", err);
                sender.send("test-status", `Błąd ZIP: ${err.message}`);
                finishTask();
              }
            });
          });
        })
        .on("error", (err) => {
          fs.unlink(zipPath, () => {});
          sender.send("test-status", `Błąd sieci: ${err.message}`);
          finishTask();
        });
    };

    let finalUrl = url;
    if (finalUrl.includes("github.com") || finalUrl.includes("githubusercontent.com")) {
      finalUrl += (finalUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
    }
    downloadWithRedirect(finalUrl);
  }

  function registerIpc(ipcMain) {
    ipcMain.on("download-and-run", (event, taskData) => {
      const res = enqueueDownload(taskData, event.sender);
      event.sender.send("test-status", res.ok ? "Dodano do kolejki..." : res.message);
      if (res.ok) processDownloadQueue();
    });

    ipcMain.handle("get-local-versions", async () => {
      const userDataPath = getUserDataPath();
      return scanLocalVersions({ fs, path, testsDir: path.join(userDataPath, "tests_library") });
    });

    ipcMain.handle("delete-test", async (event, testId) => {
      const userDataPath = getUserDataPath();
      return deleteTestById({
        fs,
        path,
        testsDir: path.join(userDataPath, "tests_library"),
        testId,
      });
    });
  }

  return {
    validateTestId,
    validateDownloadUrl,
    assertZipSafe,
    checkCacheNeedsDownload,
    scanLocalVersions,
    deleteTestById,
    enqueueDownload,
    executeDownloadTask,
    processDownloadQueue,
    registerIpc,
    // Tylko testy: podgląd kolejki.
    queueState: () => ({ length: downloadQueue.length, busy: isDownloadingInProgress, active: [...activeDownloads] }),
  };
}

module.exports = {
  createDownloader,
  validateTestId,
  validateDownloadUrl,
  validateRedirectTarget,
  MAX_ZIP_BYTES,
  checkDownloadedSize,
  assertZipSafe,
  checkCacheNeedsDownload,
  scanLocalVersions,
  deleteTestById,
};
