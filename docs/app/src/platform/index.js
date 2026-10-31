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
