import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { webcrypto } from 'node:crypto';

// Realny Web Crypto — setup.js daje XOR-mock bez deriveBits, więc PBKDF2 musi
// tu działać na node:crypto.webcrypto (ten sam wzorzec co cryptoService.real.test.js).
let passwordHash;

beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto);
  vi.resetModules();
  passwordHash = await import('../../src/session/passwordHash.js');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const SALT = 'aabbccdd00112233aabbccdd00112233';
const PASSWORD = 'poprawne-haslo';

describe('passwordHash — wersja 2 (PBKDF2)', () => {
  it('eksportuje HASH_VERSION = 2', () => {
    expect(passwordHash.HASH_VERSION).toBe(2);
  });

  it('v2 round-trip: ten sam salt i hasło weryfikują się, złe dane nie', async () => {
    const hash = await passwordHash.hashPassword(SALT, PASSWORD);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await passwordHash.verifyPassword(SALT, PASSWORD, hash)).toBe(true);
    expect(await passwordHash.verifyPassword(SALT, PASSWORD, hash, 2)).toBe(true);
    expect(await passwordHash.verifyPassword(SALT, 'zle-haslo', hash)).toBe(false);
    expect(await passwordHash.verifyPassword('00'.repeat(16), PASSWORD, hash)).toBe(false);
  });

  it('różne hasła dają różne hashe, a to samo hasło jest deterministyczne', async () => {
    const first = await passwordHash.hashPassword(SALT, PASSWORD);
    const again = await passwordHash.hashPassword(SALT, PASSWORD);
    const other = await passwordHash.hashPassword(SALT, PASSWORD + 'x');

    expect(first).toBe(again);
    expect(first).not.toBe(other);
  });

  it('v1 (SHA-256) jest weryfikowany jawnie podaną wersją 1', async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode(SALT + PASSWORD);
    const digest = await webcrypto.subtle.digest('SHA-256', data);
    const sha256 = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    expect(await passwordHash.verifyPassword(SALT, PASSWORD, sha256, 1)).toBe(true);
    expect(await passwordHash.verifyPassword(SALT, PASSWORD, sha256, 2)).toBe(false);
  });

  it('needsRehash wymusza migrację tylko dla wersji != HASH_VERSION', () => {
    expect(passwordHash.needsRehash(1)).toBe(true);
    expect(passwordHash.needsRehash(undefined)).toBe(true);
    expect(passwordHash.needsRehash(passwordHash.HASH_VERSION)).toBe(false);
  });

  it('generateSalt zwraca 16 losowych bajtów jako 32 znaki hex', () => {
    const salt = passwordHash.generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(salt).not.toBe(passwordHash.generateSalt());
  });
});
