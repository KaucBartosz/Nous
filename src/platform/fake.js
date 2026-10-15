// src/platform/fake.js — adapter pamięciowy dla testów (vitest)
export function createFakePlatform(seed = {}) {
  const calls = [];
  const versions = { ...(seed.versions || {}) };
  let e2eKey = seed.e2eKey ?? null;
  const encryptionKey = seed.encryptionKey ?? "fake-encryption-key";
  const listeners = { progress: [], installed: [], stopped: [], results: [], status: [] };

  function rec(name, args) { calls.push({ name, args }); }

  return {
    kind: "fake",
    isMac: false,
    isLinux: false,
    isWeb: false,
    calls,
    versions,

    // A1: fake umie wszystko (testy weryfikują flow desktopowy).
    capabilities: {
      canDownload: true,
      canDelete: true,
      canRunLocalDev: true,
    },

    tests: {
      download: async (o) => { rec("tests.download", o); return { queued: true, fake: true }; },
      run: async (o) => { rec("tests.run", o); return { opened: true, fake: true }; },
      getLocalVersions: async () => { rec("tests.getLocalVersions", null); return { ...versions }; },
      deleteTest: async (id) => { rec("tests.deleteTest", id); delete versions[id]; return { success: true }; },
      onProgress: (cb) => { listeners.progress.push(cb); return () => {}; },
      onInstalled: (cb) => { listeners.installed.push(cb); return () => {}; },
      onProcessStopped: (cb) => { listeners.stopped.push(cb); return () => {}; },
      onResults: (cb) => { listeners.results.push(cb); return () => {}; },
      onStatus: (cb) => { listeners.status.push(cb); return () => {}; },
      saveResultToDisk: (d) => { rec("tests.saveResultToDisk", d); },
      __emitResults: (data) => listeners.results.forEach((cb) => cb(data)),
    },

    keys: {
      getEncryptionKey: async () => { rec("keys.getEncryptionKey", null); return encryptionKey; },
      getE2EKey: async () => { rec("keys.getE2EKey", null); return e2eKey; },
      setE2EKey: async (k) => { rec("keys.setE2EKey", k); e2eKey = k; return true; },
      clearE2EKey: async () => { rec("keys.clearE2EKey", null); e2eKey = null; return true; },
    },

    files: {
      bulkZip: async (o) => { rec("files.bulkZip", o); return { success: true, fake: true }; },
      exportTemplate: async (d) => { rec("files.exportTemplate", d); return { success: true }; },
      importTemplate: async () => { rec("files.importTemplate", null); return { success: true, data: null }; },
      getDownloadsDir: async () => { rec("files.getDownloadsDir", null); return "/tmp/fake-downloads"; },
      pickDownloadFolder: async () => ({ cancelled: true }),
      setSilentMode: (mode) => { rec("files.setSilentMode", mode); },
    },

    links: {
      openExternal: (url) => { rec("links.openExternal", url); },
    },

    updates: {
      check: () => { rec("updates.check", null); },
      download: () => { rec("updates.download", null); },
      install: () => { rec("updates.install", null); },
      getVersion: async () => "0.0.0-fake",
      onChecking: () => () => {},
      onAvailable: () => () => {},
      onNotAvailable: () => () => {},
      onError: () => () => {},
      onDownloadProgress: () => () => {},
      onDownloaded: () => () => {},
    },
  };
}
