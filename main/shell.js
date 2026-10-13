// main/shell.js — Shell (C6): otwieranie linków zewnętrznych.
// Przeniesione 1:1 z main.js. Walidacja protokołu czysta i testowana
// (zapobieganie SSRF przez shell.openExternal); shell wstrzyknięty.

const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:"];

/** Czysta predykata: czy URL wolno otworzyć w przeglądarce systemowej. */
function isAllowedExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function createShell({ shell }) {
  function openExternal(event, url) {
    // Dwa przypadki jak w main.js: zły URL vs zły protokół (osobne komunikaty).
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      console.error(`[Security] Nieprawidłowy URL w open-external: ${url}`);
      return;
    }
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      console.error(`[Security] Zablokowano open-external dla protokołu: ${parsed.protocol}`);
      return;
    }
    shell.openExternal(url);
  }

  function registerIpc(ipcMain) {
    ipcMain.on("open-external", (event, url) => openExternal(event, url));
  }

  return { isAllowedExternalUrl, openExternal, registerIpc };
}

module.exports = { createShell, isAllowedExternalUrl, ALLOWED_PROTOCOLS };
