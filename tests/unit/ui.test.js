import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==========================================================
// UI Tests
// ==========================================================
describe('UI Module', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Setup DOM elements for UI module
    document.body.innerHTML = `
      <div id="login-screen" class="">
        <div class="login-card">
          <input id="email" type="text" />
          <input id="password" type="password" />
          <div id="error-msg"></div>
        </div>
      </div>
      <div id="dashboard-screen" class="hidden"></div>
      <div id="user-email-display"></div>
      <div id="user-status-display"></div>
      <div id="sync-toggle-container"></div>
      
      <nav>
        <button id="nav-library"></button>
        <button id="nav-history"></button>
        <button id="nav-updates"></button>
        <button id="nav-demographics"></button>
        <button id="nav-demo-creator"></button>
        <button id="nav-settings"></button>
        <button id="nav-whats-new"></button>
      </nav>
      
      <div id="library-view" class="hidden"></div>
      <div id="history-view" class="hidden"></div>
      <div id="updates-view" class="hidden"></div>
      <div id="demographics-view" class="hidden"></div>
      <div id="demo-creator-view" class="hidden"></div>
      <div id="settings-view" class="hidden"></div>
      <div id="whats-new-view" class="hidden"></div>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  // ==========================================================
  // elements Tests
  // ==========================================================
  describe('elements', () => {
    it('returns DOM elements by id', async () => {
      const { elements } = await import('../../src/modules/ui.js');

      expect(elements.loginScreen).toBeDefined();
      expect(elements.dashboardScreen).toBeDefined();
      expect(elements.emailInput).toBeDefined();
    });

    it('returns null for non-existent elements', async () => {
      const { elements } = await import('../../src/modules/ui.js');

      // Proxy returns null from getElementById for non-existent elements
      const result = elements.nonExistentElement;
      expect(result).toBeFalsy(); // null or undefined
    });
  });

  // ==========================================================
  // switchView Tests
  // ==========================================================
  describe('switchView', () => {
    it('shows library view and activates nav', async () => {
      const { switchView } = await import('../../src/modules/ui.js');

      switchView('library');

      const libraryView = document.getElementById('library-view');
      const navLibrary = document.getElementById('nav-library');

      expect(libraryView.classList.contains('hidden')).toBe(false);
      expect(navLibrary.classList.contains('active')).toBe(true);
    });

    it('hides other views', async () => {
      const { switchView } = await import('../../src/modules/ui.js');

      switchView('library');
      switchView('history');

      const libraryView = document.getElementById('library-view');
      const historyView = document.getElementById('history-view');

      expect(libraryView.classList.contains('hidden')).toBe(true);
      expect(historyView.classList.contains('hidden')).toBe(false);
    });

    it('calls callback function', async () => {
      const { switchView } = await import('../../src/modules/ui.js');
      const callback = vi.fn();

      switchView('library', { onLibrary: callback });

      expect(callback).toHaveBeenCalled();
    });

    it('handles unknown view gracefully', async () => {
      const { switchView } = await import('../../src/modules/ui.js');
      const consoleSpy = vi.spyOn(console, 'warn');

      switchView('unknown-view');

      expect(consoleSpy).toHaveBeenCalledWith('Unknown view: unknown-view');
    });
  });

  // ==========================================================
  // updateAuthUI Tests
  // ==========================================================
  describe('updateAuthUI', () => {
    it('shows dashboard and hides login screen', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI('test@example.com', 'APPROVED');

      const loginScreen = document.getElementById('login-screen');
      const dashboardScreen = document.getElementById('dashboard-screen');

      expect(loginScreen.classList.contains('hidden')).toBe(true);
      expect(dashboardScreen.classList.contains('hidden')).toBe(false);
    });

    it('displays user email', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI('test@example.com', 'APPROVED');

      const emailDisplay = document.getElementById('user-email-display');
      expect(emailDisplay.textContent).toBe('test@example.com');
    });

    it('displays guest for null email', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI(null, 'GUEST');

      const emailDisplay = document.getElementById('user-email-display');
      expect(emailDisplay.textContent).toBe('Gość');
    });

    it('sets green color for APPROVED status', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI('test@example.com', 'APPROVED');

      const statusDisplay = document.getElementById('user-status-display');
      expect(statusDisplay.style.color).toBe('#4caf50');
    });

    it('sets orange color for PENDING status', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI('test@example.com', 'PENDING');

      const statusDisplay = document.getElementById('user-status-display');
      expect(statusDisplay.style.color).toBe('#ff9800');
    });

    it('hides sync toggle for GUEST', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI(null, 'GUEST');

      const syncToggle = document.getElementById('sync-toggle-container');
      expect(syncToggle.classList.contains('hidden')).toBe(true);
    });

    it('shows sync toggle for non-GUEST', async () => {
      const { updateAuthUI } = await import('../../src/modules/ui.js');

      updateAuthUI('test@example.com', 'PENDING');

      const syncToggle = document.getElementById('sync-toggle-container');
      expect(syncToggle.classList.contains('hidden')).toBe(false);
    });
  });

  // ==========================================================
  // showLoginScreen Tests
  // ==========================================================
  describe('showLoginScreen', () => {
    it('shows login screen and hides dashboard', async () => {
      const { showLoginScreen } = await import('../../src/modules/ui.js');

      // First show dashboard
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('dashboard-screen').classList.remove('hidden');

      showLoginScreen();

      const loginScreen = document.getElementById('login-screen');
      const dashboardScreen = document.getElementById('dashboard-screen');

      expect(loginScreen.classList.contains('hidden')).toBe(false);
      expect(dashboardScreen.classList.contains('hidden')).toBe(true);
    });
  });

  // ==========================================================
  // showError Tests
  // ==========================================================
  describe('showError', () => {
    it('displays error message', async () => {
      const { showError } = await import('../../src/modules/ui.js');

      showError('Test error message');

      const errorMsg = document.getElementById('error-msg');
      expect(errorMsg.textContent).toBe('Test error message');
    });

    it('clears error message with empty string', async () => {
      const { showError } = await import('../../src/modules/ui.js');

      showError('First error');
      showError('');

      const errorMsg = document.getElementById('error-msg');
      expect(errorMsg.textContent).toBe('');
    });

    it('does not shake for login progress messages', async () => {
      const { showError } = await import('../../src/modules/ui.js');

      const card = document.querySelector('.login-card');
      card.classList.add = vi.fn();
      card.classList.remove = vi.fn();

      showError('Logowanie...');

      // Should not add shake class for progress messages
      expect(card.classList.add).not.toHaveBeenCalledWith('shake');
    });
  });
});