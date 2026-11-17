// src/platform/index.js — jedyny seam Electron/Web (wybór raz, reszta kodu nie zna window.electronAPI)
import { createElectronPlatform } from "./electron.js";
import { createWebPlatform } from "./web.js";

let current = null;

function detectKind() {
  try {
    if (typeof window !== "undefined" && window.electronAPI) return "electron";
  } catch (e) {}
  return "web";
}

export function getPlatform() {
  if (current) return current;
  current = detectKind() === "electron" ? createElectronPlatform() : createWebPlatform();
  return current;
}

export function setPlatform(p) {
  current = p;
  return current;
}

export function resetPlatform() {
  current = null;
  return null;
}

export function isElectron() { return getPlatform().kind === "electron"; }
export function isWeb() { return getPlatform().kind === "web"; }

// Re-eksporty adapterów — konsumenci importują wyłącznie z tego seamu (ADR-0001).
export { formatTestStatus, isTestStatusError } from "./electron.js";
export { shellPolicyFor, applyShellPolicy } from "./shell.js";
export {
  DOWNLOAD_PREFS_KEY,
  defaultDownloadPrefs,
  loadDownloadPrefs,
  saveDownloadPrefs,
  resolveDownloadDir,
  isSilentDownload,
} from "./downloadPrefs.js";
