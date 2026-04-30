// src/modules/localAccountsAdmin.js
// Widok zarządzania kontami lokalnymi — dostępny tylko dla ADMIN.

import { getAllLocalAccounts } from './database.js';
import { adminResetLocalPassword, getUserStatus } from './auth.js';
import { Dialog } from './dialog.js';

/**
 * Ładuje i renderuje listę kont lokalnych w widoku admina.
 */
export async function loadLocalAccountsAdmin() {
  const container = document.getElementById('local-accounts-list');
  if (!container) return;

  // Guard — tylko ADMIN
  if (getUserStatus() !== 'ADMIN') {
    container.innerHTML = '<p style="color: var(--danger);">Brak dostępu. Wymagany status ADMIN.</p>';
    return;
  }

  container.innerHTML = '<p style="color: var(--text-muted);">Ładowanie...</p>';

  try {
    const accounts = await getAllLocalAccounts();

    if (accounts.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 32px 0;">Brak kont lokalnych na tym urządzeniu.</p>';
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
      const created = account.createdAt ? new Date(account.createdAt).toLocaleDateString('pl-PL') : '—';
      const lastLogin = account.lastLogin ? new Date(account.lastLogin).toLocaleString('pl-PL') : '—';
      meta.textContent = `Utworzono: ${created} · Ostatnie logowanie: ${lastLogin}`;

      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'local-account-actions';

      const btnReset = document.createElement('button');
      btnReset.className = 'btn secondary small';
      btnReset.innerHTML = '<span class="material-icons" style="font-size:15px; vertical-align:middle; margin-right:4px;">lock_reset</span>Resetuj hasło';
      btnReset.addEventListener('click', () => handleAdminResetPassword(account.username));

      actions.appendChild(btnReset);
      row.appendChild(info);
      row.appendChild(actions);
      container.appendChild(row);
    });

  } catch (e) {
    container.innerHTML = `<p style="color: var(--danger);">Błąd ładowania kont: ${escapeHtml(e.message)}</p>`;
  }
}

/**
 * Obsługuje reset hasła wybranego konta lokalnego przez admina.
 * Używa Dialog.custom z polami hasła wbudowanymi w dialog.
 */
async function handleAdminResetPassword(username) {
  // Krok 1: Potwierdź zamiar
  const confirmed = await Dialog.confirm(
    `Czy na pewno chcesz zresetować hasło dla konta "${username}"?\n\nUżytkownik zostanie powiadomiony o nowym haśle.`,
    'warning'
  );
  if (!confirmed) return;

  // Krok 2: Poproś o nowe hasło (przez Dialog.prompt)
  const newPassword = await Dialog.prompt(
    `Podaj nowe hasło dla konta "${username}" (min. 4, max. 30 znaków):`,
    ''
  );

  if (!newPassword || !newPassword.trim()) return;

  if (newPassword.trim().length < 4) {
    await Dialog.alert('Hasło musi mieć min. 4 znaki.', 'error');
    return;
  }
  if (newPassword.trim().length > 30) {
    await Dialog.alert('Hasło max. 30 znaków.', 'error');
    return;
  }

  const result = await adminResetLocalPassword(username, newPassword.trim());

  if (result.ok) {
    await Dialog.alert(`Hasło dla konta "${username}" zostało zresetowane.`, 'success');
  } else {
    await Dialog.alert(`Błąd: ${result.error}`, 'error');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
