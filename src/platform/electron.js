// src/platform/electron.js — adapter Electron (deleguje do window.electronAPI z preload.js)
import { t } from "../i18n/index.js";

/**
 * Tłumaczy zdarzenia `test-status` z main. Main nie zna języka interfejsu,
 * więc wysyła kody ({ code, params?, error? }); starsze stringi przechodzą bez zmian.
 */
export function formatTestStatus(message) {
  if (!message || typeof message !== "object" || !message.code) return message;
  const key = message.code === "error" ? "testStatus.error" : `testStatus.${message.code}`;
  const params = { ...(message.params || {}) };
  if (message.error) {
    params.error = t(`testStatus.error.${message.error}`);
  }
  return t(key, params);
}

/** Nagłówki CSV dla main (main nie zna języka interfejsu). */
function csvLabels() {
  return {
    date: t("csv.date"),
    testId: t("csv.testId"),
    subjectId: t("csv.subjectId"),
    researcherUid: t("csv.researcherUid"),
    demographics: t("csv.demographics"),
    result: t("csv.result"),
    parameter: t("csv.parameter"),
    value: t("csv.value"),
  };
}

const ERROR_CODES = new Set([
  "error",
  "invalidTestId",
  "httpsOnly",
  "ownerOnly",
  "forbiddenDomain",
  "invalidUrl",
  "queueBusy",
  "packageTooLarge",
  "zipReadError",
  "zipError",
  "networkError",
  "tooManyRedirects",
  "httpError",
  "missingEntry",
]);

/**
 * true gdy zdarzenie `test-status` zgłasza błąd. Legenda: main nadaje kod
 * (renderer go tłumaczy), więc klasyfikacja nie zależy od języka interfejsu.
 */
export function isTestStatusError(message) {
  if (!message || typeof message !== "object") return false;
  return ERROR_CODES.has(message.code);
}

export function createElectronPlatform(api) {
  const a = api || (typeof window !== "undefined" ? window.electronAPI : null);
  if (!a) throw new Error("ElectronPlatform: brak window.electronAPI");

  const noop = () => {};
  const on = (fn, cb) => (typeof fn === "function" ? fn(cb) : noop());

  return {
    kind: "electron",
    isMac: !!a.isMac,
    isLinux: !!a.isLinux,
    isWeb: false,

    // A1: deklaratywne zdolności platformy — wołający pytają caps, nie kind.
    capabilities: {
      canDownload: true,
      canDelete: true,
      canRunLocalDev: true,
      canBulkZip: true,
    },

    tests: {
      download: (o) =>
        a.downloadTest({
          url: o.url,
          testId: o.id,
          version: o.ver,
          testName: o.name || "",
          testDescription: o.description || "",
        }),
      run: (o) => a.runTest(o.id),
      // Okno testu dostaje język przy starcie (preload_test.js).
      setUiLanguage: (lang) => a.setUiLanguage(lang),
      getLocalVersions: () => a.getLocalVersions(),
      deleteTest: (id) => a.deleteTest(id),
      onProgress: (cb) => on(a.onDownloadProgress, cb),
      onInstalled: (cb) => on(a.onTestInstalled, cb),
      onProcessStopped: (cb) => on(a.onTestProcessStopped, cb),
      onResults: (cb) => on(a.onTestResults, cb),
      onStatus: (cb) => on(a.onStatusUpdate, (m) => cb(formatTestStatus(m))),
      // Main dokleja test_id i timestamp; basename zależy od języka (Result_/Wynik_).
      saveResultToDisk: (d) =>
        a.saveResultToDisk({
          ...d,
          dialogTitle: t("main.saveResultTitle"),
          fileBaseName: t("main.saveResultPrefix"),
        }),
    },

    keys: {
      getEncryptionKey: () => a.getEncryptionKey(),
      getE2EKey: () => a.getE2EKey(),
      setE2EKey: (k) => a.setE2EKey(k),
      clearE2EKey: () => a.clearE2EKey(),
    },

    files: {
      bulkZip: (o) =>
        a.downloadBulkZip({
          ...o,
          dialogTitle: t("main.saveZipTitle"),
          labels: csvLabels(),
        }),
      exportTemplate: (d) => a.exportTemplate(d, t("main.exportTemplateTitle")),
      importTemplate: () => a.importTemplate(t("main.importTemplateTitle")),
      // Ciche pobieranie (opcja w Ustawieniach; preload + main/silentDownloads).
      getDownloadsDir: () => a.getDownloadsPath(),
      pickDownloadFolder: (current) =>
        a.pickDownloadFolder({ current, title: t("main.chooseDownloadFolder") }),
      setSilentMode: (mode) => a.setSilentDownloads(mode),
    },

    links: {
      openExternal: (url) => a.openExternal(url),
    },

    updates: {
      check: () => a.checkAppUpdate(),
      download: () => a.downloadAppUpdate(),
      install: () => a.installAppUpdate(),
      getVersion: () => a.getAppVersion(),
      onChecking: (cb) => on(a.onAppUpdateChecking, cb),
      onAvailable: (cb) => on(a.onAppUpdateAvailable, cb),
      onNotAvailable: (cb) => on(a.onAppUpdateNotAvailable, cb),
      onError: (cb) => on(a.onAppUpdateError, cb),
      onDownloadProgress: (cb) => on(a.onAppDownloadProgress, cb),
      onDownloaded: (cb) => on(a.onAppUpdateDownloaded, cb),
    },
  };
}
