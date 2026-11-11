// src/platform/web.js — adapter Web (przeglądarka, bez Electron)
import { t } from "../i18n/index.js";

/**
 * URL meta.json obok testu. Rejestr podaje ścieżkę do index.html, a meta.json
 * leży w tym samym folderze (np. tests/BystreOczko/meta.json).
 */
function metaUrlFor(entry) {
  const webPath = entry.path || "";
  if (webPath) {
    if (/index\.html?$/i.test(webPath)) return webPath.replace(/index\.html?$/i, "meta.json");
    return `${webPath.replace(/\/+$/, "")}/meta.json`;
  }
  return entry.id ? `tests/${entry.id}/meta.json` : "";
}

/** meta.json jest opcjonalny — brak pliku nie może wywalić katalogu. */
async function fetchMeta(fetchFn, url) {
  if (!url) return null;
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    const meta = await res.json();
    return meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
  } catch (e) {
    return null;
  }
}

/**
 * Rejestr (id/version/path) + meta.json każdego testu (nazwa i opis PL/EN).
 * Pola z meta.json mają pierwszeństwo; rejestr zostaje fallbackiem dla testów
 * bez meta.json (starsze paczki).
 */
async function registryToVersions(registry, fetchFn) {
  const entries = registry || [];
  const metas = await Promise.all(entries.map((entry) => fetchMeta(fetchFn, metaUrlFor(entry))));
  const out = {};
  entries.forEach((entry, i) => {
    const meta = metas[i] || {};
    const name = meta.name || entry.name || "";
    const nameEn = meta.name_en || meta.name || entry.name_en || entry.name || "";
    const descriptionPl =
      meta.description_pl || meta.description || entry.description_pl || entry.description || "";
    const descriptionEn =
      meta.description_en || meta.description || entry.description_en || entry.description || "";
    out[entry.id] = {
      version: entry.version || 1,
      isLocalDev: false,
      name,
      name_en: nameEn,
      description: descriptionPl,
      description_pl: descriptionPl,
      description_en: descriptionEn,
      webPath: entry.path || "",
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
      return await registryToVersions(await res.json(), fetchFn);
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

    // A1: Web serwuje testy dynamicznie — brak pobierania/usuwania/local-dev.
    capabilities: {
      canDownload: false,
      canDelete: false,
      canRunLocalDev: false,
      // Web: brak biblioteki archiwizującej — „Pobierz wszystko” to scalony CSV.
      canBulkZip: false,
    },

    storage: {
      /**
       * Prosi przeglądarkę o trwałe przechowywanie IndexedDB.
       * Bez tego dane mogą zostać usunięte przy braku miejsca.
       * @returns {Promise<boolean>} czy przeglądarka potwierdziła trwałość
       */
      requestPersistence: async () => {
        try {
          if (!navigator.storage || !navigator.storage.persist) return false;
          if (await navigator.storage.persisted()) return true;
          return await navigator.storage.persist();
        } catch {
          return false;
        }
      },
    },

    tests: {
      download: async () => ({ success: false, error: t("web.unavailable") }),
      run: async ({ id } = {}) => {
        const versions = await getLocalVersions();
        const info = versions[id];
        if (info && info.webPath) {
          openFn(info.webPath, "_blank");
          return { opened: true };
        }
        return { opened: false, reason: "missing-webPath" };
      },
      getLocalVersions,
      deleteTest: async () => ({ success: false, error: t("web.unavailable") }),
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
      // Web: test czyta język sam (localStorage w test-i18n-shim.js).
      setUiLanguage: () => {},
    },

    keys: {
      getEncryptionKey: async () => null,
      getE2EKey: async () => null,
      setE2EKey: async () => false,
      clearE2EKey: async () => false,
    },

    files: {
      bulkZip: async () => ({ success: false, error: t("web.bulkZipUnavailable") }),
      exportTemplate: async (data) => {
        const safeName = (data && data.name ? String(data.name) : "template").replace(/[^a-z0-9]/gi, "_");
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
              resolve({ success: false, error: t("web.invalidJson") });
            }
          };
          reader.onerror = () => resolve({ success: false, error: t("web.fileReadError") });
          reader.readAsText(file);
        };
        input.click();
      }),
      // Web: brak main-procesu — ciche pobieranie nie dotyczy (przeglądarka pyta sama).
      getDownloadsDir: async () => null,
      pickDownloadFolder: async () => ({ cancelled: true }),
      setSilentMode: () => {},
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
