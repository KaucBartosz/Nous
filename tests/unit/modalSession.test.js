import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openModalSession } from '../../src/modules/modalSession.js';

function mount() {
  const before = document.createElement('button');
  before.id = 'before';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <button id="first">First</button>
    <button id="last">Last</button>
  `;
  document.body.append(before, overlay);
  return { before, overlay };
}

describe('openModalSession', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.classList.remove('modal-open');
  });

  it('otwiera okno, ustawia focus i przywraca go po zamknięciu', async () => {
    const { before, overlay } = mount();
    before.focus();

    const session = openModalSession(overlay, { focusSelector: '#last' });

    expect(overlay.classList.contains('hidden')).toBe(false);
    expect(document.body.classList.contains('modal-open')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement.id).toBe('last');

    session.close();
    expect(overlay.classList.contains('hidden')).toBe(true);
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  it('zamknięcie w tej samej kolejce nie kradnie focusu po close()', async () => {
    const { before, overlay } = mount();
    before.focus();

    const session = openModalSession(overlay);
    session.close();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.activeElement).toBe(before);
  });

  it('Escape i kliknięcie tła wywołują onDismiss', () => {
    const { overlay } = mount();
    const onDismiss = vi.fn();
    const session = openModalSession(overlay, { onDismiss });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(onDismiss).toHaveBeenCalledTimes(2);
    session.close();
  });

  it('po zamknięciu nie reaguje na Escape', () => {
    const { overlay } = mount();
    const onDismiss = vi.fn();
    const session = openModalSession(overlay, { onDismiss });

    session.close();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('nie dubluje własnego handlera Escape, gdy handleEscape:false', () => {
    const { overlay } = mount();
    const onDismiss = vi.fn();
    const session = openModalSession(overlay, { onDismiss, handleEscape: false });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).not.toHaveBeenCalled();

    session.close();
  });
});
