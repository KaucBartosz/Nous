import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Nie potrzebujemy bezpośrednich mocków modułów, ale korzystamy z global.fetch i window.electronAPI

describe('whatsNew module', () => {
  let whatsNewModule;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Podstawowy DOM wymagany przez moduł
    document.body.innerHTML = `
      <div class="whats-new-container">
        <div class="content-area"></div>
        <div id="whats-new-content"></div>
        <div id="whats-new-loading" style="display:none;"></div>
        <div id="whats-new-error" style="display:none;"></div>
        <button id="btn-refresh-whats-new"></button>
        <button id="btn-open-github"></button>
        <button id="btn-prev-release"></button>
        <button id="btn-next-release"></button>
        <span id="release-nav-index"></span>
      </div>
    `;

    // Upewnij się, że electronAPI istnieje
    // (ustawiany globalnie w tests/setup.js, ale tu czyścimy tylko mocki)
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal.mockClear();
    }

    localStorage.clear();

    whatsNewModule = await import('../../src/modules/whatsNew.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    // Przywróć fetch jeśli był nadpisany
    if (typeof global.fetch !== 'undefined' && 'mockRestore' in global.fetch) {
      // @ts-expect-error - fetch mock
      global.fetch.mockRestore();
    }
  });

  // ----------------------------------------------------------
  // initWhatsNew
  // ----------------------------------------------------------
  it('inicjalizuje listenery tylko raz (guard isInitialized)', () => {
    const refreshBtn = document.getElementById('btn-refresh-whats-new');
    const spy = vi.spyOn(refreshBtn, 'addEventListener');

    whatsNewModule.initWhatsNew();
    whatsNewModule.initWhatsNew(); // drugi raz nie powinien dodać listenerów

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
  });

  // ----------------------------------------------------------
  // loadWhatsNew - użycie cache
  // ----------------------------------------------------------
  it('loadWhatsNew korzysta z cache kiedy jest dostępny i nie wymuszono odświeżenia', () => {
    const cachedRelease = {
      title: 'Wydanie 1.0.0',
      version: 'v1.0.0',
      date: '2025-01-01',
      body: 'Opis **wersji**',
      html_url: 'https://example.com/release'
    };

    const cache = {
      data: [cachedRelease],
      timestamp: Date.now()
    };

    localStorage.setItem('whats_new_cache_v2', JSON.stringify(cache));

    whatsNewModule.loadWhatsNew(false);

    const contentEl = document.getElementById('whats-new-content');
    const loadingEl = document.getElementById('whats-new-loading');
    const errorEl = document.getElementById('whats-new-error');

    // Loader powinien być ukryty, treść widoczna
    expect(loadingEl.style.display).toBe('none');
    expect(contentEl.style.display).toBe('block');
    expect(errorEl.style.display).toBe('none');

    // Tytuł wersji jest wyrenderowany w nagłówku
    const headerTitle = contentEl.querySelector('h4');
    expect(headerTitle.textContent).toBe('Wydanie 1.0.0');

    // Link do GitHuba jest obecny
    const link = contentEl.querySelector('a');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('https://example.com/release');
  });

  // ----------------------------------------------------------
  // loadWhatsNew - pobieranie z GitHuba
  // ----------------------------------------------------------
  it('loadWhatsNew pobiera dane z GitHuba gdy brak cache lub wymuszone odświeżenie', async () => {
    const releaseFromApi = {
      name: 'API Release',
      tag_name: 'v2.0.0',
      published_at: '2025-02-01T00:00:00.000Z',
      body: 'Treść z API',
      html_url: 'https://github.com/KaucBartosz/Nous/releases/v2.0.0'
    };

    const fetchMock = vi
      // @ts-expect-error - mock fetch
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => [releaseFromApi]
      });

    // Upewnij się, że nie ma cache
    localStorage.removeItem('whats_new_cache_v2');

    whatsNewModule.loadWhatsNew(true);

    // Poczekaj aż promisy z then() się wykonają
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/KaucBartosz/Nous/releases?per_page=10',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/vnd.github.v3+json'
        })
      })
    );

    const contentEl = document.getElementById('whats-new-content');
    const headerTitle = contentEl.querySelector('h4');
    expect(headerTitle.textContent).toContain('API Release');
  });

  // ----------------------------------------------------------
  // Przycisk GitHub
  // ----------------------------------------------------------
  it('przycisk GitHub korzysta z window.electronAPI.openExternal jeśli dostępne', () => {
    if (!window.electronAPI) {
      // @ts-expect-error - do testu tworzymy API
      window.electronAPI = {
        openExternal: vi.fn()
      };
    }

    const openExternalSpy = window.electronAPI.openExternal;

    whatsNewModule.initWhatsNew();

    const githubBtn = document.getElementById('btn-open-github');
    githubBtn.click();

    expect(openExternalSpy).toHaveBeenCalledWith(
      'https://github.com/KaucBartosz/Nous/releases/'
    );
  });
});

