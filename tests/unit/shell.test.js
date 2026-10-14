import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  shellPolicyFor,
  isTouchDevice,
  applyShellPolicy,
} from '../../src/platform/shell.js';

describe('shellPolicyFor', () => {
  it('web: gość + blokady, desktop: pełna powłoka', () => {
    const web = shellPolicyFor('web');
    expect(web.guestAutoLogin).toBe(true);
    expect(web.blockTouchDevices).toBe(true);
    expect(web.disabledNav.map((n) => n.key)).toEqual(['navHistory', 'navUpdates']);
    expect(web.hiddenIds).toContain('btn-save-to-registry');

    const desk = shellPolicyFor('electron');
    expect(desk.guestAutoLogin).toBe(false);
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

describe('applyShellPolicy (happy-dom)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style').forEach((s) => s.remove());
  });

  it('web: ukrywa, blokuje nav (klik → notify), ostrzega w nagłówku', () => {
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
    expect(document.querySelector('.header-title').textContent).toContain('Przeglądarkowa');
    expect(elements.navHistory.style.opacity).toBe('0.5');

    elements.navHistory.click();
    expect(notify.info).toHaveBeenCalledWith(expect.stringContaining('Desktopowej'));
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

  it('dotyk: przejmuje body i haltuje boot', () => {
    document.body.innerHTML = '<button id="logout">W</button>';
    window.ontouchstart = () => {};
    try {
      const halted = applyShellPolicy(shellPolicyFor('web'), { elements: {} });
      expect(halted).toBe(true);
      expect(document.body.innerHTML).toContain('ekranach dotykowych');
    } finally {
      delete window.ontouchstart;
    }
  });
});
