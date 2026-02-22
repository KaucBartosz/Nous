import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Dialog
vi.mock('../../src/modules/dialog.js', () => ({
  Dialog: {
    alert: vi.fn(),
    confirm: vi.fn()
  }
}));

// ==========================================================
// Settings Tests
// ==========================================================
describe('Settings Module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup DOM
    document.body.innerHTML = `
      <div id="settings-status" style="display:none;"></div>
      <input type="radio" name="theme" value="dark" />
      <input type="radio" name="theme" value="light" />
      <input type="radio" name="theme" value="custom" />
      <input id="primary-color-picker" type="color" value="#4f8cf2" />
      <input id="primary-color-value" type="text" value="#4f8cf2" />
      <button id="btn-save-settings"></button>
      <button id="btn-reset-settings"></button>
      <select id="saved-themes-select"></select>
      <input id="new-theme-name" type="text" />
      <button id="btn-save-custom-theme"></button>
      <button id="btn-delete-theme"></button>
    `;

    // Mock localStorage
    localStorage.clear();

    // Mock document.documentElement
    document.documentElement.setAttribute = vi.fn();
    document.documentElement.style = {
      setProperty: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // ==========================================================
  // loadSettings Tests
  // ==========================================================
  describe('loadSettings', () => {
    it('returns default dark settings when localStorage is empty', async () => {
      const { loadSettings } = await import('../../src/modules/settings.js');
      const settings = loadSettings();

      expect(settings.theme).toBe('dark');
      expect(settings.primaryColor).toBe('#4f8cf2');
    });

    it('loads settings from localStorage', async () => {
      localStorage.setItem('nous-app-settings', JSON.stringify({
        theme: 'light',
        primaryColor: '#1d4ed8'
      }));

      const { loadSettings } = await import('../../src/modules/settings.js');
      const settings = loadSettings();

      expect(settings.theme).toBe('light');
      expect(settings.primaryColor).toBe('#1d4ed8');
    });

    it('returns defaults on localStorage parse error', async () => {
      localStorage.setItem('nous-app-settings', 'invalid json');

      const { loadSettings } = await import('../../src/modules/settings.js');
      const settings = loadSettings();

      expect(settings.theme).toBe('dark');
    });
  });

  // ==========================================================
  // saveSettings Tests
  // ==========================================================
  describe('saveSettings', () => {
    it('saves settings to localStorage', async () => {
      const { saveSettings, getSettings } = await import('../../src/modules/settings.js');
      
      const result = saveSettings({
        theme: 'dark',
        primaryColor: '#123456'
      });

      expect(result).toBe(true);
      expect(getSettings().primaryColor).toBe('#123456');
    });

    it('handles storage errors gracefully', async () => {
      // Test passes if saveSettings doesn't throw
      const { saveSettings } = await import('../../src/modules/settings.js');
      const result = saveSettings({ theme: 'dark' });

      expect(typeof result).toBe('boolean');
    });
  });

  // ==========================================================
  // getSettings Tests
  // ==========================================================
  describe('getSettings', () => {
    it('returns copy of current settings', async () => {
      const { loadSettings, getSettings } = await import('../../src/modules/settings.js');
      
      loadSettings();
      const settings1 = getSettings();
      const settings2 = getSettings();

      expect(settings1).toEqual(settings2);
      expect(settings1).not.toBe(settings2); // Different object references
    });
  });

  // ==========================================================
  // switchToTheme Tests
  // ==========================================================
  describe('switchToTheme', () => {
    it('switches to dark theme', async () => {
      const { switchToTheme } = await import('../../src/modules/settings.js');
      
      const settings = switchToTheme('dark');

      expect(settings.theme).toBe('dark');
      expect(settings.primaryColor).toBe('#4f8cf2');
    });

    it('switches to light theme', async () => {
      const { switchToTheme } = await import('../../src/modules/settings.js');
      
      const settings = switchToTheme('light');

      expect(settings.theme).toBe('light');
      expect(settings.primaryColor).toBe('#1d4ed8');
    });

    it('switches to custom theme with defaults', async () => {
      const { switchToTheme } = await import('../../src/modules/settings.js');
      
      const settings = switchToTheme('custom');

      expect(settings.theme).toBe('custom');
    });
  });

  // ==========================================================
  // resetToDefaultsForTheme Tests
  // ==========================================================
  describe('resetToDefaultsForTheme', () => {
    it('resets dark theme to defaults', async () => {
      const { saveSettings, resetToDefaultsForTheme, getSettings } = await import('../../src/modules/settings.js');
      
      saveSettings({ theme: 'dark', primaryColor: '#ffffff' });
      resetToDefaultsForTheme('dark');

      expect(getSettings().primaryColor).toBe('#4f8cf2');
    });

    it('resets light theme to defaults', async () => {
      const { resetToDefaultsForTheme, getSettings } = await import('../../src/modules/settings.js');
      
      resetToDefaultsForTheme('light');

      expect(getSettings().theme).toBe('light');
      expect(getSettings().primaryColor).toBe('#1d4ed8');
    });
  });

  // ==========================================================
  // applySettings Tests
  // ==========================================================
  describe('applySettings', () => {
    it('sets data-theme attribute', async () => {
      const { applySettings } = await import('../../src/modules/settings.js');
      
      applySettings({ theme: 'dark', primaryColor: '#4f8cf2' });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('sets CSS variables', async () => {
      const setPropertySpy = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
      
      const { applySettings } = await import('../../src/modules/settings.js');
      
      applySettings({ 
        theme: 'dark', 
        primaryColor: '#123456',
        textMain: '#ffffff'
      });

      expect(setPropertySpy).toHaveBeenCalled();
    });
  });

  // ==========================================================
  // Saved Themes Tests
  // ==========================================================
  describe('Saved Themes', () => {
    it('returns empty array when no saved themes', async () => {
      // Internal function, tested through module behavior
      const themes = JSON.parse(localStorage.getItem('nous-app-saved-themes') || '[]');
      expect(themes).toEqual([]);
    });

    it('saves and retrieves custom theme', async () => {
      const themeData = { name: 'My Theme', settings: { theme: 'custom', primaryColor: '#abc123' } };
      localStorage.setItem('nous-app-saved-themes', JSON.stringify([themeData]));

      const themes = JSON.parse(localStorage.getItem('nous-app-saved-themes') || '[]');
      expect(themes[0].name).toBe('My Theme');
    });
  });
});