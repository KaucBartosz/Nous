import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Dialog } from '../../src/modules/dialog.js';

// ==========================================================
// Helper to create mock DOM elements
// ==========================================================
function createMockDOM() {
  // Create mock elements
  const overlay = document.createElement('div');
  overlay.id = 'custom-dialog-modal';
  overlay.classList.add('hidden');

  const titleEl = document.createElement('h3');
  titleEl.id = 'custom-dialog-title';

  const messageEl = document.createElement('p');
  messageEl.id = 'custom-dialog-message';

  const iconEl = document.createElement('div');
  iconEl.id = 'custom-dialog-icon';

  const footerEl = document.createElement('div');
  footerEl.id = 'custom-dialog-footer';

  const closeBtn = document.createElement('button');
  closeBtn.id = 'btn-close-custom-dialog';
  closeBtn.innerHTML = '&times;';

  // Append to body
  document.body.appendChild(overlay);
  overlay.appendChild(titleEl);
  overlay.appendChild(messageEl);
  overlay.appendChild(iconEl);
  overlay.appendChild(footerEl);
  document.body.appendChild(closeBtn);

  return { overlay, titleEl, messageEl, iconEl, footerEl, closeBtn };
}

// ==========================================================
// Dialog Tests
// ==========================================================
describe('Dialog', () => {
  let mockElements;

  beforeEach(() => {
    // Reset Dialog state
    Dialog.overlay = null;
    Dialog.titleEl = null;
    Dialog.messageEl = null;
    Dialog.iconEl = null;
    Dialog.footerEl = null;
    Dialog.closeBtn = null;
    Dialog.resolvePromise = null;

    // Create fresh DOM
    document.body.innerHTML = '';
    mockElements = createMockDOM();

    // Use real timers for these tests
    vi.useRealTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // ==========================================================
  // init() Tests
  // ==========================================================
  describe('init', () => {
    it('initializes DOM element references', () => {
      Dialog.init();

      expect(Dialog.overlay).not.toBeNull();
      expect(Dialog.titleEl).not.toBeNull();
      expect(Dialog.messageEl).not.toBeNull();
      expect(Dialog.iconEl).not.toBeNull();
      expect(Dialog.footerEl).not.toBeNull();
      expect(Dialog.closeBtn).not.toBeNull();
    });

    it('does not re-initialize if already initialized', () => {
      Dialog.init();
      const firstOverlay = Dialog.overlay;

      Dialog.init();
      expect(Dialog.overlay).toBe(firstOverlay);
    });

    it('adds click handler to close button', () => {
      const spy = vi.spyOn(mockElements.closeBtn, 'addEventListener');
      Dialog.init();

      expect(spy).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('adds Escape key handler to document', () => {
      const spy = vi.spyOn(document, 'addEventListener');
      Dialog.init();

      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // ==========================================================
  // alert() Tests
  // ==========================================================
  describe('alert', () => {
    it('returns a promise', () => {
      const result = Dialog.alert('Test message');
      expect(result).toBeInstanceOf(Promise);
    });

    it('shows overlay (removes hidden class)', async () => {
      const promise = Dialog.alert('Test message');

      expect(mockElements.overlay.classList.contains('hidden')).toBe(false);
      
      // Clean up - resolve the promise
      Dialog.close(true);
      await promise;
    });

    it('sets message text content', async () => {
      const promise = Dialog.alert('Test message');
      
      expect(mockElements.messageEl.textContent).toBe('Test message');
      
      Dialog.close(true);
      await promise;
    });

    it('creates OK button for alert', async () => {
      const promise = Dialog.alert('Test');

      const buttons = mockElements.footerEl.querySelectorAll('button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent).toBe('OK');
      expect(buttons[0].className).toBe('btn primary');

      Dialog.close(true);
      await promise;
    });

    it('resolves when OK button is clicked', async () => {
      const promise = Dialog.alert('Test');

      const okBtn = mockElements.footerEl.querySelector('button');
      okBtn.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves when close button (X) is clicked', async () => {
      const promise = Dialog.alert('Test');

      mockElements.closeBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('sets correct icon and title for info type', async () => {
      const promise = Dialog.alert('Test', 'info');

      expect(mockElements.titleEl.textContent).toBe('Informacja');
      expect(mockElements.iconEl.innerHTML).toContain('info_outline');

      Dialog.close(true);
      await promise;
    });

    it('sets correct icon and title for error type', async () => {
      const promise = Dialog.alert('Test', 'error');

      expect(mockElements.titleEl.textContent).toBe('Błąd');
      expect(mockElements.iconEl.innerHTML).toContain('error_outline');
      expect(mockElements.iconEl.innerHTML).toContain('#f44336'); // red color

      Dialog.close(true);
      await promise;
    });

    it('sets correct icon and title for success type', async () => {
      const promise = Dialog.alert('Test', 'success');

      expect(mockElements.titleEl.textContent).toBe('Sukces');
      expect(mockElements.iconEl.innerHTML).toContain('check_circle_outline');
      expect(mockElements.iconEl.innerHTML).toContain('#4caf50'); // green color

      Dialog.close(true);
      await promise;
    });

    it('sets correct icon and title for warning type', async () => {
      const promise = Dialog.alert('Test', 'warning');

      expect(mockElements.titleEl.textContent).toBe('Uwaga');
      expect(mockElements.iconEl.innerHTML).toContain('warning_amber');
      expect(mockElements.iconEl.innerHTML).toContain('#ff9800'); // orange color

      Dialog.close(true);
      await promise;
    });

    it('uses textContent to prevent XSS', async () => {
      const malicious = '<script>alert("XSS")</script>';
      const promise = Dialog.alert(malicious);

      // Should be escaped/contained as text, not executed
      expect(mockElements.messageEl.textContent).toBe(malicious);
      expect(mockElements.messageEl.innerHTML).not.toContain('<script>');

      Dialog.close(true);
      await promise;
    });
  });

  // ==========================================================
  // confirm() Tests
  // ==========================================================
  describe('confirm', () => {
    it('returns a promise', () => {
      const result = Dialog.confirm('Are you sure?');
      expect(result).toBeInstanceOf(Promise);
    });

    it('creates Cancel and Confirm buttons', async () => {
      const promise = Dialog.confirm('Are you sure?');

      const buttons = mockElements.footerEl.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Anuluj');
      expect(buttons[0].className).toBe('btn outline');
      expect(buttons[1].textContent).toBe('Tak');
      expect(buttons[1].className).toBe('btn primary');

      Dialog.close(false);
      await promise;
    });

    it('resolves to true when Confirm button is clicked', async () => {
      const promise = Dialog.confirm('Are you sure?');

      const confirmBtn = mockElements.footerEl.querySelectorAll('button')[1];
      confirmBtn.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves to false when Cancel button is clicked', async () => {
      const promise = Dialog.confirm('Are you sure?');

      const cancelBtn = mockElements.footerEl.querySelectorAll('button')[0];
      cancelBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('resolves to false when close button (X) is clicked', async () => {
      const promise = Dialog.confirm('Are you sure?');

      mockElements.closeBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    it('resolves to false when Escape key is pressed', async () => {
      Dialog.init(); // Ensure keydown listener is attached
      const promise = Dialog.confirm('Are you sure?');

      // Simulate Escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('sets correct icon and title for question type', async () => {
      const promise = Dialog.confirm('Are you sure?');

      expect(mockElements.titleEl.textContent).toBe('Potwierdzenie');
      expect(mockElements.iconEl.innerHTML).toContain('help_outline');

      Dialog.close(false);
      await promise;
    });
  });

  // ==========================================================
  // custom() Tests
  // ==========================================================
  describe('custom', () => {
    it('returns a promise', () => {
      const result = Dialog.custom('Choose an option', [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' }
      ]);
      expect(result).toBeInstanceOf(Promise);
    });

    it('creates custom buttons from config', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'Option A', value: 'a', class: 'btn primary' },
        { label: 'Option B', value: 'b', class: 'btn outline' }
      ]);

      const buttons = mockElements.footerEl.querySelectorAll('button');
      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Option A');
      expect(buttons[0].className).toBe('btn primary');
      expect(buttons[1].textContent).toBe('Option B');
      expect(buttons[1].className).toBe('btn outline');

      Dialog.close(null);
      await promise;
    });

    it('resolves with correct value when button is clicked', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'Option A', value: 'value_a' },
        { label: 'Option B', value: 'value_b' }
      ]);

      const buttonA = mockElements.footerEl.querySelectorAll('button')[0];
      buttonA.click();

      const result = await promise;
      expect(result).toBe('value_a');
    });

    it('uses default class if not specified', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'Default', value: 'x' }
      ]);

      const button = mockElements.footerEl.querySelector('button');
      expect(button.className).toBe('btn outline');

      Dialog.close(null);
      await promise;
    });

    it('sets default title "Wybór akcji"', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'OK', value: true }
      ]);

      expect(mockElements.titleEl.textContent).toBe('Wybór akcji');

      Dialog.close(null);
      await promise;
    });

    it('sets help icon for custom dialog', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'OK', value: true }
      ]);

      expect(mockElements.iconEl.innerHTML).toContain('help_outline');

      Dialog.close(null);
      await promise;
    });

    it('resolves to false when close button is clicked', async () => {
      const promise = Dialog.custom('Choose', [
        { label: 'Option', value: 'opt' }
      ]);

      mockElements.closeBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  // ==========================================================
  // show() Tests
  // ==========================================================
  describe('show', () => {
    it('removes hidden class from overlay', () => {
      Dialog.init();
      mockElements.overlay.classList.add('hidden');

      Dialog.show();

      expect(mockElements.overlay.classList.contains('hidden')).toBe(false);
    });
  });

  // ==========================================================
  // close() Tests
  // ==========================================================
  describe('close', () => {
    it('adds hidden class to overlay', () => {
      Dialog.init();
      Dialog.overlay.classList.remove('hidden');

      Dialog.close(true);

      expect(mockElements.overlay.classList.contains('hidden')).toBe(true);
    });

    it('resolves promise with provided result', async () => {
      Dialog.init(); // Initialize to set overlay reference
      let resolveValue;
      const promise = new Promise((resolve) => {
        Dialog.resolvePromise = (val) => {
          resolveValue = val;
          resolve(val);
        };
      });

      Dialog.close('custom_result');

      const result = await promise;
      expect(result).toBe('custom_result');
    });

    it('clears resolvePromise after resolving', () => {
      Dialog.init(); // Initialize to set overlay reference
      Dialog.resolvePromise = () => {};

      Dialog.close(true);

      expect(Dialog.resolvePromise).toBeNull();
    });

    it('handles no pending promise gracefully', () => {
      Dialog.init(); // Initialize to set overlay reference
      Dialog.resolvePromise = null;

      // Should not throw
      expect(() => Dialog.close(true)).not.toThrow();
    });
  });

  // ==========================================================
  // Escape Key Handler Tests
  // ==========================================================
  describe('Escape key handler', () => {
    it('closes dialog when Escape is pressed and overlay is visible', async () => {
      Dialog.init();
      const promise = Dialog.alert('Test');

      // Dialog is visible
      expect(mockElements.overlay.classList.contains('hidden')).toBe(false);

      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      const result = await promise;
      expect(result).toBe(false);
      expect(mockElements.overlay.classList.contains('hidden')).toBe(true);
    });

    it('does not close dialog when Escape is pressed but overlay is hidden', () => {
      Dialog.init();
      mockElements.overlay.classList.add('hidden');

      // Set up a spy on close
      const closeSpy = vi.spyOn(Dialog, 'close');

      // Press Escape
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      // Should not have called close
      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('does not react to other keys', () => {
      Dialog.init();
      const promise = Dialog.alert('Test');

      // Press Enter (should not close)
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      document.dispatchEvent(enterEvent);

      // Dialog should still be open
      expect(mockElements.overlay.classList.contains('hidden')).toBe(false);

      // Clean up
      Dialog.close(true);
    });
  });
});