// src/notify/notify.js — Notify (C5): głęboki moduł powiadomień.
// 1 konstruktor toastów (te same klasy/ID co wcześniej), adapter DOM + headless do testów.
let adapter = null; // null = prawdziwy DOM

export function setNotifyAdapter(a) {
  adapter = a;
}

export function resetNotifyAdapter() {
  adapter = null;
}

function domAdapter() {
  return {
    exists: (id) => !!document.getElementById(id),
    mount: (el) => document.body.appendChild(el),
    show: (el, ms = 100) => setTimeout(() => el.classList.add("show"), ms),
    dismiss: (el, ms = 400) => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), ms);
    },
    later: (fn, ms) => setTimeout(fn, ms),
  };
}

function ui() {
  return adapter || domAdapter();
}

/**
 * Toast: { id, titleHtml, messageHtml, actions: [{ id, label, primary, onClick }], autoDismissMs }
 * Zwraca true gdy pokazano, false gdy toast o tym id już wisi (guard jak wcześniej).
 */
export function toast({ id, titleHtml, messageHtml, actions = [], autoDismissMs = 0 }) {
  const u = ui();
  if (u.exists(id)) return false;

  const el = typeof document !== "undefined" ? document.createElement("div") : null;
  const spec = { id, titleHtml, messageHtml, actions: actions.map((a) => ({ id: a.id, label: a.label, primary: !!a.primary })) };
  if (!el) {
    u.mounted?.(spec);
    return true;
  }
  el.id = id;
  el.className = "toast-notification";
  el.innerHTML =
    `<div class="toast-content">` +
    `<div class="toast-header"><h4 class="toast-title">${titleHtml}</h4>` +
    `<button class="toast-close">&times;</button></div>` +
    `<p class="toast-message">${messageHtml}</p>` +
    (actions.length
      ? `<div class="toast-actions">` +
        actions.map((a) => `<button class="toast-btn${a.primary ? " primary" : ""}" id="${a.id}">${a.label}</button>`).join("") +
        `</div>`
      : "") +
    `</div>`;

  const close = () => u.dismiss(el);
  el.querySelector(".toast-close").addEventListener("click", close);
  actions.forEach((a) => {
    el.querySelector(`#${CSS.escape(a.id)}`)?.addEventListener("click", () => {
      if (a.onClick) a.onClick(close);
      else close();
    });
  });

  u.mount(el);
  u.show(el);
  if (autoDismissMs > 0) u.later(close, autoDismissMs);
  return true;
}

/** Polska odmiana "wynik/wyniki/wyników" (reguła z sync.showSyncToast). */
export function syncCountMessage(count) {
  return `Zsynchronizowano ${count} ${count === 1 ? "wynik" : count < 5 ? "wyniki" : "wyników"}.`;
}
