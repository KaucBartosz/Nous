import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const adminHtml = readFileSync(resolve(process.cwd(), 'admin.html'), 'utf8');

describe('semantyka UI (Etap B)', () => {
  it('wszystkie okna modalne mają rolę dialogu i etykietę', () => {
    const overlays = html.match(/class="modal-overlay[^"]*"[^>]*>/g) || [];
    expect(overlays.length).toBe(8);
    const dialogs = html.match(/role="dialog" aria-modal="true" aria-labelledby="/g) || [];
    expect(dialogs.length).toBe(8);
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
    for (const id of ['history-table', 'stats-runs-table', 'updates-table']) {
      expect(html, id).toContain(`<table id="${id}"`);
    }
    expect((html.match(/<caption class="sr-only"/g) || []).length).toBe(5);
    // 5 nagłówków historii + 2 statystyk; 4 nagłówki biblioteki są w JS.
    expect((html.match(/data-sort="/g) || []).length).toBeGreaterThanOrEqual(7);
    expect(readFileSync(resolve(process.cwd(), 'src/modules/library.js'), 'utf8'))
      .toContain('data-sort="name"');
    expect(html).toContain('id="selectAllHistory"');
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

  it('panel admina ma nagłówek h1 i focusowalne pola', () => {
    expect(adminHtml).toContain('<h1 class="sr-only">');
    expect(adminHtml).not.toContain('outline: none');
  });
});
