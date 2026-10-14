import { describe, it, expect, vi } from 'vitest';
import {
  statusOf,
  countUpdates,
  fetchRegistry,
  loadCachedRegistry,
  mergeLocalVersions,
  queryTests,
  loadCatalog,
} from '../../src/catalog/testCatalog.js';
import { toast, setNotifyAdapter, resetNotifyAdapter, syncCountMessage } from '../../src/notify/notify.js';
import { Notify, setNotifyModalAdapter, resetNotifyModalAdapter } from '../../src/notify/notify.js';

const tagsFake = {
  parseTagSearchQuery: (text) => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return {
      textFilters: words.filter((w) => !w.startsWith('@')),
      tagGroups: words.filter((w) => w.startsWith('@')).map((w) => [w.slice(1)]),
    };
  },
  getTagsForTest: (id) => ({ t1: ['szybki', 'uwaga'], t2: ['wolny'] }[id] || []),
  matchesTagGroups: (testTags, groups) => groups.every((g) => g.every((t) => testTags.includes(t))),
};

const snapOf = (docs) => ({
  empty: docs.length === 0,
  forEach: (cb) => docs.forEach((d) => cb({ id: d.id, data: () => ({ ...d.data }) })),
});

describe('testCatalog.statusOf/countUpdates', () => {
  it('4 statusy jak stare widoki', () => {
    expect(statusOf({ isLocalDev: true })).toBe('localdev');
    expect(statusOf({ local_ver: 0, remote_ver: 2 })).toBe('missing');
    expect(statusOf({ local_ver: 1, remote_ver: 2 })).toBe('outdated');
    expect(statusOf({ local_ver: 2, remote_ver: 2 })).toBe('uptodate');
  });

  it('countUpdates liczy tylko zainstalowane-przestarzałe', () => {
    const tests = [
      { local_ver: 1, remote_ver: 2 },
      { local_ver: 0, remote_ver: 2 },
      { local_ver: 2, remote_ver: 2 },
    ];
    expect(countUpdates(tests)).toBe(1);
  });
});

describe('testCatalog.fetchRegistry', () => {
  it('mapuje dokumenty + zapisuje cache', async () => {
    const storage = { data: {}, getItem(k) { return this.data[k] || null; }, setItem(k, v) { this.data[k] = v; } };
    const res = await fetchRegistry({
      fetchRemote: async () => snapOf([{ id: 'a', data: { name: 'A', version: 3 } }]),
      isOnline: () => true,
      storage,
    });
    expect(res.empty).toBe(false);
    expect(res.tests[0]).toMatchObject({ id: 'a', local_ver: 0, remote_ver: 3 });
    expect(JSON.parse(storage.data.cached_tests_metadata)[0].id).toBe('a');
  });

  it('pusty rejestr i offline gland', async () => {
    const empty = await fetchRegistry({ fetchRemote: async () => snapOf([]), isOnline: () => true });
    expect(empty.empty).toBe(true);
    await expect(fetchRegistry({
      fetchRemote: async () => { throw new Error('x'); },
      isOnline: () => false,
    })).rejects.toThrow('Brak połączenia');
  });

  it('loadCachedRegistry zwraca null przy braku i śmieciach', () => {
    const bad = { getItem: () => 'nie-json{{{' };
    expect(loadCachedRegistry(bad)).toBeNull();
    expect(loadCachedRegistry({ getItem: () => null })).toBeNull();
  });
});

describe('testCatalog.mergeLocalVersions', () => {
  it('merge + backfill + filtr showLocalTests', () => {
    const tests = [{ id: 'a', local_ver: 0, remote_ver: 2 }];
    const versions = {
      a: { version: 2, isLocalDev: false },
      diskOnly: { version: 1, isLocalDev: false, name: 'Dyskowy' },
      devOnly: { version: 1, isLocalDev: true },
      __scannedDir: '/tmp',
    };
    const out = mergeLocalVersions(tests, versions, { showLocalTests: false });
    expect(out.find((t) => t.id === 'a').local_ver).toBe(2);
    expect(out.find((t) => t.id === 'diskOnly')._isBackfill).toBe(true);
    expect(out.find((t) => t.id === 'devOnly')).toBeUndefined();
    const out2 = mergeLocalVersions([{ id: 'a', local_ver: 0, remote_ver: 2 }], versions, { showLocalTests: true });
    expect(out2.find((t) => t.id === 'devOnly')).toBeDefined();
  });
});

describe('testCatalog.queryTests', () => {
  const tests = [
    { id: 't1', name: 'Bystre Oczko', local_ver: 1, remote_ver: 1 },
    { id: 't2', name: 'Stroop Test', local_ver: 0, remote_ver: 1 },
  ];
  it('filtr tekstowy', () => {
    expect(queryTests(tests, 'stroop', tagsFake).map((t) => t.id)).toEqual(['t2']);
  });
  it('filtr @tag', () => {
    expect(queryTests(tests, '@szybki', tagsFake).map((t) => t.id)).toEqual(['t1']);
  });
  it('pusty filtr zwraca posortowane', () => {
    expect(queryTests(tests, '', tagsFake).length).toBe(2);
  });
});

describe('testCatalog.loadCatalog', () => {
  it('chmura + merge w jednym wywołaniu', async () => {
    const res = await loadCatalog({
      forceRefresh: true,
      cached: [],
      fetchRemote: async () => snapOf([{ id: 'a', data: { name: 'A', version: 2 } }]),
      isOnline: () => true,
      getLocalVersions: async () => ({ a: { version: 2 } }),
      getSettings: () => ({}),
    });
    expect(res.empty).toBe(false);
    expect(res.tests[0].local_ver).toBe(2);
  });

  it('offline + brak cache → empty+offline', async () => {
    const storage = { getItem: () => null, setItem: () => {} };
    const res = await loadCatalog({
      forceRefresh: true,
      cached: [],
      fetchRemote: async () => { throw new Error('net'); },
      isOnline: () => false,
      getLocalVersions: async () => ({}),
      getSettings: () => ({}),
      storage,
    });
    expect(res.empty).toBe(true);
  });
});

describe('notify', () => {
  it('syncCountMessage: odmiana jak stary sync', () => {
    expect(syncCountMessage(1)).toBe('Zsynchronizowano 1 wynik.');
    expect(syncCountMessage(3)).toBe('Zsynchronizowano 3 wyniki.');
    expect(syncCountMessage(7)).toBe('Zsynchronizowano 7 wyników.');
  });

  it('toast w DOM (happy-dom): montaż, guard duplikatów, akcje', () => {
    document.body.innerHTML = '';
    expect(toast({ id: 't1', titleHtml: 'T', messageHtml: 'M' })).toBe(true);
    expect(document.getElementById('t1')).not.toBeNull();
    // duplikat: ten sam id wisi → false
    expect(toast({ id: 't1', titleHtml: 'T', messageHtml: 'M' })).toBe(false);

    let clicked = null;
    expect(toast({
      id: 't2',
      titleHtml: 'Up',
      messageHtml: 'Nowa wersja',
      actions: [{ id: 'go', label: 'Idź', primary: true, onClick: () => { clicked = 'go'; } }],
    })).toBe(true);
    document.getElementById('go').click();
    expect(clicked).toBe('go');
    document.body.innerHTML = '';
    resetNotifyAdapter();
  });
});

describe('notify modal seam (A5)', () => {
  it('Notify deleguje do adaptera — domena nie zna DOM', async () => {
    const calls = [];
    setNotifyModalAdapter({
      alert: async (m, t) => { calls.push(['alert', m, t]); },
      confirm: async (m, t) => { calls.push(['confirm', m, t]); return true; },
      prompt: async (m, d) => { calls.push(['prompt', m, d]); return 'x'; },
    });
    await Notify.info('hello');
    expect(calls).toEqual([['alert', 'hello', 'info']]);
    await Notify.error('boom');
    expect(calls[1]).toEqual(['alert', 'boom', 'error']);
    expect(await Notify.confirm('sure?')).toBe(true);
    expect(calls[2]).toEqual(['confirm', 'sure?', 'question']);
    expect(await Notify.prompt('imię', 'jan')).toBe('x');
    resetNotifyModalAdapter();
  });

  it('Notify.custom deleguje wybór przycisków', async () => {
    const calls = [];
    setNotifyModalAdapter({
      alert: async () => {},
      confirm: async () => false,
      prompt: async () => null,
      custom: async (m, buttons) => { calls.push([m, buttons.map((b) => b.value)]); return 'move'; },
    });
    const buttons = [
      { label: 'Przenieś', value: 'move', class: 'btn primary' },
      { label: 'Anuluj', value: false, class: 'btn outline' },
    ];
    expect(await Notify.custom('Co robić?', buttons)).toBe('move');
    expect(calls).toEqual([['Co robić?', ['move', false]]]);
    resetNotifyModalAdapter();
  });
});
