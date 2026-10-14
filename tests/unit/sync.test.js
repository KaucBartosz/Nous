import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebaseConfig.js', () => ({ auth: {}, db: {} }));
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
}));
vi.mock('../../src/modules/database.js', () => ({
  getPendingResults: vi.fn(async () => []),
  markAsSynced: vi.fn(),
}));
vi.mock('../../src/modules/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  getUserStatus: vi.fn(() => 'GUEST'),
}));

import { setNotifyModalAdapter, resetNotifyModalAdapter } from '../../src/notify/notify.js';

describe('sync module na Notify (bez DOM-modala)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('setAutoSync(true) dla GUEST: Notify.error, stan niezmieniony', async () => {
    const calls = [];
    setNotifyModalAdapter({
      alert: async (m, t) => { calls.push([m, t]); },
      confirm: async () => false,
      prompt: async () => null,
      custom: async () => null,
    });
    try {
      const { setAutoSync, getAutoSyncState } = await import('../../src/modules/sync.js');
      setAutoSync(true);
      expect(getAutoSyncState()).toBe(false);
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('error');
      expect(calls[0][0]).toContain('zatwierdzonych użytkowników');
    } finally {
      resetNotifyModalAdapter();
    }
  });
});
