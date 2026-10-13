// src/db/cryptoPolicy.js — seam szyfrowania lokalnego (C2).
// Warstwa DB nie importuje już Dialog ani window.electronAPI.
// Ostrzeżenia UI rejestruje warstwa aplikacji (src/app.js) przez setCryptoWarningHandler.
import { initCrypto, encryptData, decryptData } from "../modules/cryptoService.js";
import { getPlatform } from "../platform/index.js";

let ready = false;
let warned = false;
let warnHandler = (message, level) => console.warn(`[CryptoPolicy:${level}]`, message);

export function setCryptoWarningHandler(fn) {
  if (typeof fn === "function") warnHandler = fn;
}

export function isCryptoReady() {
  return ready;
}

/** Leniwa inicjalizacja klucza (Electron safeStorage przez seam C1). Zwraca true gdy gotowe. */
export async function ensureCrypto() {
  if (ready) return true;
  if (getPlatform().kind !== "electron") return false;
  try {
    const key = await getPlatform().keys.getEncryptionKey();
    if (key) {
      await initCrypto(key);
      ready = true;
      return true;
    }
    if (!warned) {
      warned = true;
      setTimeout(() => {
        warnHandler(
          "Błąd inicjalizacji szyfrowania. Dane lokalne mogą nie być szyfrowane. " +
            "Przyczyną może być brak dostępu do systemu przechowywania kluczy (DPAPI/Keychain).",
          "warning",
        );
      }, 1000);
    }
  } catch (e) {
    console.error("Crypto Init Failed:", e);
    if (!warned) {
      warned = true;
      setTimeout(() => {
        warnHandler(
          `Błąd szyfrowania: ${e.message}. Dane lokalne będą przechowywane niezaszyfrowane.`,
          "error",
        );
      }, 1000);
    }
  }
  return false;
}

export { encryptData, decryptData };
