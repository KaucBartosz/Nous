import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initCrypto, encryptData, decryptData } from '../../src/modules/cryptoService.js';

// Helper to generate a valid 32-byte hex key (64 characters)
function generateValidHexKey() {
  return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Helper to convert Uint8Array to Base64
function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ==========================================================
// initCrypto Tests
// ==========================================================
describe('initCrypto', () => {
  beforeEach(() => {
    // Reset cryptoKey by re-importing the module
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with valid 32-byte hex key (64 characters)', async () => {
    const hexKey = generateValidHexKey();
    
    // Should not throw
    await expect(initCrypto(hexKey)).resolves.not.toThrow();
  });

  it('throws error for missing key (null)', async () => {
    await expect(initCrypto(null)).rejects.toThrow('Encryption key is missing!');
  });

  it('throws error for missing key (undefined)', async () => {
    await expect(initCrypto(undefined)).rejects.toThrow('Encryption key is missing!');
  });

  it('throws error for empty string key', async () => {
    await expect(initCrypto('')).rejects.toThrow('Encryption key is missing!');
  });

  it('handles short hex string (mock accepts any string)', async () => {
    // Note: Our mock crypto accepts any string - in real browser this might fail
    // This test verifies the hex parsing doesn't crash
    const result = await initCrypto('abc123');
    // Mock should still work
    expect(result).toBeUndefined();
  });

  it('imports key for AES-GCM algorithm', async () => {
    const hexKey = generateValidHexKey();
    await initCrypto(hexKey);
    
    // If we can encrypt without error, key was imported correctly
    const result = await encryptData({ test: 'data' });
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('iv');
  });
});

// ==========================================================
// encryptData Tests
// ==========================================================
describe('encryptData', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { initCrypto } = await import('../../src/modules/cryptoService.js');
    await initCrypto(generateValidHexKey());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encrypts simple object', async () => {
    const data = { message: 'Hello World' };
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('iv');
    expect(typeof result.payload).toBe('string');
    expect(typeof result.iv).toBe('string');
  });

  it('returns Base64 encoded payload', async () => {
    const data = { test: 'value' };
    const result = await encryptData(data);
    
    // Base64 strings only contain A-Z, a-z, 0-9, +, /, =
    expect(result.payload).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(result.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('generates unique IV for each encryption', async () => {
    const data = { test: 'value' };
    const result1 = await encryptData(data);
    const result2 = await encryptData(data);
    
    // IV should be different each time (random)
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('generates different payload for same data (due to random IV)', async () => {
    const data = { test: 'value' };
    const result1 = await encryptData(data);
    const result2 = await encryptData(data);
    
    // Payload should be different due to unique IV
    expect(result1.payload).not.toBe(result2.payload);
  });

  it('encrypts nested objects', async () => {
    const data = {
      level1: {
        level2: {
          level3: 'deep value'
        }
      }
    };
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('iv');
  });

  it('encrypts arrays', async () => {
    const data = [1, 2, 3, 'four', { five: 5 }];
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('iv');
  });

  it('encrypts string data', async () => {
    const data = 'simple string';
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('encrypts number data', async () => {
    const data = 12345;
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('encrypts boolean data', async () => {
    const data = true;
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('encrypts null data', async () => {
    const data = null;
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('encrypts special characters', async () => {
    const data = { special: '<script>alert("XSS")</script>' };
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('encrypts unicode characters', async () => {
    const data = { unicode: '日本語 ñ é ü' };
    const result = await encryptData(data);
    
    expect(result).toHaveProperty('payload');
  });

  it('throws if cryptoService not initialized', async () => {
    // Reset module to clear cryptoKey
    vi.resetModules();
    const { encryptData } = await import('../../src/modules/cryptoService.js');
    
    await expect(encryptData({ test: 'data' })).rejects.toThrow('CryptoService not initialized!');
  });
});

// ==========================================================
// decryptData Tests
// ==========================================================
describe('decryptData', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { initCrypto } = await import('../../src/modules/cryptoService.js');
    await initCrypto(generateValidHexKey());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decrypts encrypted object correctly', async () => {
    const originalData = { message: 'Hello World' };
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toEqual(originalData);
  });

  it('decrypts nested objects correctly', async () => {
    const originalData = {
      level1: {
        level2: {
          level3: 'deep value'
        }
      }
    };
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toEqual(originalData);
  });

  it('decrypts arrays correctly', async () => {
    const originalData = [1, 2, 3, 'four', { five: 5 }];
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toEqual(originalData);
  });

  it('decrypts string data correctly', async () => {
    const originalData = 'simple string';
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toBe(originalData);
  });

  it('decrypts number data correctly', async () => {
    const originalData = 12345;
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toBe(originalData);
  });

  it('decrypts boolean data correctly', async () => {
    const originalData = true;
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toBe(originalData);
  });

  it('decrypts null data correctly', async () => {
    const originalData = null;
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toBeNull();
  });

  it('decrypts special characters correctly', async () => {
    const originalData = { special: '<script>alert("XSS")</script>' };
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toEqual(originalData);
  });

  it('decrypts unicode characters correctly', async () => {
    const originalData = { unicode: '日本語 ñ é ü' };
    const encrypted = await encryptData(originalData);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    
    expect(decrypted).toEqual(originalData);
  });

  it('throws error for wrong key', async () => {
    // Encrypt with one key
    const originalData = { secret: 'data' };
    const encrypted = await encryptData(originalData);
    
    // Re-initialize with different key
    vi.resetModules();
    const { initCrypto: initNew, decryptData: decryptNew } = await import('../../src/modules/cryptoService.js');
    await initNew('fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210');
    
    // Should fail to decrypt
    await expect(decryptNew(encrypted.payload, encrypted.iv)).rejects.toThrow();
  });

  it('throws error for corrupted payload', async () => {
    const originalData = { test: 'data' };
    const encrypted = await encryptData(originalData);
    
    // Corrupt the payload
    const corruptedPayload = encrypted.payload.slice(0, -5) + 'XXXXX';
    
    await expect(decryptData(corruptedPayload, encrypted.iv)).rejects.toThrow();
  });

  it('throws error for corrupted IV', async () => {
    const originalData = { test: 'data' };
    const encrypted = await encryptData(originalData);
    
    // Corrupt the IV
    const corruptedIV = encrypted.iv.slice(0, -5) + 'XXXXX';
    
    await expect(decryptData(encrypted.payload, corruptedIV)).rejects.toThrow();
  });

  it('throws if cryptoService not initialized', async () => {
    vi.resetModules();
    const { decryptData: decryptNew } = await import('../../src/modules/cryptoService.js');
    
    await expect(decryptNew('payload', 'iv')).rejects.toThrow('CryptoService not initialized!');
  });
});

// ==========================================================
// Round-trip Tests
// ==========================================================
describe('Round-trip encryption/decryption', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { initCrypto } = await import('../../src/modules/cryptoService.js');
    await initCrypto(generateValidHexKey());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encrypt then decrypt returns original simple object', async () => {
    const original = { key: 'value' };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
  });

  it('encrypt then decrypt returns original complex object', async () => {
    const original = {
      user: {
        id: 123,
        name: 'Test User',
        email: 'test@example.com'
      },
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ],
      metadata: {
        created: new Date().toISOString(),
        tags: ['tag1', 'tag2', 'tag3']
      }
    };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
  });

  it('encrypt then decrypt handles empty object', async () => {
    const original = {};
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
  });

  it('encrypt then decrypt handles empty array', async () => {
    const original = [];
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
  });

  it('encrypt then decrypt handles large data', async () => {
    // Generate large data object
    const original = {
      data: 'x'.repeat(10000),
      array: Array(100).fill(null).map((_, i) => ({ index: i, value: `item_${i}` }))
    };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
  });

  it('encrypt then decrypt preserves types', async () => {
    const original = {
      string: 'text',
      number: 42.5,
      integer: 100,
      booleanTrue: true,
      booleanFalse: false,
      nullValue: null,
      nestedObject: { a: 1 },
      nestedArray: [1, 2, 3]
    };
    const encrypted = await encryptData(original);
    const decrypted = await decryptData(encrypted.payload, encrypted.iv);
    expect(decrypted).toEqual(original);
    expect(typeof decrypted.string).toBe('string');
    expect(typeof decrypted.number).toBe('number');
    expect(typeof decrypted.booleanTrue).toBe('boolean');
  });
});