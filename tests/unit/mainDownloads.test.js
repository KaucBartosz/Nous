import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import downloadsMod from "../../main/downloads.js";

const {
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
} = downloadsMod;

describe("main/downloads validators", () => {
  it("validateTestId: alfanumeryczne/_/- OK, reszta błąd", () => {
    expect(validateTestId("stroop-1_X")).toBeNull();
    expect(validateTestId("../evil")).toBe("BŁĄD: Nieprawidłowe ID testu!");
    expect(validateTestId("a b")).toBe("BŁĄD: Nieprawidłowe ID testu!");
    expect(validateTestId("")).toBe("BŁĄD: Nieprawidłowe ID testu!");
    expect(validateTestId(null)).toBe("BŁĄD: Nieprawidłowe ID testu!");
  });

  it("validateDownloadUrl: allowlista jak w download-and-run", () => {
    expect(validateDownloadUrl("https://github.com/KaucBartosz/BBTP/archive/refs/heads/main.zip")).toBeNull();
    expect(validateDownloadUrl("https://raw.githubusercontent.com/KaucBartosz/Nous/main/x.zip")).toBeNull();
    expect(validateDownloadUrl("https://objects.githubusercontent.com/abc123")).toBeNull();
    expect(validateDownloadUrl("http://github.com/KaucBartosz/x.zip")).toBe("BŁĄD: Tylko HTTPS!");
    expect(validateDownloadUrl("https://evil.com/KaucBartosz/x.zip")).toBe("BŁĄD: Niedozwolona domena!");
    expect(validateDownloadUrl("https://github.com/Other/x.zip")).toBe(
      "BŁĄD: Dozwolone są wyłącznie repozytoria KaucBartosz!",
    );
    expect(validateDownloadUrl("nie-url")).toBe("BŁĄD: Nieprawidłowy URL!");
  });

  it("SEC: granica domeny — podszywanie odrzucone, subdomeny działają", () => {
    expect(validateDownloadUrl("https://evilgithub.com/KaucBartosz/x.zip")).toBe(
      "BŁĄD: Niedozwolona domena!",
    );
    expect(validateDownloadUrl("https://evilraw.githubusercontent.com/KaucBartosz/x.zip")).toBe(
      "BŁĄD: Niedozwolona domena!",
    );
    // Legalne subdomeny (np. codeload z archiwami) + case-insensitive host
    expect(validateDownloadUrl("https://codeload.github.com/KaucBartosz/BBTP/zip/refs/heads/main")).toBeNull();
    expect(validateDownloadUrl("https://GITHUB.COM/KaucBartosz/x.zip")).toBeNull();
  });

  it("SEC: cele redirectów przez tę samą allowlistę", () => {
    expect(validateRedirectTarget(null)).toBeNull(); // brak Location → stara ścieżka Błąd HTTP
    expect(validateRedirectTarget("https://github.com/KaucBartosz/Nous/x.zip")).toBeNull();
    expect(validateRedirectTarget("https://objects.githubusercontent.com/hash")).toBeNull();
    expect(validateRedirectTarget("https://evil.com/x.zip")).toBe("BŁĄD: Niedozwolona domena!");
    expect(validateRedirectTarget("http://github.com/KaucBartosz/x.zip")).toBe("BŁĄD: Tylko HTTPS!");
  });

  it("SEC: strażnik rozmiaru przed AdmZip", () => {
    const MB = 1024 * 1024;
    expect(MAX_ZIP_BYTES).toBe(200 * MB);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-size-"));
    const small = path.join(dir, "s.zip");
    const big = path.join(dir, "b.zip");
    fs.writeFileSync(small, Buffer.alloc(10, 1));
    fs.writeFileSync(big, Buffer.alloc(3 * MB, 1));

    expect(checkDownloadedSize({ fs, zipPath: small })).toBeNull();
    expect(checkDownloadedSize({ fs, zipPath: big, limitBytes: 2 * MB })).toBe(
      "BŁĄD: Paczka przekracza limit 2 MB!",
    );
    expect(checkDownloadedSize({ fs, zipPath: path.join(dir, "brak.zip") })).toMatch(
      /^Błąd odczytu paczki: /,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("main/downloads zipSlip", () => {
  it("bezpieczne wpisy przechodzą, traversowanie rzuca", () => {
    const folder = path.join("ud", "tests_library", "t1");
    expect(() =>
      assertZipSafe([{ entryName: "index.html" }, { entryName: "sub/a.js" }], path, folder),
    ).not.toThrow();
    expect(() => assertZipSafe([{ entryName: "../evil.txt" }], path, folder)).toThrow(
      'Malicious ZIP detected! File "../evil.txt" attempts to traverse out of target directory.',
    );
    expect(() => assertZipSafe([{ entryName: "sub/../../evil.txt" }], path, folder)).toThrow(
      "Malicious ZIP",
    );
  });
});

describe("main/downloads cache (KROK 1)", () => {
  const setup = (meta) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-dl-"));
    const testFolder = path.join(dir, "t1");
    fs.mkdirSync(testFolder, { recursive: true });
    const metaPath = path.join(testFolder, "meta.json");
    if (meta !== undefined) fs.writeFileSync(metaPath, meta);
    const entryFile = path.join(testFolder, "index.html");
    fs.writeFileSync(entryFile, "x");
    return { dir, testFolder, metaPath, entryFile };
  };

  it("brak folderu → pobieraj; localDev → nigdy", () => {
    expect(
      checkCacheNeedsDownload({ fs, testFolder: "/nie/ma", metaPath: "/nie/ma", entryFile: null, version: 2, isLocalDev: false }),
    ).toBe(true);
    const { testFolder, metaPath, entryFile } = setup();
    expect(
      checkCacheNeedsDownload({ fs, testFolder, metaPath, entryFile, version: 2, isLocalDev: true }),
    ).toBe(false);
  });

  it("meta >= version → z dysku; starsza/uszkodzona → pobieraj", () => {
    const a = setup(JSON.stringify({ version: 3 }));
    expect(checkCacheNeedsDownload({ fs, testFolder: a.testFolder, metaPath: a.metaPath, entryFile: a.entryFile, version: 2, isLocalDev: false })).toBe(false);

    const b = setup(JSON.stringify({ version: 1 }));
    expect(checkCacheNeedsDownload({ fs, testFolder: b.testFolder, metaPath: b.metaPath, entryFile: b.entryFile, version: 2, isLocalDev: false })).toBe(true);

    const c = setup("nie-json{{{");
    expect(checkCacheNeedsDownload({ fs, testFolder: c.testFolder, metaPath: c.metaPath, entryFile: c.entryFile, version: 2, isLocalDev: false })).toBe(true);
  });
});

describe("main/downloads scan + delete", () => {
  it("scanLocalVersions: meta / brak mety / corrupt / brak katalogu", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-scan-"));
    const lib = path.join(dir, "tests_library");
    fs.mkdirSync(path.join(lib, "app1"), { recursive: true });
    fs.writeFileSync(path.join(lib, "app1", "meta.json"), JSON.stringify({ version: 2, name: "A", description: "D" }));
    fs.mkdirSync(path.join(lib, "app2"), { recursive: true });
    fs.mkdirSync(path.join(lib, "app3"), { recursive: true });
    fs.writeFileSync(path.join(lib, "app3", "meta.json"), "corrupt{{{");
    fs.writeFileSync(path.join(lib, "plik.txt"), "ignorowany");

    const out = scanLocalVersions({ fs, path, testsDir: lib });
    expect(out.__scannedDir).toBe(lib);
    expect(out.app1).toEqual({ version: 2, name: "A", description: "D", isLocalDev: false });
    expect(out.app2).toEqual({ version: 0, isLocalDev: true });
    expect(out.app3).toEqual({ version: 0, isLocalDev: true });
    expect(out).not.toHaveProperty("plik.txt");

    expect(scanLocalVersions({ fs, path, testsDir: path.join(dir, "brak") })).toEqual({
      __scannedDir: path.join(dir, "brak"),
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("deleteTestById: invalid / brak / sukces", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nous-del-"));
    const lib = path.join(dir, "tests_library");
    fs.mkdirSync(path.join(lib, "t1", "sub"), { recursive: true });
    fs.writeFileSync(path.join(lib, "t1", "sub", "f.txt"), "x");

    expect(deleteTestById({ fs, path, testsDir: lib, testId: "../x" })).toEqual({
      success: false,
      error: "Nieprawidłowe ID testu",
    });
    expect(deleteTestById({ fs, path, testsDir: lib, testId: "brak" })).toEqual({
      success: false,
      error: "Folder nie istnieje",
    });
    expect(deleteTestById({ fs, path, testsDir: lib, testId: "t1" })).toEqual({ success: true });
    expect(fs.existsSync(path.join(lib, "t1"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("main/downloads enqueue", () => {
  const stub = () => {
    const d = createDownloader({
      fs,
      path,
      https: {},
      AdmZip: function () {},
      getUserDataPath: () => "/ud",
      findStartFile: () => null,
      openTestWindow: () => {},
      isTestRunning: () => false,
    });
    return d;
  };
  const sender = { send: () => {} };

  it("OK → kolejka + active; duplikat odrzucony", () => {
    const d = stub();
    const task = { testId: "t1", url: "https://github.com/KaucBartosz/Nous/x.zip" };
    expect(d.enqueueDownload(task, sender)).toEqual({ ok: true });
    expect(d.queueState()).toEqual({ length: 1, busy: false, active: ["t1"] });
    expect(d.enqueueDownload(task, sender)).toEqual({
      ok: false,
      message: "Zadanie dla tego testu jest już w kolejce!",
    });
    expect(d.queueState().length).toBe(1);
  });

  it("złe ID i zły URL nie trafiają do kolejki; localDev omija URL", () => {
    const d = stub();
    expect(d.enqueueDownload({ testId: "../x", url: "https://github.com/KaucBartosz/Nous/x.zip" }, sender)).toEqual({
      ok: false,
      message: "BŁĄD: Nieprawidłowe ID testu!",
    });
    expect(
      d.enqueueDownload({ testId: "t2", url: "https://evil.com/x.zip" }, sender),
    ).toEqual({ ok: false, message: "BŁĄD: Niedozwolona domena!" });
    expect(d.enqueueDownload({ testId: "dev1", url: "śmieć", isLocalDev: true }, sender)).toEqual({
      ok: true,
    });
    expect(d.queueState().length).toBe(1);
  });
});
