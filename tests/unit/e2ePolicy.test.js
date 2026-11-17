import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saltForUid } from '../../src/session/e2ePolicy.js';

const { FAKE_UID, PIN, OLD_DOC, SALTED_DOC, MASTER } = vi.hoisted(() => ({
  FAKE_UID: 'uid-e2e-123',
  PIN: '123456',
  OLD_DOC: {
    encryptedMasterKey: 'enc-old',
    iv: 'iv-old',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  SALTED_DOC: {
    encryptedMasterKey: 'enc-new',
    iv: 'iv-new',
    salt: 'f'.repeat(32),
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  MASTER: 'b'.repeat(64),
}));

vi.mock('../../src/cloud/firebase.js', () => ({
  currentUser: vi.fn(),
  fetchUserKeys: vi.fn(),
  saveUserKeys: vi.fn(),
}));

// Vault zastąpiony fejkiem — migration test sprawdza orkiestrację handlerów e2e.js.
vi.mock('../../src/session/keyVault.js', () => ({
  createCloudVault: vi.fn(() => ({})),
  createLocalVault: vi.fn(() => ({})),
}));

vi.mock('../../src/modules/cryptoService.js', () => ({
  hasCloudKey: vi.fn(() => false),
  setCloudKeyFromHex: vi.fn(async () => {}),
  generateRandomHexKey: vi.fn(() => 'd'.repeat(64)),
  wrapCloudKey: vi.fn(async () => ({ encryptedKey: 'enc', iv: 'iv' })),
  unwrapCloudKey: vi.fn(async () => MASTER),
  formatRecoveryKey: vi.fn((hex) => hex),
  unformatRecoveryKey: vi.fn(() => 'a'.repeat(64)),
}));

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

const E2E_HTML = `
  <div id="pin-setup-modal" class="hidden">
    <input id="pin-setup-input" /><div id="pin-setup-error"></div>
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

describe('e2ePolicy — sól KDF', () => {
  it('generateSaltHex zwraca 32 znaki hex', async () => {
    const { generateSaltHex } = await import('../../src/session/e2ePolicy.js');
    expect(generateSaltHex()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generateSaltHex: dwa wywołania dają różne wartości', async () => {
    const { generateSaltHex } = await import('../../src/session/e2ePolicy.js');
    const salts = new Set(Array.from({ length: 20 }, () => generateSaltHex()));
    expect(salts.size).toBe(20);
  });

  it('saltForUid pozostaje fallbackiem migracyjnym', async () => {
    const { saltForUid: fallback } = await import('../../src/session/e2ePolicy.js');
    expect(fallback('abc')).toBe('616263');
  });
});

describe('E2E handlers — losowa sól i migracja starych dokumentów', () => {
  let vault;
  let platformObj;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = E2E_HTML;

    const fb = await import('../../src/cloud/firebase.js');
    fb.currentUser.mockReturnValue({ uid: FAKE_UID });

    const kv = await import('../../src/session/keyVault.js');
    vault = {
      setupNewMaster: vi.fn(async () => 'a'.repeat(64)),
      unlockWithPin: vi.fn(async () => MASTER),
      rotateMaster: vi.fn(async () => {}),
      fetchMeta: vi.fn(async () => OLD_DOC),
    };
    kv.createCloudVault.mockReturnValue(vault);

    const platform = await import('../../src/platform/index.js');
    platformObj = {
      keys: {
        setE2EKey: vi.fn(async () => {}),
        getE2EKey: vi.fn(async () => null),
      },
    };
    platform.getPlatform.mockReturnValue(platformObj);

    const { initE2E } = await import('../../src/modules/e2e.js');
    initE2E();
  });

  it('setup PIN zapisuje świeżą losową sól (nie z uid)', async () => {
    document.getElementById('pin-setup-input').value = PIN;

    await clickAndFlush('btn-save-pin');

    const arg = vault.setupNewMaster.mock.calls[0][0];
    expect(vault.setupNewMaster).toHaveBeenCalledTimes(1);
    expect(arg).toEqual(expect.objectContaining({ uid: FAKE_UID, pin: PIN }));
    expect(arg.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(arg.salt).not.toBe(saltForUid(FAKE_UID));
  });

  it('odzyskiwanie kodem zapisuje świeżą losową sól', async () => {
    document.getElementById('recovery-code-input').value = 'a'.repeat(64);
    document.getElementById('new-pin-input').value = PIN;

    await clickAndFlush('btn-submit-recovery');

    const arg = vault.rotateMaster.mock.calls[0][0];
    expect(arg).toEqual(
      expect.objectContaining({ uid: FAKE_UID, master: 'a'.repeat(64), pin: PIN }),
    );
    expect(arg.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('unlock starego dokumentu migruje go rotateMaster z nową solą', async () => {
    document.getElementById('pin-enter-input').value = PIN;

    await clickAndFlush('btn-submit-pin');

    expect(vault.fetchMeta).toHaveBeenCalledWith(FAKE_UID);
    expect(vault.unlockWithPin).toHaveBeenCalledWith(
      expect.objectContaining({ uid: FAKE_UID, pin: PIN, salt: saltForUid(FAKE_UID) }),
    );
    expect(vault.rotateMaster).toHaveBeenCalledTimes(1);
    const migration = vault.rotateMaster.mock.calls[0][0];
    expect(migration).toEqual(
      expect.objectContaining({ uid: FAKE_UID, master: MASTER, pin: PIN }),
    );
    expect(migration.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(migration.salt).not.toBe(saltForUid(FAKE_UID));
  });

  it('unlock dokumentu z salt używa zapisanej soli i nie migruje', async () => {
    vault.fetchMeta.mockResolvedValue(SALTED_DOC);
    document.getElementById('pin-enter-input').value = PIN;

    await clickAndFlush('btn-submit-pin');

    expect(vault.unlockWithPin).toHaveBeenCalledWith(
      expect.objectContaining({ salt: SALTED_DOC.salt }),
    );
    expect(vault.rotateMaster).not.toHaveBeenCalled();
  });

  it('błąd migracji nie blokuje odblokowania', async () => {
    vault.rotateMaster.mockRejectedValueOnce(new Error('firestore down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.getElementById('pin-enter-input').value = PIN;

    await clickAndFlush('btn-submit-pin');

    expect(platformObj.keys.setE2EKey).toHaveBeenCalledWith(MASTER);
    expect(document.getElementById('pin-enter-modal').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('pin-enter-error').textContent).toBe('');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
