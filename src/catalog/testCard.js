// src/catalog/testCard.js — Karta Katalogu (A+B): głęboki moduł Biblioteki testów.
// Własność: status dystrybucyjny + klocki karty (ikona/tytuł/opis/wersja/przycisk/tag)
// + maszyna stanów przycisku startu (progress/busy).
// Czysty DOM: zero importów auth/Firestore — testowalny w happy-dom bez mocków.
// Cztery renderery w `library.js` tylko układają te klocki w kontenerach.

/**
 * Deskryptor statusu testu (dane dla renderu, nie elementy).
 * Przeniesione 1:1 z `library.js` — jedyne źródło prawdy o ikonie/przycisku/tekście.
 */
export function getTestStatus(t) {
  const local_ver = t.local_ver;
  const remote_ver = t.remote_ver;

  if (t.isLocalDev) {
    return {
      iconName: "code",
      iconColor: "#2196f3",
      iconTitle: "Wersja Lokalna (Deweloperska)",
      btnText: "Uruchom (Dev)",
      btnClass: "secondary",
      statusText: "Lokalny",
      versionParam: local_ver,
      isDownloadOnly: false,
    };
  }

  if (local_ver === 0) {
    return {
      iconName: "cloud_download",
      iconColor: "#888",
      iconTitle: "Nie pobrano",
      btnText: "Pobierz",
      btnClass: "primary",
      statusText: "Nie pobrano",
      versionParam: remote_ver,
      isDownloadOnly: true,
    };
  } else if (local_ver < remote_ver) {
    return {
      iconName: "system_update",
      iconColor: "#ff9800",
      iconTitle: "Dostępna aktualizacja",
      btnText: "Uruchom",
      btnClass: "outline",
      statusText: "Aktualizacja dostępna",
      versionParam: local_ver,
      isDownloadOnly: false,
    };
  } else {
    return {
      iconName: "check_circle",
      iconColor: "#4caf50",
      iconTitle: "Zainstalowano",
      btnText: "Uruchom",
      btnClass: "primary",
      statusText: "Zainstalowano",
      versionParam: local_ver,
      isDownloadOnly: false,
    };
  }
}

/**
 * Ikona „assignment" (grid + list). Bez rozmiaru = goły span jak w liście
 * (rozmiar z CSS); grid woła z '40px' + #444 jak wcześniej.
 */
export function buildAppIcon(size = null) {
  const el = document.createElement("span");
  el.className = "material-icons";
  if (size) el.style.cssText = `font-size:${size}; color:#444;`;
  el.textContent = "assignment";
  return el;
}

/**
 * Ikona statusu. `fontSize=null` = bez inline-rozmiaru (jak widok compact).
 */
export function buildStatusIcon(status, fontSize = null) {
  const el = document.createElement("span");
  el.className = "material-icons";
  el.style.color = status.iconColor;
  if (fontSize) el.style.fontSize = fontSize;
  el.title = status.iconTitle;
  el.textContent = status.iconName;
  return el;
}

/** Kolorowy podpis statusu (widok list + tabela). */
export function buildStatusText(status) {
  const el = document.createElement("span");
  el.style.color = status.iconColor;
  el.textContent = status.statusText;
  return el;
}

/**
 * Przycisk startu: `btn {btnClass} small` (compact: icon-only `compact`,
 * ikona 14px, bez tekstu — jak wcześniej). Klik woła `onStart(t, status)`.
 */
export function buildStartButton(t, status, { compact = false, onStart = null } = {}) {
  const testId = t.id;
  const button = document.createElement("button");
  button.className = compact ? `btn ${status.btnClass} compact` : `btn ${status.btnClass} small`;
  button.id = `start-test-${testId}`;

  const playIcon = document.createElement("span");
  playIcon.className = "material-icons";
  if (compact) playIcon.style.fontSize = "14px";
  playIcon.textContent = "play_arrow";

  button.appendChild(playIcon);
  if (!compact) button.appendChild(document.createTextNode(` ${status.btnText}`));

  if (onStart) {
    button.addEventListener("click", () => onStart(t, status));
  }
  return button;
}

/**
 * Klocki karty jednego testu. Renderer dokłada kontener i 1-linijkowe
 * tweaki layoutu (klasa/kolor/margines) — cała reszta pochodzi stąd.
 * @param {object} t — test po merge wersji (id/name/description/version/...)
 * @param {object} opts — { iconSize, appIcon: false|true|'40px', tagBtn=null, compactButton=false, onStart=null }
 *   appIcon: false = brak ikony (tabela/compact), true = goła (lista), string = rozmiar (grid)
 */
export function cardParts(t, { iconSize = null, appIcon = false, tagBtn = null, compactButton = false, onStart = null } = {}) {
  const status = getTestStatus(t);

  const titleEl = document.createElement("h4");
  titleEl.textContent = t.name || "Bez nazwy";

  const descEl = document.createElement("p");
  descEl.textContent = t.description || "Brak opisu";

  const versionEl = document.createElement("span");
  versionEl.textContent = `v${t.version}`;

  return {
    status,
    testId: t.id,
    appIcon:
      appIcon === false ? null : buildAppIcon(typeof appIcon === "string" ? appIcon : null),
    statusIcon: buildStatusIcon(status, iconSize),
    statusText: buildStatusText(status),
    titleEl,
    descEl,
    versionEl,
    button: buildStartButton(t, status, { compact: compactButton, onStart }),
    tagBtn,
  };
}

// ==========================================================
// Maszyna stanów przycisku (B): jeden kanoniczny szablon
// zamiast 3 ręcznych łańcuchów HTML (library ×2, updates ×2, + web).
// Świadoma unifikacja: wszędzie ten sam shell (spin + tekst +
// zielony pasek 4px); bez procentu pasek znika (stany „busy").
// ==========================================================

/**
 * Pełny render stanu przycisku: busy (label, bez paska) lub postęp (label + pasek).
 * @param {HTMLElement} btn
 * @param {object} state — { label: string, percent: number|null }
 */
export function setTestButtonState(btn, { label, percent = null } = {}) {
  btn.disabled = true;
  btn.style.position = "relative";
  btn.style.overflow = "hidden";

  const bar =
    percent === null || percent === undefined
      ? ""
      : `<div style="position:absolute; bottom:0; left:0; width:100%; height:4px; background:rgba(0,0,0,0.3);">` +
        `<div class="progress-bar" style="width:${percent}%; height:100%; background:#4caf50;"></div></div>`;

  btn.innerHTML =
    `<div style="display:flex; align-items:center; gap:5px; z-index:1; position:relative;">` +
    `<span class="material-icons spin">sync</span>` +
    `<span class="progress-text">${label}</span></div>` +
    bar;
}

/**
 * Szybka ścieżka postępu: aktualizacja w miejscu gdy szablon już jest,
 * inaczej pełny render. Jedna funkcja dla library i updates.
 */
export function setTestButtonProgress(btn, percent) {
  const progressText = btn.querySelector(".progress-text");
  const progressBar = btn.querySelector(".progress-bar");

  if (progressText && progressBar) {
    progressText.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
  } else {
    setTestButtonState(btn, { label: `${percent}%`, percent });
  }
}
