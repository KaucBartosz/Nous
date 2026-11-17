import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebaseConfig.js', () => ({ auth: {}, db: {} }));
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
}));
vi.mock('../../src/cloud/firebase.js', () => ({
  saveRemoteResult: vi.fn(async () => ({ id: 'remote-x' })),
}));
vi.mock('../../src/modules/cryptoService.js', () => ({
  hasCloudKey: vi.fn(() => true),
  encryptCloudData: vi.fn(async ({ data }) => ({ payload: data, iv: 'iv' })),
}));
vi.mock('../../src/modules/database.js', () => ({
  getPendingResults: vi.fn(async () => []),
  markAsSynced: vi.fn(async () => {}),
}));
vi.mock('../../src/modules/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
  getUserStatus: vi.fn(() => 'GUEST'),
}));

import { setNotifyModalAdapter, resetNotifyModalAdapter } from '../../src/notify/notify.js';
import { getPendingResults } from '../../src/modules/database.js';
import { getCurrentUser, getUserStatus } from '../../src/modules/auth.js';
import { hasCloudKey, encryptCloudData } from '../../src/modules/cryptoService.js';
import { saveRemoteResult } from '../../src/cloud/firebase.js';
import { t } from '../../src/i18n/index.js';

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
      expect(calls[0][0]).toContain('APPROVED');
    } finally {
      resetNotifyModalAdapter();
    }
  });

  it('syncNow z statusem PENDING: brak odczytu i zapisu zdalnego', async () => {
    vi.mocked(getCurrentUser).mockReturnValue({ uid: 'uid-1' });
    vi.mocked(getUserStatus).mockReturnValue('PENDING');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    const { syncNow } = await import('../../src/modules/sync.js');
    await syncNow();

    expect(getPendingResults).not.toHaveBeenCalled();
    expect(saveRemoteResult).not.toHaveBeenCalled();
  });

  it('syncSingleResult z statusem PENDING: odrzucenie bez próby wysyłki', async () => {
    vi.mocked(getUserStatus).mockReturnValue('PENDING');

    const { syncSingleResult } = await import('../../src/modules/sync.js');
    await expect(
      syncSingleResult({ id: 'r1', researcher_uid: 'uid-1' }),
    ).rejects.toThrow(t('sync.approvedOnly'));
    expect(saveRemoteResult).not.toHaveBeenCalled();
  });

  it('syncNow bez klucza E2E: Notify.error i brak zapisu zdalnego', async () => {
    const calls = [];
    setNotifyModalAdapter({
      alert: async (m, t) => { calls.push([m, t]); },
      confirm: async () => false,
      prompt: async () => null,
      custom: async () => null,
    });

    vi.mocked(getCurrentUser).mockReturnValue({ uid: 'uid-1' });
    vi.mocked(getUserStatus).mockReturnValue('APPROVED');
    vi.mocked(getPendingResults).mockResolvedValue([{
      id: 'r1',
      researcher_uid: 'uid-1',
      test_id: 't1',
      subject_id: 's1',
      sync_status: 'PENDING',
      wyniki: { score: 5 },
      demographics: { age: 30 },
      timestamp: '2026-01-01T00:00:00.000Z',
    }]);
    vi.mocked(hasCloudKey).mockReturnValue(false);

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      const { setAutoSync, syncNow } = await import('../../src/modules/sync.js');
      // Włącz auto-sync bez auto-wywołania syncNow (onLine=false), potem wywołaj jawnie.
      setAutoSync(true);
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      await syncNow();

      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('error');
      expect(calls[0][0]).toBe(t('sync.noCloudKey'));
      expect(saveRemoteResult).not.toHaveBeenCalled();
      expect(encryptCloudData).not.toHaveBeenCalled();
    } finally {
      resetNotifyModalAdapter();
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    }
  });

  it('syncSingleResult bez klucza E2E: jeden komunikat i błąd z wiadomością noCloudKey', async () => {
    const calls = [];
    setNotifyModalAdapter({
      alert: async (m, t) => { calls.push([m, t]); },
      confirm: async () => false,
      prompt: async () => null,
      custom: async () => null,
    });

    vi.mocked(getCurrentUser).mockReturnValue({ uid: 'uid-1' });
    vi.mocked(getUserStatus).mockReturnValue('APPROVED');
    vi.mocked(hasCloudKey).mockReturnValue(false);

    const record = {
      id: 'r1',
      researcher_uid: 'uid-1',
      test_id: 't1',
      subject_id: 's1',
      sync_status: 'PENDING',
      wyniki: { score: 5 },
      demographics: { age: 30 },
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    try {
      const { syncSingleResult } = await import('../../src/modules/sync.js');
      // sync.js pokazuje jeden komunikat; history.js rozpoznaje zgłoszony błąd
      // po treści (syncSingleResult gubi .code przy rethrow) i nie dodaje alertu.
      await expect(syncSingleResult(record)).rejects.toThrow(t('sync.noCloudKey'));
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toBe('error');
      expect(calls[0][0]).toBe(t('sync.noCloudKey'));
    } finally {
      resetNotifyModalAdapter();
    }
  });
});
