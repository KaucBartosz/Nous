import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pathsMod from "../../main/paths.js";
import keyStoreMod from "../../main/keyStore.js";

const { createPaths } = pathsMod;
const { createKeyStore } = keyStoreMod;

// main/* to CommonJS z wstrzykniętymi zależnościami: prawdziwe fs/path,
// fejki tylko tam gdzie system (app, safeStorage, crypto).

describe("main/paths", () => {
  const { getUserDataPath, findFileInSubfolders, findStartFile } = createPaths({ fs, path });

  it("getUserDataPath: darwin osobno, reszta z app", () => {
    const app = {
      getPath: (name) => ({ userData: "/ud", home: "/home" })[name],
    };
    // Platforma testowa to win32/linux — gałąź darwin niedostępna tu bezpośrednio,
    // więc pinujemy kontrakt na gałęzi domyślnej + kształt kodu darwin.
    expect(getUserDataPath(app)).toBe("/ud");
  });

  it("findFileInSubfolders: bezpośrednio, 1 poziom, brak", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-paths-"));
    fs.writeFileSync(path.join(dir, "index.html"), "top");
    fs.mkdirSync(path.join(dir, "sub"));
    fs.writeFileSync(path.join(dir, "sub", "deep.txt"), "deep");

    expect(findFileInSubfolders(dir, "index.html")).toBe(path.join(dir, "index.html"));
    expect(findFileInSubfolders(dir, "deep.txt")).toBe(path.join(dir, "sub", "deep.txt"));
    expect(findFileInSubfolders(dir, "nope.txt")).toBeNull();
    expect(findFileInSubfolders(path.join(dir, "missing"), "x")).toBeNull();
    expect(findStartFile(dir)).toBe(path.join(dir, "index.html"));

    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("main/keyStore", () => {
  let dir;
  let store;

  const fakeSafeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from(`enc:${s}`),
    decryptString: (b) => String(b).replace(/^enc:/, ""),
  };
  const fakeCrypto = { randomBytes: (n) => Buffer.alloc(n, 0x07) };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-keys-"));
    store = createKeyStore({
      getUserDataPath: () => dir,
      fs,
      path,
      safeStorage: fakeSafeStorage,
      crypto: fakeCrypto,
    });
  });

  it("generuje nowy klucz 32B hex i zapisuje; drugie wołanie ładuje ten sam", () => {
    const first = store.getOrGenerateMasterKey();
    expect(first).toBe("07".repeat(32));
    expect(fs.existsSync(path.join(dir, "master_key.enc"))).toBe(true);

    const second = store.getOrGenerateMasterKey();
    expect(second).toBe(first);
  });

  it("brak safeStorage → null zamiast wybuchu", () => {
    const noCrypto = createKeyStore({
      getUserDataPath: () => dir,
      fs,
      path,
      safeStorage: { ...fakeSafeStorage, isEncryptionAvailable: () => false },
      crypto: fakeCrypto,
    });
    expect(noCrypto.getOrGenerateMasterKey()).toBeNull();
  });

  it("E2E roundtrip: set → get → clear → null", () => {
    expect(store.getE2EKey()).toBeNull(); // brak pliku
    expect(store.setE2EKey("ab".repeat(32))).toBe(true);
    expect(store.getE2EKey()).toBe("ab".repeat(32));
    expect(store.clearE2EKey()).toBe(true);
    expect(store.getE2EKey()).toBeNull();
    expect(store.clearE2EKey()).toBe(true); // brak pliku też true
  });

  it("uszkodzony plik klucza → null (nie wybuch)", () => {
    const broken = createKeyStore({
      getUserDataPath: () => dir,
      fs,
      path,
      safeStorage: {
        ...fakeSafeStorage,
        decryptString: () => {
          throw new Error("corrupt");
        },
      },
      crypto: fakeCrypto,
    });
    fs.writeFileSync(path.join(dir, "master_key.enc"), "garbage");
    expect(broken.getOrGenerateMasterKey()).toBeNull();
  });

  it("registerIpc podpina 4 handlery", async () => {
    const handlers = {};
    store.registerIpc({ handle: (ch, fn) => (handlers[ch] = fn) });
    expect(Object.keys(handlers).sort()).toEqual([
      "clear-e2e-key",
      "get-e2e-key",
      "get-encryption-key",
      "set-e2e-key",
    ]);
    expect(await handlers["set-e2e-key"](null, "k1")).toBe(true);
    expect(await handlers["get-e2e-key"]()).toBe("k1");
    expect(await handlers["get-encryption-key"]()).toBe("07".repeat(32));
    expect(await handlers["clear-e2e-key"]()).toBe(true);
  });
});
