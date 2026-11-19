import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const adminHtml = readFileSync(resolve(process.cwd(), 'admin.html'), 'utf8');

describe('semantyka UI (Etap B)', () => {
  it('wszystkie okna modalne mają rolę dialogu i etykietę', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const overlays = [...doc.querySelectorAll('.modal-overlay')];
    expect(overlays.length).toBeGreaterThan(0);
    for (const overlay of overlays) {
      const id = overlay.id || 'modal-overlay';
      expect(overlay.getAttribute('role'), id).toBe('dialog');
      expect(overlay.getAttribute('aria-modal'), id).toBe('true');
      const labelId = overlay.getAttribute('aria-labelledby');
      expect(labelId, id).toBeTruthy();
      expect(doc.getElementById(labelId), `${id} -> ${labelId}`).toBeTruthy();
    }
  });

  it('aria-label w szkieletcie ma klucz i18n, który istnieje w obu językach', async () => {
    const { setLocale, t } = await import('../../src/i18n/index.js');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const labels = [...doc.querySelectorAll('[data-i18n-aria-label]')];
    expect(labels.length).toBeGreaterThan(0);
    for (const locale of ['pl', 'en']) {
      setLocale(locale, { persist: false });
      for (const el of labels) {
        const key = el.getAttribute('data-i18n-aria-label');
        expect(t(key), `${locale}: ${key}`).not.toBe(key);
      }
    }
    setLocale('pl', { persist: false });
  });

  it('ikony Material Icons są ukryte przed czytnikiem', () => {
    const tags = html.match(/<[^>]*class="material-icons[^"]*"[^>]*>/g) || [];
    expect(tags.length).toBeGreaterThan(50);
    const withoutHidden = tags.filter(
      (tag) => !tag.includes('aria-hidden="true"') && !/<(button|a)\b/.test(tag),
    );
    expect(withoutHidden).toEqual([]);
    // Element focusowalny nie może być jednocześnie aria-hidden.
    expect(tags.filter((tag) => /<(button|a)\b/.test(tag) && tag.includes('aria-hidden="true"')))
      .toEqual([]);
  });

  it('kontenery błędów i statusów mają aria-live', () => {
    for (const id of ['error-msg', 'cp-error', 'pin-enter-error', 'whats-new-error']) {
      const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
      expect(tag, id).toContain('role="alert"');
    }
    for (const id of ['settings-status', 'app-update-status', 'demo-status']) {
      const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
      expect(tag, id).toContain('aria-live="polite"');
    }
    const adminStatus = adminHtml.match(/<[^>]*id="login-status"[^>]*>/)?.[0] || '';
    expect(adminStatus).toContain('role="alert"');
  });

  it('skip link celuje w main content', () => {
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('id="main-content"');
  });

  it('nagłówki tabel i sortowanie mają semantykę', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    for (const id of ['history-table', 'stats-runs-table', 'updates-table']) {
      expect(doc.getElementById(id), id).toBeTruthy();
    }
    // Każda tabela ma opis dla czytnika — liczba wynika z DOM, nie ze stałej.
    const tables = [...doc.querySelectorAll('table')];
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.querySelector('caption.sr-only'), table.id).toBeTruthy();
    }
    // Nagłówek sortowalny musi mieć klucz i etykietę; liczba może rosnąć.
    const sortHeaders = [...doc.querySelectorAll('th[data-sort]')];
    expect(sortHeaders.length).toBeGreaterThan(0);
    for (const th of sortHeaders) {
      expect(th.dataset.sort).toBeTruthy();
      expect(th.textContent.trim() || th.getAttribute('data-i18n'), th.outerHTML).toBeTruthy();
    }
    expect(readFileSync(resolve(process.cwd(), 'src/modules/library.js'), 'utf8'))
      .toContain('data-sort="name"');
    expect(doc.getElementById('selectAllHistory')).toBeTruthy();
  });

  it('pasek postępu aktualizacji ma wartości', () => {
    expect(html).toContain('id="app-update-progress-container"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
  });

  it('przełączniki widoku i hasła mają aria-pressed', () => {
    for (const id of ['view-grid', 'view-list', 'view-table', 'view-compact',
      'btn-toggle-password', 'btn-toggle-local-password']) {
      const tag = html.match(new RegExp(`<[^>]*id="${id}"[^>]*>`))?.[0] || '';
      expect(tag, id).toMatch(/aria-pressed="(true|false)"/);
    }
  });

  it('zawartość Co nowego jest wewnątrz swojego widoku', () => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const content = doc.getElementById('whats-new-content');
    expect(content.closest('#whats-new-view')).not.toBeNull();
    expect(content.closest('.whats-new-container')).not.toBeNull();
    expect(doc.querySelector('.whats-new-container').closest('#whats-new-view')).not.toBeNull();
  });

  it('panel admina ma nagłówek h1 i focusowalne pola', () => {
    expect(adminHtml).toContain('<h1 class="sr-only">');
    expect(adminHtml).not.toContain('outline: none');
  });
});
