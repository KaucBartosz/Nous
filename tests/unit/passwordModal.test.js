import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePasswordChange,
  initLocalPasswordModal,
} from '../../src/session/passwordModal.js';

const MODAL_HTML = `
  <button id="btn-change-local-password">Zmień</button>
  <div id="change-password-modal" class="hidden">
    <input id="cp-old-password" /><input id="cp-new-password" />
    <input id="cp-confirm-password" /><div id="cp-error"></div>
    <button id="btn-submit-change-password">Zmień hasło</button>
    <button id="btn-cancel-change-password">Anuluj</button>
    <button id="btn-close-change-password">X</button>
  </div>`;

describe('validatePasswordChange', () => {
  it('zgodne → "", niezgodne → komunikat jak stary app.js', () => {
    expect(validatePasswordChange('ab12', 'ab12')).toBe('');
    expect(validatePasswordChange('ab12', 'ab13')).toBe('Nowe hasła nie są zgodne.');
  });
});

describe('initLocalPasswordModal', () => {
  beforeEach(() => {
    document.body.innerHTML = MODAL_HTML;
  });

  it('false gdy modala brak w DOM', () => {
    document.body.innerHTML = '';
    expect(initLocalPasswordModal({ changePassword: vi.fn() })).toBe(false);
  });

  it('otwarcie czyści pola, mismatch blokuje bez wołania serwisu', async () => {
    const changePassword = vi.fn();
    expect(initLocalPasswordModal({ changePassword, notify: { success: vi.fn() } })).toBe(true);

    document.getElementById('cp-new-password').value = 'stare';
    document.getElementById('btn-change-local-password').click();
    expect(document.getElementById('change-password-modal').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('cp-new-password').value).toBe('');

    document.getElementById('cp-new-password').value = 'nowe1';
    document.getElementById('cp-confirm-password').value = 'nowe2';
    document.getElementById('btn-submit-change-password').click();
    await Promise.resolve();
    expect(document.getElementById('cp-error').textContent).toBe('Nowe hasła nie są zgodne.');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('sukces: ukrywa modal + notify, błąd serwisu w errorEl', async () => {
    const notify = { success: vi.fn() };
    const changePassword = vi.fn(async () => ({ ok: true }));
    initLocalPasswordModal({ changePassword, notify });

    document.getElementById('btn-change-local-password').click();
    document.getElementById('cp-old-password').value = 'old';
    document.getElementById('cp-new-password').value = 'new1';
    document.getElementById('cp-confirm-password').value = 'new1';
    document.getElementById('btn-submit-change-password').click();
    await new Promise((r) => setTimeout(r, 0));

    expect(changePassword).toHaveBeenCalledWith('old', 'new1');
    expect(document.getElementById('change-password-modal').classList.contains('hidden')).toBe(true);
    expect(notify.success).toHaveBeenCalledWith('Hasło zostało zmienione pomyślnie.');

    changePassword.mockResolvedValue({ ok: false, error: 'Złe stare hasło' });
    document.getElementById('btn-change-local-password').click();
    document.getElementById('cp-old-password').value = 'x';
    document.getElementById('cp-new-password').value = 'n';
    document.getElementById('cp-confirm-password').value = 'n';
    document.getElementById('btn-submit-change-password').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.getElementById('cp-error').textContent).toBe('Złe stare hasło');
  });
});
