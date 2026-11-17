import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// Testy kryptografii na REALNYM Web Crypto (node:crypto.webcrypto), bez XOR-mocka
// z tests/setup.js. Mock pozostaje nietknięty dla testów UI/store'ów.
//
// cryptoService.js czyta `window.crypto` ORAZ `window.atob` (oraz globalne
// Blob/FileReader z happy-dom), więc stub window musi udostępniać zarówno
// crypto, jak i atob. `window.crypto` jest stubowany tylko na czas tego pliku.

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const OTHER_KEY = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

// Golden vector — wygenerowany jednorazowo przez node:crypto.webcrypto przy
// commicie bazowym planu 016 (7f49c43): AES-GCM, key=TEST_KEY, IV=0102030405060708090a0b0c,
// plaintext=JSON.stringify({a:1}) => "{\"a\":1}". Stałe zapisane, nie generowane w locie.
const GOLDEN = {
  key: TEST_KEY,
  iv: 'AQIDBAUGBwgJCgsM',
  ciphertext: 'vJ/6bS+SocYYf2YKK4UaIAKWl26IVvw=',
  plaintext: { a: 1 },
};

function base64ToBytes(base64) {
  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

// Smoke test: każdy test poniżej musi działać na realnym Web Crypto, nie na vi.fn().
function expectRealWebCrypto() {
  expect(vi.isMockFunction(window.crypto.subtle.encrypt)).toBe(false);
  expect(vi.isMockFunction(window.crypto.subtle.decrypt)).toBe(false);
  expect(vi.isMockFunction(window.crypto.getRandomValues)).toBe(false);
}

let cryptoService;

beforeAll(async () => {
  const realAtob = (b64) => Buffer.from(b64, 'base64').toString('binary');
  vi.stubGlobal('window', { crypto: webcrypto, atob: realAtob });
  vi.resetModules();
  cryptoService = await import('../../src/modules/cryptoService.js');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  vi.resetModules();
  cryptoService = await import('../../src/modules/cryptoService.js');
  await cryptoService.initCrypto(TEST_KEY);
});

describe('AES-GCM na realnym Web Crypto', () => {
  it('round-trip: szyfruje i deszyfruje ten sam obiekt', async () => {
    expectRealWebCrypto();
    const original = { a: 1 };

    const encrypted = await cryptoService.encryptData(original);
    const decrypted = await cryptoService.decryptData(encrypted.payload, encrypted.iv);

    expect(decrypted).toEqual(original);
  });

  it('rzuca przy zmienionym jednym bajcie szyfrogramu (autentykacja GCM)', async () => {
    expectRealWebCrypto();
    const encrypted = await cryptoService.encryptData({ secret: 'data' });

    const bytes = base64ToBytes(encrypted.payload);
    bytes[0] ^= 0xff;

    await expect(
      cryptoService.decryptData(bytesToBase64(bytes), encrypted.iv)
    ).rejects.toThrow();
  });

  it('rzuca przy dekrypcji innym kluczem', async () => {
    expectRealWebCrypto();
    const encrypted = await cryptoService.encryptData({ secret: 'data' });

    await cryptoService.initCrypto(OTHER_KEY);

    await expect(
      cryptoService.decryptData(encrypted.payload, encrypted.iv)
    ).rejects.toThrow();
  });

  it('generuje unikalny IV: dwa szyfrowania dają różne payloady, oba się dekryptują', async () => {
    expectRealWebCrypto();
    const original = { a: 1 };

    const first = await cryptoService.encryptData(original);
    const second = await cryptoService.encryptData(original);

    expect(first.iv).not.toBe(second.iv);
    expect(first.payload).not.toBe(second.payload);
    await expect(cryptoService.decryptData(first.payload, first.iv)).resolves.toEqual(original);
    await expect(cryptoService.decryptData(second.payload, second.iv)).resolves.toEqual(original);
  });

  it('dekryptuje golden vector wygenerowany realnym webcrypto', async () => {
    expectRealWebCrypto();

    const decrypted = await cryptoService.decryptData(GOLDEN.ciphertext, GOLDEN.iv);

    expect(decrypted).toEqual(GOLDEN.plaintext);
  });
});

describe('PBKDF2 na realnym Web Crypto', () => {
  const PIN = '1234';
  const WRONG_PIN = '9999';
  const SALT = '000102030405060708090a0b0c0d0e0f';
  const CLOUD_KEY = 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd';

  it('ten sam PIN i sól: unwrap(wrap(klucz)) zwraca oryginalny klucz', async () => {
    expectRealWebCrypto();

    const wrapped = await cryptoService.wrapCloudKey(CLOUD_KEY, PIN, SALT);
    const unwrapped = await cryptoService.unwrapCloudKey(
      wrapped.encryptedKey, wrapped.iv, PIN, SALT
    );

    expect(unwrapped).toBe(CLOUD_KEY);
  });

  it('inny PIN rzuca błąd', async () => {
    expectRealWebCrypto();

    const wrapped = await cryptoService.wrapCloudKey(CLOUD_KEY, PIN, SALT);

    await expect(
      cryptoService.unwrapCloudKey(wrapped.encryptedKey, wrapped.iv, WRONG_PIN, SALT)
    ).rejects.toThrow();
  });
});
