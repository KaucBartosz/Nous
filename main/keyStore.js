// main/keyStore.js — KeyStore (E1): master_key.enc / e2e_key.enc nad safeStorage.
// Przeniesione 1:1 z main.js (getKeyFilePath/getOrGenerateMasterKey + 4 handlery E2E).
// Czysty CommonJS: getUserDataPath/fs/path/safeStorage/crypto wstrzyknięte.

function createKeyStore({ getUserDataPath, fs, path, safeStorage, crypto }) {
  // Ścieżki lazy (app.getPath() dopiero po app.whenReady()) — jak wcześniej.
  let keyFilePath = null;
  let e2eKeyFilePath = null;

  function getKeyFilePath() {
    if (!keyFilePath) {
      keyFilePath = path.join(getUserDataPath(), "master_key.enc");
    }
    return keyFilePath;
  }

  function getE2EKeyFilePath() {
    if (!e2eKeyFilePath) {
      e2eKeyFilePath = path.join(getUserDataPath(), "e2e_key.enc");
    }
    return e2eKeyFilePath;
  }

  function getOrGenerateMasterKey() {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("safeStorage is not available on this system!");
      }

      if (fs.existsSync(getKeyFilePath())) {
        // 1. Load existing
        const encryptedKey = fs.readFileSync(getKeyFilePath());
        const decryptedKey = safeStorage.decryptString(encryptedKey);
        console.log("Master Key loaded successfully.");
        return decryptedKey; // Hex string expected
      } else {
        // 2. Generate new
        const newKey = crypto.randomBytes(32).toString("hex"); // 32 bytes = 256 bits
        const encryptedKey = safeStorage.encryptString(newKey);
        fs.writeFileSync(getKeyFilePath(), encryptedKey);
        console.log("New Master Key generated and secured.");
        return newKey;
      }
    } catch (e) {
      console.error("Encryption Key Error:", e);
      return null;
    }
  }

  function setE2EKey(hexKey) {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false;
      const encryptedKey = safeStorage.encryptString(hexKey);
      fs.writeFileSync(getE2EKeyFilePath(), encryptedKey);
      console.log("E2E Key securely written to disk via safeStorage.");
      return true;
    } catch (e) {
      console.error("Set E2E Key Error:", e);
      return false;
    }
  }

  function getE2EKey() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      if (fs.existsSync(getE2EKeyFilePath())) {
        const encryptedKey = fs.readFileSync(getE2EKeyFilePath());
        console.log("E2E Key loaded from safeStorage.");
        return safeStorage.decryptString(encryptedKey);
      }
    } catch (e) {
      console.error("Get E2E Key Error:", e);
      return null; // Corrupted or unreadable
    }
    return null;
  }

  function clearE2EKey() {
    try {
      if (fs.existsSync(getE2EKeyFilePath())) {
        fs.unlinkSync(getE2EKeyFilePath());
        console.log("E2E Key cleared from safeStorage.");
      }
      return true;
    } catch (e) {
      console.error("Clear E2E Key Error:", e);
      return false;
    }
  }

  function registerIpc(ipcMain) {
    ipcMain.handle("get-encryption-key", async () => getOrGenerateMasterKey());
    ipcMain.handle("set-e2e-key", async (event, hexKey) => setE2EKey(hexKey));
    ipcMain.handle("get-e2e-key", async () => getE2EKey());
    ipcMain.handle("clear-e2e-key", async () => clearE2EKey());
  }

  // Tylko testy: reset lazy-cache'y między fixturami.
  function resetCache() {
    keyFilePath = null;
    e2eKeyFilePath = null;
  }

  return {
    getKeyFilePath,
    getE2EKeyFilePath,
    getOrGenerateMasterKey,
    setE2EKey,
    getE2EKey,
    clearE2EKey,
    registerIpc,
    resetCache,
  };
}

module.exports = { createKeyStore };
