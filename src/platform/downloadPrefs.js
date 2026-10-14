// src/platform/downloadPrefs.js — preferencje pobierania (Ciche pobieranie).
// Osobny klucz localStorage (poza motywem): { silent: bool, dir: string|null }.
// dir=null = domyślny folder Downloads. Ciche pobieranie działa tylko na
// Electron (Web nie ma main-procesu ani okien systemowych).
export const DOWNLOAD_PREFS_KEY = "nous-download-prefs";

export function defaultDownloadPrefs() {
  return { silent: false, dir: null };
}

function sanitizePrefs(raw) {
  return {
    silent: raw && raw.silent === true,
    dir:
      raw && typeof raw.dir === "string" && raw.dir.trim() !== ""
        ? raw.dir
        : null,
  };
}

export function loadDownloadPrefs(storage) {
  const store =
    storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return defaultDownloadPrefs();
  try {
    const raw = store.getItem(DOWNLOAD_PREFS_KEY);
    if (!raw) return defaultDownloadPrefs();
    return sanitizePrefs(JSON.parse(raw));
  } catch {
    return defaultDownloadPrefs();
  }
}

export function saveDownloadPrefs(prefs, storage) {
  const store =
    storage || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(DOWNLOAD_PREFS_KEY, JSON.stringify(sanitizePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}

/** Efektywny folder: wybrany albo domyślny (z main-procesu). */
export function resolveDownloadDir(prefs, defaultDir) {
  if (prefs && prefs.dir) return prefs.dir;
  return defaultDir || null;
}

/** Ciche pobieranie ma sens tylko na Electron (main-proces + will-download). */
export function isSilentDownload(prefs, platformKind) {
  return !!prefs && prefs.silent === true && platformKind === "electron";
}
