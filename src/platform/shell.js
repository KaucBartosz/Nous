// src/platform/shell.js — ShellPolicy (A2): polityka powłoki per tryb.
// Mówi językiem domeny (gość, historia, kartoteka), nie IPC/DOM.
// app.js tylko stosuje politykę; cała manipulacja document żyje tutaj.
import { Notify } from "../notify/notify.js";

const HISTORY_WEB_MESSAGE =
  "Historia wyników dostępna jest tylko w aplikacji Desktopowej. Z poziomu przeglądarki plik .csv jest generowany od razu po badaniu.";
const UPDATES_WEB_MESSAGE =
  "Zarządzanie aktualizacjami dotyczy wyłącznie aplikacji Desktopowej.";
const HEADER_WEB_WARNING =
  "[Wersja Przeglądarkowa - Wyniki mogą być mniej precyzyjne]";

/**
 * Czysta polityka powłoki (testowalna bez DOM).
 * Web: gość bez logowania, część funkcji ukryta/zablokowana, blokada dotyku.
 * Desktop/Electron/Fake: pełna powłoka.
 */
export function shellPolicyFor(kind) {
  if (kind === "web") {
    return {
      kind: "web",
      guestAutoLogin: true,
      blockTouchDevices: true,
      disableTagButtons: true,
      headerWarning: HEADER_WEB_WARNING,
      disabledNav: [
        { key: "navHistory", message: HISTORY_WEB_MESSAGE },
        { key: "navUpdates", message: UPDATES_WEB_MESSAGE },
      ],
      hiddenElementKeys: ["btnLogout", "syncToggleContainer"],
      hiddenSelectors: [".participants-panel"],
      hiddenIds: ["btn-save-to-registry"],
    };
  }
  return {
    kind: "desktop",
    guestAutoLogin: false,
    blockTouchDevices: false,
    disableTagButtons: false,
    headerWarning: null,
    disabledNav: [],
    hiddenElementKeys: [],
    hiddenSelectors: [],
    hiddenIds: [],
  };
}

export function isTouchDevice(win = window, nav = navigator) {
  return (
    "ontouchstart" in win ||
    (nav && (nav.maxTouchPoints > 0 || nav.msMaxTouchPoints > 0))
  );
}

function disableNavButton(el, message, notify) {
  if (!el) return;
  el.style.opacity = "0.5";
  el.style.cursor = "not-allowed";
  el.title = message;
  el.addEventListener(
    "click",
    (e) => {
      if (e.currentTarget === el) {
        e.stopImmediatePropagation();
        e.preventDefault();
        notify.info(message);
      }
    },
    true,
  );
}

/**
 * Stosuje politykę na żywym DOM. Zwraca true gdy boot ma się zatrzymać
 * (blokada dotykowa przejęła body — jak wcześniej `return` w app.js).
 */
export function applyShellPolicy(policy, { elements = {}, notify = Notify } = {}) {
  if (policy.blockTouchDevices && isTouchDevice()) {
    document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#0f172a; color:white; padding:40px; text-align:center; font-family:sans-serif;">
                    <span class="material-icons" style="font-size:64px; color:#ff9800; margin-bottom:20px;">mouse</span>
                    <h2 style="margin-bottom:10px;">Aplikacja niedostępna na ekranach dotykowych</h2>
                    <p style="color:#94a3b8; max-width:400px; line-height:1.5;">Wersja przeglądarkowa platformy Nous wymaga użycia komputera z kursorem myszy i/lub klawiaturą ze względu na specyfikę testów psychometrycznych.</p>
                </div>
            `;
    return true;
  }

  if (policy.disableTagButtons) {
    const webStyles = document.createElement("style");
    webStyles.innerHTML = `.tag-btn { opacity: 0.3 !important; pointer-events: none !important; }`;
    document.head.appendChild(webStyles);
  }

  if (policy.headerWarning) {
    const titleDiv = document.querySelector(".header-title");
    if (titleDiv) {
      const warning = document.createElement("span");
      warning.style.cssText =
        "color: #ff9800; font-size: 11px; margin-left: 10px; font-weight: normal;";
      warning.textContent = policy.headerWarning;
      titleDiv.appendChild(warning);
    }
  }

  for (const { key, message } of policy.disabledNav) {
    disableNavButton(elements[key], message, notify);
  }

  for (const key of policy.hiddenElementKeys) {
    if (elements[key]) elements[key].style.display = "none";
  }
  for (const selector of policy.hiddenSelectors) {
    const el = document.querySelector(selector);
    if (el) el.style.display = "none";
  }
  for (const id of policy.hiddenIds) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  return false;
}
