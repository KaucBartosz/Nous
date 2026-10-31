// src/platform/shell.js — ShellPolicy (A2): polityka powłoki per tryb.
// Mówi językiem domeny (gość, historia, aktualizacje), nie IPC/DOM.
// app.js tylko stosuje politykę; cała manipulacja document żyje tutaj.
import { Notify } from "../notify/notify.js";

const COMPACT_UPDATES_MESSAGE =
  "Zarządzanie aktualizacjami dotyczy wyłącznie aplikacji Desktopowej.";

/** Sposób traktowania urządzeń dotykowych. */
export const TouchMode = Object.freeze({
  NONE: "none",
  WARN: "warn",
  BLOCK: "block",
});

/**
 * Czysta decyzja o trybie dotyku (testowalna bez DOM).
 * - brak dotyku              → NONE
 * - tablet / telefon         → BLOCK  (coarse + brak hover)
 * - laptop 2-w-1 z dotykiem  → WARN   (interfejs działa, testy mogą nie)
 */
export function touchModeFor({ touch = false, coarse = false, hoverNone = false } = {}) {
  if (!touch) return TouchMode.NONE;
  if (coarse && hoverNone) return TouchMode.BLOCK;
  return TouchMode.WARN;
}

/**
 * Czysta polityka powłoki (testowalna bez DOM).
 * Web: gość bez logowania, dotyk dozwolony z ostrzeżeniem, Aktualizacje ukryte.
 * Desktop/Electron/Fake: pełna powłoka.
 */
export function shellPolicyFor(kind) {
  if (kind === "web") {
    return {
      kind: "web",
      guestAutoLogin: true,
      touch: "warn",
      disableTagButtons: false,
      // Ukryte, bo w Web nie mają żadnego działania (zamiast martwych przycisków).
      hiddenNav: ["navUpdates"],
      disabledNav: [],
      hiddenElementKeys: ["btnLogout", "syncToggleContainer"],
      hiddenSelectors: [".participants-panel"],
      hiddenIds: ["btn-save-to-registry", "desktop-settings"],
      compactUpdatesMessage: COMPACT_UPDATES_MESSAGE,
      historyNotice:
        "Wyniki są przechowywane tylko w tej przeglądarce (na tym komputerze). " +
        "Nie trafiają na serwer. Wyczyszczenie danych przeglądania usunie je — " +
        "pobierz kopię, jeśli chcesz je zachować.",
    };
  }
  return {
    kind: "desktop",
    guestAutoLogin: false,
    touch: "off",
    disableTagButtons: false,
    hiddenNav: [],
    disabledNav: [],
    hiddenElementKeys: [],
    hiddenSelectors: [],
    hiddenIds: [],
    compactUpdatesMessage: COMPACT_UPDATES_MESSAGE,
    historyNotice: null,
  };
}

export function isTouchDevice(win = window, nav = navigator) {
  return (
    "ontouchstart" in win ||
    (nav && (nav.maxTouchPoints > 0 || nav.msMaxTouchPoints > 0))
  );
}

function mediaMatches(win, query) {
  try {
    return win.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** Sygnały dotyku z żywego środowiska (jedyne miejsce czytające matchMedia). */
export function detectTouchMode(win = window, nav = navigator) {
  return touchModeFor({
    touch: isTouchDevice(win, nav),
    coarse: mediaMatches(win, "(pointer: coarse)"),
    hoverNone: mediaMatches(win, "(hover: none)"),
  });
}

const BLOCK_SCREEN_HTML = `
  <div class="shell-block">
      <span class="material-icons shell-block__icon">tablet_mac</span>
      <h2 class="shell-block__title">Ta wersja nie obsługuje tabletów</h2>
      <p class="shell-block__text">
          Wersja przeglądarkowa platformy Nous wymaga komputera z myszą i/lub
          klawiaturą ze względu na specyfikę testów psychometrycznych.
      </p>
      <p class="shell-block__text">
          Na tablecie użyj aplikacji desktopowej Nous.
      </p>
  </div>`;

const TOUCH_NOTICE_TEXT =
  "Nawigacja i interfejs działają dotykiem, ale wiele testów psychometrycznych " +
  "nie obsługuje ekranu dotykowego — do ich wykonania potrzebna będzie mysz " +
  "i/lub klawiatura.";

function renderTouchNotice(notify) {
  if (document.getElementById("touch-notice")) return;
  const notice = document.createElement("div");
  notice.id = "touch-notice";
  notice.className = "touch-notice";
  notice.setAttribute("role", "status");

  const icon = document.createElement("span");
  icon.className = "material-icons touch-notice__icon";
  icon.textContent = "touch_app";

  const text = document.createElement("p");
  text.className = "touch-notice__text";
  text.textContent = TOUCH_NOTICE_TEXT;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "touch-notice__close";
  close.setAttribute("aria-label", "Ukryj ostrzeżenie o trybie dotykowym");
  close.textContent = "Rozumiem";
  close.addEventListener("click", () => notice.remove());

  notice.append(icon, text, close);
  document.body.prepend(notice);
  notify?.info?.("Tryb dotykowy: część testów wymaga myszy lub klawiatury.");
}

function hideNavButton(el) {
  if (!el) return;
  el.style.display = "none";
}

function renderHistoryNotice(text) {
  const host = document.getElementById("history-view");
  if (!host || document.getElementById("history-storage-notice")) return;
  const notice = document.createElement("div");
  notice.id = "history-storage-notice";
  notice.className = "storage-notice";
  notice.setAttribute("role", "note");
  const icon = document.createElement("span");
  icon.className = "material-icons storage-notice__icon";
  icon.textContent = "computer";
  const body = document.createElement("p");
  body.className = "storage-notice__text";
  body.textContent = text;
  notice.append(icon, body);
  host.prepend(notice);
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
 * (blokada tabletów przejęła body — wcześniej `return` w app.js).
 */
export function applyShellPolicy(policy, { elements = {}, notify = Notify } = {}) {
  if (policy.touch !== "off") {
    const mode = detectTouchMode();
    if (mode === TouchMode.BLOCK) {
      document.body.innerHTML = BLOCK_SCREEN_HTML;
      return true;
    }
    if (mode === TouchMode.WARN) renderTouchNotice(notify);
  }

  if (policy.disableTagButtons) {
    const webStyles = document.createElement("style");
    webStyles.textContent =
      ".tag-btn { opacity: 0.3 !important; pointer-events: none !important; }";
    document.head.appendChild(webStyles);
  }

  for (const key of policy.hiddenNav) hideNavButton(elements[key]);

  if (policy.historyNotice) renderHistoryNotice(policy.historyNotice);

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
