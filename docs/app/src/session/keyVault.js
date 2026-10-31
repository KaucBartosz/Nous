// src/session/keyVault.js — KeyVault seam (C4): 3 adaptery na klucze E2E.
// Local = safeStorage maszyny (przez platform C1), Cloud = PIN-wrap + Firestore,
// Memory = testy. Rotacja/KDF w 1 miejscu zamiast w modalach.
import { getPlatform } from "../platform/index.js";

export function createMemoryVault(seed = null) {
  let key = seed;
  return {
    kind: "memory",
    async get() {
      return key;
    },
    async set(hex) {
      key = hex;
      return true;
    },
    async clear() {
      key = null;
      return true;
    },
  };
}

export function createLocalVault(keys = null) {
  const k = keys || getPlatform().keys;
  return {
    kind: "local",
    get: () => k.getE2EKey(),
    set: (hex) => k.setE2EKey(hex),
    clear: () => k.clearE2EKey(),
  };
}

/**
 * Cloud vault — PIN-wrap + dokument user_keys.
 * Zależności wstrzyknięte (bez Firebase w środku):
 * - getDocFn(uid) -> rekord lub null
 * - setDocFn(uid, payload) -> void
 * - wrapFn(hexKey, pin, salt) / unwrapFn(enc, iv, pin, salt)
 * - randomHexFn() -> 64-znakowy hex
 */
export function createCloudVault({ getDocFn, setDocFn, wrapFn, unwrapFn, randomHexFn }) {
  async function persistWrapped(uid, masterHex, pin, salt) {
    const wrapped = await wrapFn(masterHex, pin, salt);
    await setDocFn(uid, {
      encryptedMasterKey: wrapped.encryptedKey,
      iv: wrapped.iv,
      updatedAt: new Date().toISOString(),
    });
    return masterHex;
  }

  return {
    kind: "cloud",
    async setupNewMaster({ uid, pin, salt }) {
      return persistWrapped(uid, randomHexFn(), pin, salt);
    },
    async rotateMaster({ uid, master, pin, salt }) {
      return persistWrapped(uid, master, pin, salt);
    },
    async unlockWithPin({ uid, pin, salt }) {
      const meta = await getDocFn(uid);
      if (!meta || !meta.encryptedMasterKey) {
        throw new Error("Brak klucza w chmurze!");
      }
      return unwrapFn(meta.encryptedMasterKey, meta.iv, pin, salt);
    },
    async fetchMeta(uid) {
      return getDocFn(uid);
    },
  };
}
