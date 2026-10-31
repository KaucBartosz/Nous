import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shellPolicyFor,
  isTouchDevice,
  touchModeFor,
  TouchMode,
  applyShellPolicy,
} from '../../src/platform/shell.js';

describe('shellPolicyFor', () => {
  it('web: gość, dotyk z ostrzeżeniem, Aktualizacje ukryte, Historia dostępna', () => {
    const web = shellPolicyFor('web');
    expect(web.guestAutoLogin).toBe(true);
    expect(web.touch).toBe('warn');
    expect(web.hiddenNav).toEqual(['navUpdates']);
    expect(web.disabledNav).toEqual([]);
    expect(web.hiddenIds).toContain('btn-save-to-registry');

    const desk = shellPolicyFor('electron');
    expect(desk.guestAutoLogin).toBe(false);
    expect(desk.touch).toBe('off');
    expect(desk.hiddenNav).toEqual([]);
    expect(desk.disabledNav).toEqual([]);
    expect(desk.hiddenIds).toEqual([]);
  });
});

describe('isTouchDevice', () => {
  it('wykrywa dotyk po ontouchstart / maxTouchPoints', () => {
    expect(isTouchDevice({ ontouchstart: true }, {})).toBe(true);
    expect(isTouchDevice({}, { maxTouchPoints: 2 })).toBe(true);
    expect(isTouchDevice({}, { maxTouchPoints: 0 })).toBe(false);
  });
});

describe('touchModeFor (czysta polityka dotyku)', () => {
  it('brak dotyku → brak ostrzeżeń', () => {
    expect(touchModeFor({})).toBe(TouchMode.NONE);
  });

  it('laptop 2-w-1 (dotyk + mysz) → ostrzeżenie, nie blokada', () => {
    expect(touchModeFor({ touch: true, coarse: false, hoverNone: false })).toBe(
      TouchMode.WARN,
    );
    // nawet gdy dotyk zgłasza coarse, ale urządzenie ma hover (np. Surface z myszą)
    expect(touchModeFor({ touch: true, coarse: true, hoverNone: false })).toBe(
      TouchMode.WARN,
    );
  });

  it('tablet / telefon (coarse + brak hover) → blokada', () => {
    expect(touchModeFor({ touch: true, coarse: true, hoverNone: true })).toBe(
      TouchMode.BLOCK,
    );
  });
});

describe('applyShellPolicy (happy-dom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('web: ukrywa martwe elementy i Aktualizacje, zostawia Historię', () => {
    document.body.innerHTML = `
      <div class="header-title">Nous</div>
      <button id="nav-h">H</button><button id="nav-u">U</button>
      <button id="logout">Wyloguj</button>
      <div class="participants-panel">kartoteka</div>
      <button id="btn-save-to-registry">Zapisz</button>`;
    const elements = {
      navHistory: document.getElementById('nav-h'),
      navUpdates: document.getElementById('nav-u'),
      btnLogout: document.getElementById('logout'),
    };
    const notify = { info: vi.fn() };
    const halted = applyShellPolicy(shellPolicyFor('web'), { elements, notify });

    expect(halted).toBe(false);
    expect(elements.btnLogout.style.display).toBe('none');
    expect(document.querySelector('.participants-panel').style.display).toBe('none');
    expect(document.getElementById('btn-save-to-registry').style.display).toBe('none');

    // Aktualizacje są ukryte, a nie "martwe ale widoczne"
    expect(elements.navUpdates.style.display).toBe('none');
    // Historia jest w pełni funkcjonalna w Web
    expect(elements.navHistory.style.opacity).toBe('');
    expect(elements.navHistory.style.display).toBe('');
  });

  it('desktop: nic nie rusza', () => {
    document.body.innerHTML = '<button id="logout">W</button><div class="header-title">N</div>';
    const elements = { btnLogout: document.getElementById('logout') };
    expect(applyShellPolicy(shellPolicyFor('electron'), { elements })).toBe(false);
    expect(elements.btnLogout.style.display).toBe('');
    expect(document.querySelector('.header-title').textContent).toBe('N');
  });

  it('brakujące elementy tolerowane (strona bez paneli)', () => {
    expect(applyShellPolicy(shellPolicyFor('web'), { elements: {} })).toBe(false);
  });

  it('dotyk (laptop): ostrzega, ale nie zatrzymuje aplikacji', () => {
    document.body.innerHTML = '<button id="logout">W</button>';
    window.ontouchstart = () => {};
    try {
      const halted = applyShellPolicy(shellPolicyFor('web'), {
        elements: {},
        notify: { info: vi.fn() },
      });
      expect(halted).toBe(false);
      expect(document.getElementById('touch-notice')).not.toBeNull();
      expect(document.body.textContent).toContain('nie obsługuje ekranu dotykowego');
    } finally {
      delete window.ontouchstart;
    }
  });
});
