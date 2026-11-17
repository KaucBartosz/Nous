import { describe, it, expect, vi, beforeEach } from 'vitest';

const { FAKE_UID, RECOVERY_CODE } = vi.hoisted(() => ({
  FAKE_UID: 'uid-e2e-123',
  RECOVERY_CODE: 'a'.repeat(64),
}));
const PIN = '123456';

// Firebase seam: currentUser() jest funkcją zwracającą fejkowego usera.
vi.mock('../../src/cloud/firebase.js', () => ({
  currentUser: vi.fn(),
  fetchUserKeys: vi.fn(),
  saveUserKeys: vi.fn(),
}));

// Polityka sesji: zachowamy walidację PIN/soli, podmieniamy orkiestrację.
vi.mock('../../src/session/e2ePolicy.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    setupNewMaster: vi.fn(async () => 'a'.repeat(64)),
    unlockWithPin: vi.fn(async () => 'b'.repeat(64)),
    recoverWithCode: vi.fn(async () => 'c'.repeat(64)),
  };
});

// Vault nie może dotykać Firestore ani Web Crypto.
vi.mock('../../src/session/keyVault.js', () => ({
  createCloudVault: vi.fn(() => ({
    setupNewMaster: vi.fn(),
    unlockWithPin: vi.fn(),
    rotateMaster: vi.fn(),
    fetchMeta: vi.fn(),
  })),
  createLocalVault: vi.fn(() => ({})),
}));

// Seam platformy: zapis klucza w pamięci, bez Electron/Web API.
vi.mock('../../src/platform/index.js', () => ({
  getPlatform: vi.fn(() => ({
    keys: {
      setE2EKey: vi.fn(async () => {}),
      getE2EKey: vi.fn(async () => null),
    },
  })),
}));

vi.mock('../../src/i18n/index.js', () => ({
  t: vi.fn((key) => key),
}));

// Wszystkie id z _getEls() w src/modules/e2e.js.
const E2E_HTML = `
  <div id="pin-setup-modal" class="hidden">
    <input id="pin-setup-input" /><div id="pin-setup-error"></div>
    <button id="btn-cancel-pin-setup">Anuluj</button>
    <button id="btn-save-pin">Zapisz PIN</button>
  </div>
  <div id="pin-enter-modal" class="hidden">
    <input id="pin-enter-input" /><div id="pin-enter-error"></div>
    <button id="btn-submit-pin">Odblokuj</button>
    <button id="btn-cancel-pin">Anuluj</button>
    <a href="#" id="link-forgot-pin">Zapomniałem</a>
  </div>
  <div id="pin-recovery-modal" class="hidden">
    <input id="recovery-code-input" /><input id="new-pin-input" />
    <div id="pin-recovery-error"></div>
    <button id="btn-submit-recovery">Odzyskaj</button>
    <button id="btn-close-recovery-modal">Zamknij</button>
  </div>
  <div id="recovery-key-modal" class="hidden">
    <div id="recovery-key-display"></div>
    <button id="btn-understood-recovery">Rozumiem</button>
  </div>`;

async function clickAndFlush(id) {
  document.getElementById(id).click();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('E2E handlers — currentUser() seam', () => {
  let currentUser, setupNewMaster, unlockWithPin, recoverWithCode;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = E2E_HTML;

    const fb = await import('../../src/cloud/firebase.js');
    currentUser = fb.currentUser;
    currentUser.mockReturnValue({ uid: FAKE_UID });

    const policy = await import('../../src/session/e2ePolicy.js');
    setupNewMaster = policy.setupNewMaster;
    unlockWithPin = policy.unlockWithPin;
    recoverWithCode = policy.recoverWithCode;

    const { initE2E } = await import('../../src/modules/e2e.js');
    initE2E();
  });

  it('Zapisz PIN: setupNewMaster dostaje uid fejkowego usera', async () => {
    document.getElementById('pin-setup-input').value = PIN;

    await clickAndFlush('btn-save-pin');

    expect(currentUser).toHaveBeenCalled();
    expect(setupNewMaster).toHaveBeenCalledTimes(1);
    expect(setupNewMaster).toHaveBeenCalledWith(
      expect.objectContaining({ uid: FAKE_UID, pin: PIN }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('Odblokowanie: unlockWithPin dostaje uid fejkowego usera', async () => {
    document.getElementById('pin-enter-input').value = PIN;

    await clickAndFlush('btn-submit-pin');

    expect(currentUser).toHaveBeenCalled();
    expect(unlockWithPin).toHaveBeenCalledTimes(1);
    expect(unlockWithPin).toHaveBeenCalledWith(
      expect.objectContaining({ uid: FAKE_UID, pin: PIN }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('Odzyskiwanie kodem: recoverWithCode dostaje uid fejkowego usera', async () => {
    document.getElementById('recovery-code-input').value = RECOVERY_CODE;
    document.getElementById('new-pin-input').value = PIN;

    await clickAndFlush('btn-submit-recovery');

    expect(currentUser).toHaveBeenCalled();
    expect(recoverWithCode).toHaveBeenCalledTimes(1);
    expect(recoverWithCode).toHaveBeenCalledWith(
      expect.objectContaining({ uid: FAKE_UID, cleanCode: RECOVERY_CODE, newPin: PIN }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('Anuluj zamyka okno PIN i czyści dane', async () => {
    const modal = document.getElementById('pin-enter-modal');
    modal.classList.remove('hidden');
    document.getElementById('pin-enter-input').value = PIN;
    document.getElementById('pin-enter-error').textContent = 'błąd';

    document.getElementById('btn-cancel-pin').click();

    expect(modal.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('pin-enter-input').value).toBe('');
    expect(document.getElementById('pin-enter-error').textContent).toBe('');
  });

  it('Escape zamyka otwarte okno PIN', async () => {
    const modal = document.getElementById('pin-setup-modal');
    modal.classList.remove('hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('currentUser() === null: handler nie wywołuje polityki', async () => {
    currentUser.mockReturnValue(null);
    document.getElementById('pin-setup-input').value = PIN;

    await clickAndFlush('btn-save-pin');

    expect(setupNewMaster).not.toHaveBeenCalled();
  });
});
