// main/paths.js — ścieżki procesu głównego (E1): userData per-OS + szukanie plików.
// Czysty CommonJS, zero Electrona: app/fs/path wstrzyknięte (testy na temp-dirach).

function createPaths({ fs, path }) {
  /**
   * Folder danych na wszystkich platformach (reguła z main.js, bez zmian).
   * macOS: ~/Library/Application Support/Nous; Linux/Windows: app.getPath('userData').
   */
  function getUserDataPath(app) {
    const userDataPath = app.getPath("userData");
    if (process.platform === "darwin") {
      return path.join(app.getPath("home"), "Library", "Application Support", "Nous");
    }
    return userDataPath;
  }

  /** Szuka pliku bezpośrednio i max 1 poziom podfolderów (paczki z GitHuba). */
  function findFileInSubfolders(folderPath, filename) {
    if (!fs.existsSync(folderPath)) return null;

    const directPath = path.join(folderPath, filename);
    if (fs.existsSync(directPath)) return directPath;

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
    return findFileInSubfolders(folderPath, "index.html");
  }

  return { getUserDataPath, findFileInSubfolders, findStartFile };
}

module.exports = { createPaths };
