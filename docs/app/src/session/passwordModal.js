// src/session/passwordModal.js — modal zmiany hasła konta lokalnego (Session).
// app.js tylko podpina; cała obsługa formularza (walidacja + stany przycisku)
// żyje tutaj. validatePasswordChange to czysta reguła (testowalna bez DOM).
import { Notify } from "../notify/notify.js";

/** @returns {string} "" gdy OK, inaczej komunikat błędu. */
export function validatePasswordChange(newPwd, confirmPwd) {
  if (newPwd !== confirmPwd) return "Nowe hasła nie są zgodne.";
  return "";
}

/**
 * Podpina modal #change-password-modal. Zwraca false gdy modala brak w DOM.
 * @param {object} deps — { changePassword(oldPwd, newPwd): {ok, error?}, notify }
 */
export function initLocalPasswordModal({ changePassword, notify = Notify } = {}) {
  const btnOpen = document.getElementById("btn-change-local-password");
  const btnSubmit = document.getElementById("btn-submit-change-password");
  const btnCancel = document.getElementById("btn-cancel-change-password");
  const btnClose = document.getElementById("btn-close-change-password");
  if (!btnOpen || !btnSubmit) return false;

  const modal = () => document.getElementById("change-password-modal");
  const hide = () => modal()?.classList.add("hidden");

  btnOpen.addEventListener("click", () => {
    const m = modal();
    if (m) {
      m.classList.remove("hidden");
      document.getElementById("cp-old-password").value = "";
      document.getElementById("cp-new-password").value = "";
      document.getElementById("cp-confirm-password").value = "";
      document.getElementById("cp-error").textContent = "";
    }
  });

  btnSubmit.addEventListener("click", async () => {
    const oldPwd = document.getElementById("cp-old-password").value;
    const newPwd = document.getElementById("cp-new-password").value;
    const confirmPwd = document.getElementById("cp-confirm-password").value;
    const errorEl = document.getElementById("cp-error");

    const mismatch = validatePasswordChange(newPwd, confirmPwd);
    if (mismatch) {
      errorEl.textContent = mismatch;
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Zapisywanie...";

    const result = await changePassword(oldPwd, newPwd);

    btnSubmit.disabled = false;
    btnSubmit.textContent = "Zmień hasło";

    if (result.ok) {
      hide();
      notify.success("Hasło zostało zmienione pomyślnie.");
    } else {
      errorEl.textContent = result.error;
    }
  });

  btnCancel?.addEventListener("click", hide);
  btnClose?.addEventListener("click", hide);
  return true;
}
