// main/silentDownloads.js — ciche pobieranie (opcja w Ustawieniach).
// Domyślnie Electron pokazuje natywne okno zapisu (will-download bez
// setSavePath). Gdy renderer włączy tryb cichy, will-download zapisuje
// wprost do folderu (wybranego lub Downloads). Stan żyje w main (pamięć),
// źródłem prawdy są preferencje renderera (push przy starcie i zmianie).
// Testowane: routing trybu, sanacja nazwy, fallback folderu.
function createSilentDownloads({ session, dialog, app, fs, path }) {
  let mode = { silent: false, dir: null };

  function setMode(next) {
    mode = {
      silent: next && next.silent === true,
      dir:
        next && typeof next.dir === "string" && next.dir.trim() !== ""
          ? next.dir
          : null,
    };
    return { ...mode };
  }

  function getMode() {
    return { ...mode };
  }

  function downloadsDir() {
    return mode.dir || app.getPath("downloads");
  }

  /** Ścieżka cichego zapisu (basename = strażnik jak w bulkExport). */
  function silentPathFor(filename) {
    const safeName = path.basename(filename || `Wynik_${Date.now()}`);
    return path.join(downloadsDir(), safeName);
  }

  function attachWillDownload() {
    session.defaultSession.on("will-download", (event, item) => {
      if (!mode.silent) return; // default: natywne okno systemu
      try {
        fs.mkdirSync(downloadsDir(), { recursive: true });
        item.setSavePath(silentPathFor(item.getFilename()));
      } catch (e) {
        console.error("Silent download failed:", e);
      }
    });
  }

  function registerIpc(ipcMain, getMainWindow) {
    ipcMain.handle("get-downloads-path", () => app.getPath("downloads"));

    ipcMain.handle("pick-download-folder", async (event, current) => {
      const res = await dialog.showOpenDialog(getMainWindow(), {
        title: "Wybierz folder pobierania",
        properties: ["openDirectory"],
        defaultPath: (current && String(current)) || downloadsDir(),
      });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return { cancelled: true };
      }
      return { cancelled: false, dir: res.filePaths[0] };
    });

    ipcMain.on("set-silent-downloads", (event, next) => {
      setMode(next);
    });
  }

  return {
    setMode,
    getMode,
    downloadsDir,
    silentPathFor,
    attachWillDownload,
    registerIpc,
  };
}

module.exports = { createSilentDownloads };
