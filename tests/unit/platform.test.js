import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakePlatform } from '../../src/platform/fake.js';
import { createWebPlatform } from '../../src/platform/web.js';
import { setPlatform, resetPlatform, getPlatform } from '../../src/platform/index.js';

describe('platform seam (C1)', () => {
  beforeEach(() => { resetPlatform(); });

  it('FakePlatform: pamięta wersje i klucze E2E', async () => {
    const p = createFakePlatform({ versions: { a: { version: 2 } }, e2eKey: 'k1' });
    expect(await p.tests.getLocalVersions()).toEqual({ a: { version: 2 } });
    expect(await p.keys.getE2EKey()).toBe('k1');
    await p.keys.setE2EKey('k2');
    expect(await p.keys.getE2EKey()).toBe('k2');
    expect(p.calls.map(c => c.name)).toContain('tests.getLocalVersions');
  });

  it('WebPlatform: mapuje tests-registry.json na wersje', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 'x', version: 3, name: 'X', description: 'd', path: 'tests/x/index.html' }],
    }));
    const p = createWebPlatform({ fetchFn, openFn: vi.fn() });
    const v = await p.tests.getLocalVersions();
    expect(v.x.version).toBe(3);
    expect(v.x.webPath).toBe('tests/x/index.html');
  });

  it('WebPlatform: meta.json nadpisuje nazwę i opis z rejestru (PL/EN)', async () => {
    const responses = {
      'tests-registry.json': [{ id: 'x', version: 2, name: 'Registry X', description: 'registry desc', path: 'tests/x/index.html' }],
      'tests/x/meta.json': { name: 'Meta X', name_en: 'Meta X EN', description_pl: 'Opis PL', description_en: 'Description EN' },
    };
    const fetchFn = vi.fn(async (url) => ({
      ok: url in responses,
      json: async () => responses[url],
    }));
    const p = createWebPlatform({ fetchFn, openFn: vi.fn() });
    const v = await p.tests.getLocalVersions();
    expect(v.x).toMatchObject({
      name: 'Meta X',
      name_en: 'Meta X EN',
      description: 'Opis PL',
      description_pl: 'Opis PL',
      description_en: 'Description EN',
      webPath: 'tests/x/index.html',
    });
    expect(fetchFn).toHaveBeenCalledWith('tests/x/meta.json');
  });

  it('WebPlatform: brak meta.json → fallback na pola z rejestru', async () => {
    const fetchFn = vi.fn(async (url) => {
      if (url === 'tests-registry.json') {
        return {
          ok: true,
          json: async () => [{
            id: 'x', version: 1, name: 'X', name_en: 'X EN',
            description_pl: 'Opis', description_en: 'Desc', path: 'tests/x/index.html',
          }],
        };
      }
      return { ok: false, json: async () => null };
    });
    const p = createWebPlatform({ fetchFn, openFn: vi.fn() });
    const v = await p.tests.getLocalVersions();
    expect(v.x).toMatchObject({
      name: 'X', name_en: 'X EN', description_pl: 'Opis', description_en: 'Desc',
    });
  });

  it('WebPlatform: zwraca {} przy błędzie fetch', async () => {
    const p = createWebPlatform({ fetchFn: async () => { throw new Error('net'); } });
    expect(await p.tests.getLocalVersions()).toEqual({});
  });

  it('getPlatform: daje się podmienić w testach (seam działa)', async () => {
    const fake = createFakePlatform({ versions: {} });
    setPlatform(fake);
    expect(getPlatform()).toBe(fake);
    expect(getPlatform().kind).toBe('fake');
  });

  it('A1 capabilities: electron/fake umieją pobierać, web nie', async () => {
    const { createElectronPlatform } = await import('../../src/platform/electron.js');
    const fakeApi = {
      downloadTest: () => {}, runTest: () => {}, getLocalVersions: async () => ({}),
      deleteTest: async () => ({ success: true }),
    };
    expect(createElectronPlatform(fakeApi).capabilities).toMatchObject({
      canDownload: true, canDelete: true, canRunLocalDev: true,
    });
    expect(createFakePlatform().capabilities).toMatchObject({
      canDownload: true, canDelete: true, canRunLocalDev: true,
    });
    const web = createWebPlatform({ fetchFn: async () => ({ ok: false }) });
    expect(web.capabilities).toMatchObject({
      canDownload: false, canDelete: false, canRunLocalDev: false,
    });
  });
});
