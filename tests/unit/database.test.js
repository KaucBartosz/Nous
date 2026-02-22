import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock cryptoService BEFORE importing database
vi.mock('../../src/modules/cryptoService.js', () => ({
  initCrypto: vi.fn(),
  encryptData: vi.fn(async (data) => ({
    payload: 'encrypted_' + JSON.stringify(data),
    iv: 'mock_iv_123'
  })),
  decryptData: vi.fn(async (payload, iv) => {
    const jsonStr = payload.replace('encrypted_', '');
    return JSON.parse(jsonStr);
  })
}));

// Mock Dialog
vi.mock('../../src/modules/dialog.js', () => ({
  Dialog: {
    alert: vi.fn()
  }
}));

// Mock openDB - creates fresh DB for each test
vi.mock('../../src/lib/idb.js', () => ({
  openDB: vi.fn()
}));

// ==========================================================
// Helper to create fresh mock IndexedDB
// ==========================================================
function createMockDB() {
  const stores = {
    results: new Map(),
    demographicsTemplates: new Map()
  };

  return {
    _stores: stores,
    
    put: vi.fn(async (storeName, data) => {
      stores[storeName].set(data.id, data);
      return data.id;
    }),
    
    get: vi.fn(async (storeName, id) => {
      return stores[storeName].get(id) || undefined;
    }),
    
    delete: vi.fn(async (storeName, id) => {
      stores[storeName].delete(id);
    }),
    
    getAll: vi.fn(async (storeName) => {
      return Array.from(stores[storeName].values());
    }),
    
    getAllFromIndex: vi.fn(async (storeName, indexName, value) => {
      const all = Array.from(stores[storeName].values());
      if (value === undefined) {
        return all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      }
      return all.filter(item => item[indexName] === value || item.sync_status === value);
    }),
    
    transaction: vi.fn(() => {
      const txStores = {};
      return {
        objectStore: vi.fn((name) => {
          txStores[name] = txStores[name] || {
            get: vi.fn(async (id) => stores[name].get(id)),
            put: vi.fn(async (data) => {
              stores[name].set(data.id, data);
              return data.id;
            }),
            delete: vi.fn(async (id) => {
              stores[name].delete(id);
            })
          };
          return txStores[name];
        }),
        done: Promise.resolve()
      };
    }),
    
    objectStoreNames: {
      contains: vi.fn((name) => ['results', 'demographicsTemplates'].includes(name))
    }
  };
}

// ==========================================================
// Database Tests
// ==========================================================
describe('Database Module', () => {
  let mockDB;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Setup window.electronAPI before importing
    window.electronAPI = {
      getEncryptionKey: vi.fn().mockResolvedValue(null)
    };

    // Create fresh mock DB
    mockDB = createMockDB();
    
    const { openDB } = await import('../../src/lib/idb.js');
    openDB.mockResolvedValue(mockDB);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================
  // initDB Tests
  // ==========================================================
  describe('initDB', () => {
    it('initializes database and returns db promise', async () => {
      const { initDB } = await import('../../src/modules/database.js');
      const db = await initDB();
      expect(db).toBeDefined();
      expect(db.put).toBeDefined();
      expect(db.get).toBeDefined();
    });

    it('returns same db promise on multiple calls (singleton)', async () => {
      const { initDB } = await import('../../src/modules/database.js');
      const db1 = await initDB();
      const db2 = await initDB();
      expect(db1).toBe(db2);
    });
  });

  // ==========================================================
  // saveResult Tests
  // ==========================================================
  describe('saveResult', () => {
    it('saves result with generated id', async () => {
      const { saveResult } = await import('../../src/modules/database.js');
      
      const resultData = {
        test_id: 'test-1',
        subject_id: 'subject-1',
        data: { score: 100 }
      };

      const id = await saveResult(resultData, 'user-123');

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('saves result with provided id', async () => {
      const { saveResult } = await import('../../src/modules/database.js');
      
      const resultData = {
        id: 'custom-id-123',
        test_id: 'test-1',
        data: { score: 100 }
      };

      const id = await saveResult(resultData, 'user-123');

      expect(id).toBe('custom-id-123');
    });

    it('throws error if researcher_uid mismatches', async () => {
      const { saveResult } = await import('../../src/modules/database.js');
      
      const resultData = {
        researcher_uid: 'other-user'
      };

      await expect(saveResult(resultData, 'current-user')).rejects.toThrow('researcher_uid mismatch');
    });

    it('sets sync_status to PENDING by default', async () => {
      const { saveResult } = await import('../../src/modules/database.js');
      
      const resultData = { test_id: 'test-1' };
      await saveResult(resultData, 'user-123');

      const allResults = Array.from(mockDB._stores.results.values());
      expect(allResults[allResults.length - 1].sync_status).toBe('PENDING');
    });
  });

  // ==========================================================
  // getAllResults Tests
  // ==========================================================
  describe('getAllResults', () => {
    it('returns empty array when no results', async () => {
      const { getAllResults } = await import('../../src/modules/database.js');
      
      const results = await getAllResults();
      expect(results).toEqual([]);
    });

    it('returns all results', async () => {
      const { saveResult, getAllResults } = await import('../../src/modules/database.js');
      
      await saveResult({ test_id: 'test-1' }, 'user-1');
      await saveResult({ test_id: 'test-2' }, 'user-1');

      const results = await getAllResults();
      expect(results.length).toBe(2);
    });
  });

  // ==========================================================
  // getPendingResults Tests
  // ==========================================================
  describe('getPendingResults', () => {
    it('returns only pending results', async () => {
      const { saveResult, getPendingResults } = await import('../../src/modules/database.js');
      
      await saveResult({ test_id: 'test-1', sync_status: 'PENDING' }, 'user-1');
      await saveResult({ test_id: 'test-2', sync_status: 'SYNCED' }, 'user-1');

      const pending = await getPendingResults();

      expect(pending.length).toBe(1);
      expect(pending[0].test_id).toBe('test-1');
    });

    it('filters by userId when provided', async () => {
      const { saveResult, getPendingResults } = await import('../../src/modules/database.js');
      
      await saveResult({ test_id: 'test-1' }, 'user-1');
      await saveResult({ test_id: 'test-2' }, 'user-2');

      const pending = await getPendingResults('user-1');

      expect(pending.every(r => r.researcher_uid === 'user-1')).toBe(true);
    });
  });

  // ==========================================================
  // markAsSynced Tests
  // ==========================================================
  describe('markAsSynced', () => {
    it('updates sync_status to SYNCED', async () => {
      const { saveResult, markAsSynced } = await import('../../src/modules/database.js');
      
      const id = await saveResult({ test_id: 'test-1' }, 'user-1');
      await markAsSynced(id, 'firestore-id-123');

      const saved = mockDB._stores.results.get(id);
      expect(saved.sync_status).toBe('SYNCED');
      expect(saved.firestore_id).toBe('firestore-id-123');
    });

    it('does nothing if record not found', async () => {
      const { markAsSynced } = await import('../../src/modules/database.js');
      await expect(markAsSynced('non-existent-id', 'fs-id')).resolves.not.toThrow();
    });
  });

  // ==========================================================
  // deleteResult Tests
  // ==========================================================
  describe('deleteResult', () => {
    it('deletes existing result', async () => {
      const { saveResult, deleteResult, getAllResults } = await import('../../src/modules/database.js');
      
      const id = await saveResult({ test_id: 'test-1' }, 'user-1');
      await deleteResult(id);

      const results = await getAllResults();
      expect(results.find(r => r.id === id)).toBeUndefined();
    });
  });

  // ==========================================================
  // checkResultExists Tests
  // ==========================================================
  describe('checkResultExists', () => {
    it('returns true if firestore_id matches', async () => {
      const { saveResult, checkResultExists } = await import('../../src/modules/database.js');
      
      const id = await saveResult({ test_id: 'test-1' }, 'user-1');
      
      // Manually set firestore_id
      const record = mockDB._stores.results.get(id);
      record.firestore_id = 'fs-123';
      mockDB._stores.results.set(id, record);

      const exists = await checkResultExists('fs-123', null, null, null);
      expect(exists).toBe(true);
    });

    it('returns true if timestamp, test_id, subject_id match', async () => {
      const { saveResult, checkResultExists } = await import('../../src/modules/database.js');
      
      const timestamp = '2024-01-01T00:00:00.000Z';
      await saveResult({ 
        test_id: 'test-1', 
        subject_id: 'subj-1',
        timestamp 
      }, 'user-1');

      const exists = await checkResultExists(null, timestamp, 'test-1', 'subj-1');
      expect(exists).toBe(true);
    });

    it('returns false if no match', async () => {
      const { saveResult, checkResultExists } = await import('../../src/modules/database.js');
      
      await saveResult({ test_id: 'test-1' }, 'user-1');

      const exists = await checkResultExists('different-fs-id', '2023-01-01', 'test-999', 'subj-999');
      expect(exists).toBe(false);
    });
  });

  // ==========================================================
  // claimGuestResult Tests
  // ==========================================================
  describe('claimGuestResult', () => {
    it('throws if no userId', async () => {
      const { claimGuestResult } = await import('../../src/modules/database.js');
      
      const guestResult = { test_id: 'test-1' };
      await expect(claimGuestResult(guestResult, null, false)).rejects.toThrow(
        'Tylko zalogowany użytkownik może przejąć wyniki'
      );
    });

    it('throws if userId is GUEST', async () => {
      const { claimGuestResult } = await import('../../src/modules/database.js');
      
      const guestResult = { test_id: 'test-1' };
      await expect(claimGuestResult(guestResult, 'GUEST', false)).rejects.toThrow(
        'Tylko zalogowany użytkownik może przejąć wyniki'
      );
    });

    it('sets new researcher_uid', async () => {
      const { claimGuestResult, getAllResults } = await import('../../src/modules/database.js');
      
      const guestResult = {
        test_id: 'test-1',
        researcher_uid: 'GUEST'
      };

      await claimGuestResult(guestResult, 'user-123', false);

      const allResults = await getAllResults();
      const claimed = allResults.find(r => r.researcher_uid === 'user-123');
      expect(claimed).toBeDefined();
    });

    it('resets sync_status to PENDING', async () => {
      const { claimGuestResult, getAllResults } = await import('../../src/modules/database.js');
      
      const guestResult = {
        test_id: 'test-1',
        sync_status: 'SYNCED'
      };

      await claimGuestResult(guestResult, 'user-123', false);

      const allResults = await getAllResults();
      const claimed = allResults[allResults.length - 1];
      expect(claimed.sync_status).toBe('PENDING');
    });

    it('removes firestore_id', async () => {
      const { claimGuestResult, getAllResults } = await import('../../src/modules/database.js');
      
      const guestResult = {
        test_id: 'test-1',
        firestore_id: 'old-fs-id'
      };

      await claimGuestResult(guestResult, 'user-123', false);

      const allResults = await getAllResults();
      const claimed = allResults[allResults.length - 1];
      expect(claimed.firestore_id).toBeUndefined();
    });
  });

  // ==========================================================
  // Template Tests
  // ==========================================================
  describe('Template Operations', () => {
    describe('saveTemplate', () => {
      it('saves template with generated id', async () => {
        const { saveTemplate } = await import('../../src/modules/database.js');
        
        const template = { name: 'Template 1', fields: [] };
        const id = await saveTemplate(template);

        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
      });

      it('saves template with provided id', async () => {
        const { saveTemplate } = await import('../../src/modules/database.js');
        
        const template = { id: 'custom-template-id', name: 'Template 1' };
        const id = await saveTemplate(template);

        expect(id).toBe('custom-template-id');
      });
    });

    describe('getAllTemplates', () => {
      it('returns empty array when no templates', async () => {
        const { getAllTemplates } = await import('../../src/modules/database.js');
        
        const templates = await getAllTemplates();
        expect(templates).toEqual([]);
      });

      it('returns all templates', async () => {
        const { saveTemplate, getAllTemplates } = await import('../../src/modules/database.js');
        
        await saveTemplate({ name: 'Template 1' });
        await saveTemplate({ name: 'Template 2' });

        const templates = await getAllTemplates();
        expect(templates.length).toBe(2);
      });
    });

    describe('getTemplate', () => {
      it('returns template by id', async () => {
        const { saveTemplate, getTemplate } = await import('../../src/modules/database.js');
        
        const id = await saveTemplate({ name: 'Template 1' });
        const template = await getTemplate(id);

        expect(template).toBeDefined();
        expect(template.name).toBe('Template 1');
      });

      it('returns undefined for non-existent id', async () => {
        const { getTemplate } = await import('../../src/modules/database.js');
        
        const template = await getTemplate('non-existent-id');
        expect(template).toBeUndefined();
      });
    });

    describe('deleteTemplate', () => {
      it('deletes existing template', async () => {
        const { saveTemplate, deleteTemplate, getTemplate } = await import('../../src/modules/database.js');
        
        const id = await saveTemplate({ name: 'Template 1' });
        await deleteTemplate(id);

        const template = await getTemplate(id);
        expect(template).toBeUndefined();
      });

      it('does not throw for non-existent id', async () => {
        const { deleteTemplate } = await import('../../src/modules/database.js');
        await expect(deleteTemplate('non-existent-id')).resolves.not.toThrow();
      });
    });
  });
});