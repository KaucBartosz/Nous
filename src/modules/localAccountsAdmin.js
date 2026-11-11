// src/modules/localAccountsAdmin.js
// Widok zarządzania kontami lokalnymi — dostępny tylko dla ADMIN.

import { getAllLocalAccounts } from './database.js';
import { adminResetLocalPassword, getUserStatus } from './auth.js';
import { Notify } from '../notify/notify.js';
import { escapeHtml } from './utils.js';
import { t, formatDate, formatDateTime } from '../i18n/index.js';

/**
 * Ładuje i renderuje listę kont lokalnych w widoku admina.
 */
export async function loadLocalAccountsAdmin() {
  const container = document.getElementById('local-accounts-list');
  if (!container) return;

  // Guard — tylko ADMIN
  if (getUserStatus() !== 'ADMIN') {
    container.innerHTML = `<p style="color: var(--danger);">${escapeHtml(t('localAdmin.noAccess'))}</p>`;
    return;
  }

  container.innerHTML = `<p style="color: var(--text-muted);">${escapeHtml(t('localAdmin.loading'))}</p>`;

  try {
    const accounts = await getAllLocalAccounts();

    if (accounts.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 32px 0;">${escapeHtml(t('localAdmin.empty'))}</p>`;
      return;
    }

    container.innerHTML = '';

    accounts.forEach(account => {
      const row = document.createElement('div');
      row.className = 'local-account-row';

      const info = document.createElement('div');
      info.className = 'local-account-info';

      const name = document.createElement('span');
      name.className = 'local-account-name';
      name.innerHTML = `<span class="material-icons" style="font-size:16px; vertical-align:middle; margin-right:6px; color:#64b5f6;">person</span>${escapeHtml(account.username)}`;

      const meta = document.createElement('span');
      meta.className = 'local-account-meta';
      const created = account.createdAt ? formatDate(account.createdAt) : '—';
      const lastLogin = account.lastLogin ? formatDateTime(account.lastLogin) : '—';
      meta.textContent = t('localAdmin.created', { created, lastLogin });

      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'local-account-actions';

      const btnReset = document.createElement('button');
      btnReset.className = 'btn secondary small';
      btnReset.innerHTML = `<span class="material-icons" style="font-size:15px; vertical-align:middle; margin-right:4px;">lock_reset</span>${escapeHtml(t('localAdmin.resetPassword'))}`;
      btnReset.addEventListener('click', () => handleAdminResetPassword(account.username));

      actions.appendChild(btnReset);
      row.appendChild(info);
      row.appendChild(actions);
      container.appendChild(row);
    });

  } catch (e) {
    container.innerHTML = `<p style="color: var(--danger);">${escapeHtml(t('localAdmin.loadError', { message: e.message }))}</p>`;
  }
}

/**
 * Obsługuje reset hasła wybranego konta lokalnego przez admina.
 * Używa Dialog.custom z polami hasła wbudowanymi w dialog.
 */
async function handleAdminResetPassword(username) {
  // Krok 1: Potwierdź zamiar
  const confirmed = await Notify.confirm(
    t('localAdmin.resetConfirm', { username }),
    'warning'
  );
  if (!confirmed) return;

  // Krok 2: Poproś o nowe hasło
  const newPassword = await Notify.prompt(
    t('localAdmin.newPasswordPrompt', { username }),
    ''
  );

  if (!newPassword || !newPassword.trim()) return;

  if (newPassword.trim().length < 4) {
    await Notify.error(t('localAdmin.passwordTooShort'));
    return;
  }
  if (newPassword.trim().length > 30) {
    await Notify.error(t('localAdmin.passwordTooLong'));
    return;
  }

  const result = await adminResetLocalPassword(username, newPassword.trim());

  if (result.ok) {
    await Notify.success(t('localAdmin.resetSuccess', { username }));
  } else {
    await Notify.error(t('localAdmin.error', { message: result.error }));
  }
}
