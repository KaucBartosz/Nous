import { vi } from 'vitest';

// ==========================================================
// Web Crypto API Mock with real encryption support
// ==========================================================
const cryptoKeys = new Map();

const mockCrypto = {
  subtle: {
    importKey: vi.fn(async (format, keyData, algorithm, extractable, keyUsages) => {
      const keyId = Array.from(new Uint8Array(keyData)).map(b => b.toString(16).padStart(2, '0')).join('');
      const key = { id: keyId, data: keyData, usages: keyUsages };
      cryptoKeys.set(keyId, key);
      return key;
    }),

    encrypt: vi.fn(async (algorithm, key, data) => {
      // Simple XOR-based mock encryption for testing
      const iv = algorithm.iv;
      const keyBytes = new Uint8Array(key.data);
      const dataBytes = new Uint8Array(data);
      const result = new Uint8Array(dataBytes.length);

      for (let i = 0; i < dataBytes.length; i++) {
        result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
      }

      return result.buffer;
    }),

    decrypt: vi.fn(async (algorithm, key, data) => {
      // XOR is symmetric, so decrypt = encrypt
      const iv = algorithm.iv;
      const keyBytes = new Uint8Array(key.data);
      const dataBytes = new Uint8Array(data);
      const result = new Uint8Array(dataBytes.length);

      for (let i = 0; i < dataBytes.length; i++) {
        result[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length] ^ iv[i % iv.length];
      }

      return result.buffer;
    }),

    generateKey: vi.fn(),
    deriveKey: vi.fn(),
    sign: vi.fn(),
    verify: vi.fn(),
    digest: vi.fn()
  },

  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },

  randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  })
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
  configurable: true
});

// ==========================================================
// Mock Electron API
// ==========================================================
global.window = global.window || {};
global.window.electronAPI = {
  getEncryptionKey: vi.fn(() => '0'.repeat(64)),
  getLocalVersions: vi.fn(() => ({})),
  deleteTest: vi.fn(),
  downloadAndRun: vi.fn(),
  onStatusUpdate: vi.fn(),
  openExternal: vi.fn(),
  onTestProcessStopped: vi.fn(),
  onTestInstalled: vi.fn(),
  onDownloadProgress: vi.fn(),
  onHpmDownloadProgress: vi.fn(),
  onHpmInstalled: vi.fn(),
  getHpmStatus: vi.fn(() => true),
  checkHpmUpdate: vi.fn(() => ({ hasUpdate: false })),
  downloadHpmEngine: vi.fn(),
  isLinux: false,
  getLinuxDistro: vi.fn(() => ({ family: 'other' }))
};

// ==========================================================
// Mock btoa/atob for Node.js environment
// ==========================================================
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}