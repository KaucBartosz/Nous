// src/modules/modalSession.js
// Wspólna obsługa okien modalnych: pułapka focusu, kliknięcie tła, Escape,
// przywrócenie focusu i blokada przewijania tła.
// Świadomie bez atrybutów ARIA — ten UI nie jest przeznaczony do obsługi
// przez czytniki ekranu (badanie funkcji psychometrycznych, UI badacza).

const FOCUSABLE = [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[href]',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

let openCount = 0;

function focusableIn(overlay) {
    return Array.from(overlay.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.getClientRects?.().length !== 0,
    );
}

/**
 * Otwiera sesję modalną.
 * @param {HTMLElement} overlay
 * @param {object} [opts]
 * @param {Function} [opts.onDismiss] — wywołane przez Escape i kliknięcie tła
 * @param {string} [opts.focusSelector] — element, który ma dostać focus
 * @param {boolean} [opts.handleEscape=true] — false gdy okno ma własny handler Escape
 * @returns {{ close: Function }}
 */
export function openModalSession(overlay, { onDismiss, focusSelector, handleEscape = true } = {}) {
    if (!overlay) return { close() {} };

    const previousFocus =
        typeof document !== "undefined" ? document.activeElement : null;

    const onKeyDown = (event) => {
        if (event.key !== "Tab") return;
        const items = focusableIn(overlay);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !overlay.contains(active))) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !overlay.contains(active))) {
            event.preventDefault();
            first.focus();
        }
    };
    const onMouseDown = (event) => {
        if (event.target === overlay) onDismiss?.();
    };
    const onEscape = (event) => {
        if (event.key === "Escape") onDismiss?.();
    };

    overlay.classList.remove("hidden");
    let focusTimer = null;

    if (typeof document !== "undefined") {
        openCount += 1;
        document.body.classList.add("modal-open");
        overlay.addEventListener("keydown", onKeyDown);
        overlay.addEventListener("mousedown", onMouseDown);
        if (handleEscape) document.addEventListener("keydown", onEscape);
        focusTimer = setTimeout(() => {
            focusTimer = null;
            const target =
                (focusSelector && overlay.querySelector(focusSelector)) ||
                focusableIn(overlay)[0];
            target?.focus?.();
        }, 0);
    }

    let closed = false;
    return {
        close() {
            if (closed) return;
            closed = true;
            if (focusTimer !== null) {
                clearTimeout(focusTimer);
                focusTimer = null;
            }
            overlay.classList.add("hidden");
            if (typeof document !== "undefined") {
                overlay.removeEventListener("keydown", onKeyDown);
                overlay.removeEventListener("mousedown", onMouseDown);
                if (handleEscape) document.removeEventListener("keydown", onEscape);
                openCount = Math.max(0, openCount - 1);
                if (openCount === 0) document.body.classList.remove("modal-open");
                previousFocus?.focus?.();
            }
        },
    };
}
