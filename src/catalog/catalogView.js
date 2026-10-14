// src/catalog/catalogView.js — CatalogView (A4): wspólny renderer widoków katalogu.
// Własność: wiązanie wyszukiwarki (debounce-once), postęp przycisków,
// komórki statusu/akcji tabeli aktualizacji. Biblioteka i Aktualizacje
// tylko podają dane + callbacki; zero ręcznego HTML w modułach widoków.
import { debounce } from "../modules/utils.js";
import { setTestButtonProgress } from "./testCard.js";
import { statusOf } from "./testCatalog.js";

const boundSearchInputs = new Set();

/**
 * Wiąże input wyszukiwarki raz (debounce). Idempotentne — drugie wołanie
 * z tym samym id to no-op (zastępuje flagi isSearchBound w 2 modułach).
 */
export function bindSearchInput(inputId, onSearch, delay = 200) {
  if (boundSearchInputs.has(inputId)) return false;
  const input = document.getElementById(inputId);
  if (!input) return false;
  const debounced = debounce((value) => onSearch(value), delay);
  input.addEventListener("input", (e) => debounced(e.target.value));
  boundSearchInputs.add(inputId);
  return true;
}

export function resetSearchBindings() {
  boundSearchInputs.clear();
}

/**
 * Wspólne okablowanie postępu pobierania: pasek na przycisku o prefiksie
 * + odświeżenie po instalacji. Zastępuje initLibraryListeners/initUpdatesListeners.
 */
export function bindCatalogProgress(platform, { progressIdPrefix, onInstalled }) {
  platform.tests.onProgress(({ test_id, percent }) => {
    const btn = document.getElementById(`${progressIdPrefix}${test_id}`);
    if (btn) setTestButtonProgress(btn, percent);
  });

  platform.tests.onInstalled((data) => {
    if (onInstalled) onInstalled(data);
  });
}

/** Etykieta + kolor statusu tabeli aktualizacji (1 reguła, była w 3 if-ach). */
export function updateStatusLabel(r) {
  switch (statusOf(r)) {
    case "missing":
      return { text: "Nie zainstalowano", color: "#888", bold: false };
    case "outdated":
      return {
        text: `Aktualizacja! (v${r.local_ver} → v${r.remote_ver})`,
        color: "#ff9800",
        bold: true,
      };
    case "localdev":
      return { text: "Lokalny (dev)", color: "#2196f3", bold: false };
    default:
      return { text: "Aktualne", color: "#4caf50", bold: false };
  }
}

export function buildUpdateStatusCell(r) {
  const cell = document.createElement("td");
  const span = document.createElement("span");
  const { text, color, bold } = updateStatusLabel(r);
  span.style.color = color;
  if (bold) span.style.fontWeight = "bold";
  span.textContent = text;
  cell.appendChild(span);
  return cell;
}

function smallButton({ id = null, className, icon, label, onClick, style = "" }) {
  const btn = document.createElement("button");
  btn.className = className;
  if (id) btn.id = id;
  if (style) btn.style.cssText = style;
  const iconEl = document.createElement("span");
  iconEl.className = "material-icons";
  iconEl.style.fontSize = "16px";
  iconEl.textContent = icon;
  btn.appendChild(iconEl);
  btn.appendChild(document.createTextNode(` ${label}`));
  btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Komórka akcji tabeli aktualizacji. Zachowuje 1:1 id/klasy/etykiety:
 * - missing → [Pobierz#force-update-id]
 * - outdated → [Aktualizuj#force-update-id] + [Usuń#delete-test-id]
 * - uptodate → [Aktualne disabled] + [Usuń#delete-test-id]
 */
export function buildUpdateActionCell(r, { onDownload, onDelete }) {
  const id = r.id;
  const cell = document.createElement("td");
  const status = statusOf(r);

  if (status === "missing") {
    cell.appendChild(
      smallButton({
        id: `force-update-${id}`,
        className: "btn primary small",
        icon: "download",
        label: "Pobierz",
        onClick: () => onDownload(r),
      }),
    );
    return cell;
  }

  if (status === "outdated") {
    cell.appendChild(
      smallButton({
        id: `force-update-${id}`,
        className: "btn primary small",
        icon: "system_update_alt",
        label: "Aktualizuj",
        onClick: () => onDownload(r),
      }),
    );
  } else {
    const current = document.createElement("button");
    current.className = "btn outline small";
    current.disabled = true;
    current.textContent = "Aktualne";
    cell.appendChild(current);
  }

  cell.appendChild(
    smallButton({
      id: `delete-test-${id}`,
      className: "btn danger small",
      icon: "delete",
      label: "Usuń",
      style: "margin-left:5px;",
      onClick: () => onDelete(id),
    }),
  );
  return cell;
}
