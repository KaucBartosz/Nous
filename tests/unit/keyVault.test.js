import { describe, it, expect, vi } from 'vitest';
import { createCloudVault } from '../../src/session/keyVault.js';

const UID = 'uid-kv-1';
const PIN = '123456';
const MASTER = 'a'.repeat(64);
const SALT = 'f'.repeat(32);
const OLD_META = { encryptedMasterKey: 'enc-old', iv: 'iv-old', updatedAt: '2026-01-01T00:00:00.000Z' };

function makeVault(meta = OLD_META) {
  const getDocFn = vi.fn(async () => meta);
  const setDocFn = vi.fn(async () => {});
  const wrapFn = vi.fn(async () => ({ encryptedKey: 'enc-new', iv: 'iv-new' }));
  const unwrapFn = vi.fn(async () => MASTER);
  const randomHexFn = vi.fn(() => MASTER);
  const vault = createCloudVault({ getDocFn, setDocFn, wrapFn, unwrapFn, randomHexFn });
  return { vault, getDocFn, setDocFn, wrapFn, unwrapFn, randomHexFn };
}

describe('createCloudVault — sól w dokumencie user_keys', () => {
  it('setupNewMaster zapisuje salt obok encryptedMasterKey i iv', async () => {
    const { vault, setDocFn, wrapFn } = makeVault();

    const master = await vault.setupNewMaster({ uid: UID, pin: PIN, salt: SALT });

    expect(master).toBe(MASTER);
    expect(wrapFn).toHaveBeenCalledWith(MASTER, PIN, SALT);
    expect(setDocFn).toHaveBeenCalledWith(
      UID,
      expect.objectContaining({
        encryptedMasterKey: 'enc-new',
        iv: 'iv-new',
        salt: SALT,
      }),
    );
  });

  it('rotateMaster zapisuje nową salt', async () => {
    const { vault, setDocFn } = makeVault();

    await vault.rotateMaster({ uid: UID, master: MASTER, pin: PIN, salt: SALT });

    expect(setDocFn).toHaveBeenCalledWith(UID, expect.objectContaining({ salt: SALT }));
  });

  it('unlockWithPin używa meta.salt, nie wartości z zewnątrz', async () => {
    const meta = { ...OLD_META, salt: SALT };
    const { vault, unwrapFn } = makeVault(meta);

    const master = await vault.unlockWithPin({ uid: UID, pin: PIN, salt: 'b'.repeat(32) });

    expect(master).toBe(MASTER);
    expect(unwrapFn).toHaveBeenCalledWith('enc-old', 'iv-old', PIN, SALT);
  });

  it('unlockWithPin starego dokumentu używa fallbacku z parametru', async () => {
    const { vault, unwrapFn } = makeVault();

    await vault.unlockWithPin({ uid: UID, pin: PIN, salt: SALT });

    expect(unwrapFn).toHaveBeenCalledWith('enc-old', 'iv-old', PIN, SALT);
  });
});
