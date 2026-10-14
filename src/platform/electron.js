// src/platform/electron.js — adapter Electron (deleguje do window.electronAPI z preload.js)
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
    },

    tests: {
      run: (o) =>
        a.downloadAndRun(o.url, o.id, o.ver, !!o.onlyDownload, !!o.trainingMode, o.name || "", o.description || "", !!o.isLocalDev),
      getLocalVersions: () => a.getLocalVersions(),
      deleteTest: (id) => a.deleteTest(id),
      onProgress: (cb) => on(a.onDownloadProgress, cb),
      onInstalled: (cb) => on(a.onTestInstalled, cb),
      onProcessStopped: (cb) => on(a.onTestProcessStopped, cb),
      onResults: (cb) => on(a.onTestResults, cb),
      onStatus: (cb) => on(a.onStatusUpdate, cb),
      saveResultToDisk: (d) => a.saveResultToDisk(d),
    },

    keys: {
      getEncryptionKey: () => a.getEncryptionKey(),
      getE2EKey: () => a.getE2EKey(),
      setE2EKey: (k) => a.setE2EKey(k),
      clearE2EKey: () => a.clearE2EKey(),
    },

    files: {
      bulkZip: (o) => a.downloadBulkZip(o),
      exportTemplate: (d) => a.exportTemplate(d),
      importTemplate: () => a.importTemplate(),
      // Ciche pobieranie (opcja w Ustawieniach; preload + main/silentDownloads).
      getDownloadsDir: () => a.getDownloadsPath(),
      pickDownloadFolder: (current) => a.pickDownloadFolder(current),
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
