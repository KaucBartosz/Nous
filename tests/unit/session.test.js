import { describe, it, expect, vi } from 'vitest';
import { generateSalt, hashPassword, verifyPassword } from '../../src/session/passwordHash.js';
import {
  createSession,
  researcherUidFor,
  canUploadResult,
  isCloudSyncAllowed,
} from '../../src/session/session.js';
import {
  createMemoryVault,
  createLocalVault,
  createCloudVault,
} from '../../src/session/keyVault.js';
import {
  isValidPin,
  saltForUid,
  setupNewMaster,
  unlockWithPin,
  recoverWithCode,
  describeRemoteKey,
} from '../../src/session/e2ePolicy.js';

describe('passwordHash (przeniesione 1:1 z auth)', () => {
  it('generateSalt: 32 znaki hex', () => {
    const s = generateSalt();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSalt()).not.toBe(generateSalt());
  });

  it('hashPassword deterministyczny + verifyPassword', async () => {
    const h1 = await hashPassword('salt1', 'sekret');
    expect(await hashPassword('salt1', 'sekret')).toBe(h1);
    expect(await hashPassword('salt2', 'sekret')).not.toBe(h1);
    expect(await verifyPassword('salt1', 'sekret', h1)).toBe(true);
    expect(await verifyPassword('salt1', 'zle', h1)).toBe(false);
  });
});

describe('session', () => {
  it('researcherUidFor: firebase > LOCAL:: > GUEST (jak stary auth)', () => {
    expect(researcherUidFor({ firebaseUid: 'uid9' })).toBe('uid9');
    expect(researcherUidFor({ kind: 'LOCAL', localUsername: 'Jan' })).toBe('LOCAL::Jan');
    expect(researcherUidFor({ kind: 'LOCAL' })).toBe('GUEST');
    expect(researcherUidFor({})).toBe('GUEST');
  });

  it('createSession scala kontekst', () => {
    expect(createSession({ firebaseUid: 'u', kind: 'APPROVED' })).toEqual({
      uid: 'u', kind: 'APPROVED', localUsername: null, researcherUid: 'u',
    });
  });

  it('polityki: upload APPROVED/ADMIN, sync tylko APPROVED', () => {
    expect(canUploadResult('APPROVED')).toBe(true);
    expect(canUploadResult('ADMIN')).toBe(true);
    expect(canUploadResult('PENDING')).toBe(false);
    expect(canUploadResult('LOCAL')).toBe(false);
    expect(isCloudSyncAllowed('APPROVED')).toBe(true);
    expect(isCloudSyncAllowed('ADMIN')).toBe(false);
    expect(isCloudSyncAllowed('GUEST')).toBe(false);
  });
});

describe('keyVault', () => {
  it('MemoryVault: set/get/clear w RAM', async () => {
    const v = createMemoryVault();
    expect(await v.get()).toBeNull();
    await v.set('k1');
    expect(await v.get()).toBe('k1');
    await v.clear();
    expect(await v.get()).toBeNull();
  });

  it('LocalVault deleguje do platform.keys', async () => {
    const keys = { getE2EKey: vi.fn(async () => 'x'), setE2EKey: vi.fn(async () => true), clearE2EKey: vi.fn(async () => true) };
    const v = createLocalVault(keys);
    expect(await v.get()).toBe('x');
    await v.set('y');
    expect(keys.setE2EKey).toHaveBeenCalledWith('y');
  });

  it('CloudVault: setup/unlock/rotate przez wstrzyknięte funkcje', async () => {
    const store = {};
    const vault = createCloudVault({
      getDocFn: async (uid) => store[uid] || null,
      setDocFn: async (uid, payload) => { store[uid] = payload; },
      wrapFn: async (hex) => ({ encryptedKey: `w(${hex})`, iv: 'iv' }),
      unwrapFn: async (enc) => enc.slice(2, -1),
      randomHexFn: () => 'm'.repeat(64),
    });
    const master = await vault.setupNewMaster({ uid: 'u', pin: '123456', salt: 's' });
    expect(master).toBe('m'.repeat(64));
    expect(store.u.encryptedMasterKey).toBe(`w(${master})`);
    expect(await vault.unlockWithPin({ uid: 'u', pin: '123456', salt: 's' })).toBe(master);
    await expect(vault.unlockWithPin({ uid: 'nie-ma', pin: '1', salt: 's' })).rejects.toThrow('Brak klucza w chmurze!');
  });
});

describe('e2ePolicy', () => {
  it('isValidPin: dokładnie 6 cyfr', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12345a')).toBe(false);
    expect(isValidPin('')).toBe(false);
    expect(isValidPin(null)).toBe(false);
  });

  it('saltForUid: hex z uid (wektor jak stary getUserSalt)', () => {
    expect(saltForUid('AB')).toBe('4142');
  });

  const ram = () => {
    let key = null;
    return { setRamKey: async (k) => { key = k; }, peek: () => key };
  };

  it('setup → unlock → recover pełny cykl na fejkach', async () => {
    const store = {};
    const vault = createCloudVault({
      getDocFn: async (uid) => store[uid] || null,
      setDocFn: async (uid, p) => { store[uid] = p; },
      wrapFn: async (hex) => ({ encryptedKey: `w(${hex})`, iv: 'iv' }),
      unwrapFn: async (enc) => { if (!enc.startsWith('w(')) throw new Error('Invalid PIN'); return enc.slice(2, -1); },
      randomHexFn: () => 'a'.repeat(64),
    });
    const r = ram();
    const m = await setupNewMaster({ uid: 'u', pin: '111111', salt: 's' }, vault, r);
    expect(r.peek()).toBe(m);
    const r2 = ram();
    expect(await unlockWithPin({ uid: 'u', pin: '111111', salt: 's' }, vault, r2)).toBe(m);
    const r3 = ram();
    await recoverWithCode({ uid: 'u', cleanCode: 'b'.repeat(64), newPin: '222222', salt: 's' }, vault, r3);
    expect(r3.peek()).toBe('b'.repeat(64));
  });

  it('describeRemoteKey: present/missing/error', async () => {
    expect(await describeRemoteKey('u', async () => ({ encryptedMasterKey: 'x' }))).toBe('present');
    expect(await describeRemoteKey('u', async () => null)).toBe('missing');
    expect(await describeRemoteKey('u', async () => { throw new Error('net'); })).toBe('error');
  });
});
