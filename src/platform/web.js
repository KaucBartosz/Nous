// src/platform/web.js — adapter Web (przeglądarka, bez Electron)
function registryToVersions(registry) {
  const out = {};
  (registry || []).forEach((t) => {
    out[t.id] = {
      version: t.version || 1,
      isLocalDev: false,
      name: t.name,
      description: t.description,
      webPath: t.path || "",
    };
  });
  return out;
}

export function createWebPlatform(deps = {}) {
  const fetchFn = deps.fetchFn || ((...a) => fetch(...a));
  const openFn = deps.openFn || ((url, target) => window.open(url, target));

  async function getLocalVersions() {
    try {
      const res = await fetchFn("tests-registry.json");
      if (!res.ok) return {};
      return registryToVersions(await res.json());
    } catch (e) {
      console.warn("WebPlatform: błąd tests-registry.json", e);
      return {};
    }
  }

  const platform = {
    kind: "web",
    isMac: false,
    isLinux: false,
    isWeb: true,

    tests: {
      run: async ({ id, trainingMode } = {}) => {
        const versions = await getLocalVersions();
        const info = versions[id];
        if (info && info.webPath) {
          try { sessionStorage.setItem("nous_web_current_test_id", id); } catch (e) {}
          try { sessionStorage.setItem("nous_web_training_mode", !!trainingMode); } catch (e) {}
          openFn(info.webPath, "_blank");
          return { opened: true };
        }
        return { opened: false, reason: "missing-webPath" };
      },
      getLocalVersions,
      deleteTest: async () => ({ success: false, error: "Niedostępne w Web" }),
      onProgress: () => () => {},
      onInstalled: () => () => {},
      onProcessStopped: () => () => {},
      onResults: (cb) => {
        const h = (event) => {
          if (event.origin !== window.location.origin) return;
          if (event.data && event.data.type === "test-results") cb(event.data.data);
        };
        window.addEventListener("message", h);
        return () => window.removeEventListener("message", h);
      },
      onStatus: () => () => {},
      saveResultToDisk: () => {},
    },

    keys: {
      getEncryptionKey: async () => null,
      getE2EKey: async () => null,
      setE2EKey: async () => false,
      clearE2EKey: async () => false,
    },

    files: {
      bulkZip: async () => ({ success: false, error: "Niedostępne w Web — CSV generowany lokalnie" }),
      exportTemplate: async (data) => {
        const safeName = (data && data.name ? String(data.name) : "szablon").replace(/[^a-z0-9]/gi, "_");
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 100);
        return { success: true };
      },
      importTemplate: () => new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) { resolve({ success: false, cancelled: true }); return; }
          const reader = new FileReader();
          reader.onload = (ev) => {
            try {
              resolve({ success: true, data: JSON.parse(ev.target.result) });
            } catch (err) {
              resolve({ success: false, error: "Nieprawidłowy plik JSON" });
            }
          };
          reader.onerror = () => resolve({ success: false, error: "Błąd odczytu pliku" });
          reader.readAsText(file);
        };
        input.click();
      }),
    },

    links: {
      openExternal: (url) => openFn(url, "_blank"),
    },

    updates: {
      check: () => {},
      download: () => {},
      install: () => {},
      getVersion: async () => "web",
      onChecking: () => () => {},
      onAvailable: () => () => {},
      onNotAvailable: () => () => {},
      onError: () => () => {},
      onDownloadProgress: () => () => {},
      onDownloaded: () => () => {},
    },
  };

  return platform;
}
