import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase imports before module is loaded
vi.mock('../../src/firebaseConfig.js', () => ({
    db: {}
}));
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js', () => ({
    collection: vi.fn(),
    getDocs: vi.fn()
}));
vi.mock('../../src/modules/dialog.js', () => ({
    Dialog: {
        alert: vi.fn(),
        confirm: vi.fn()
    }
}));

// Now we can safely import library.js
import { getTrainingMode, getHpmEnabled, initLibraryListeners } from '../../src/modules/library.js';

describe('Library Module', () => {
    beforeEach(() => {
        // Mock DOM elements that might be used
        document.body.innerHTML = `
            <div id="view-grid"></div>
            <div id="view-list"></div>
            <div id="view-table"></div>
            <div id="view-compact"></div>
            <input type="checkbox" id="toggle-training-mode" />
            <input type="checkbox" id="toggle-hpm" />
            <div id="tests-grid"></div>
            <div id="test-info-modal"></div>
        `;

        // Reset local storage
        localStorage.clear();

        // Clear mocks
        vi.clearAllMocks();
    });

    it('should have training mode disabled by default', () => {
        expect(getTrainingMode()).toBe(false);
    });

    it('should have HPM disabled by default', () => {
        expect(getHpmEnabled()).toBe(false);
    });

    it('should initialize library listeners without errors', () => {
        expect(() => initLibraryListeners()).not.toThrow();
        expect(window.electronAPI.onDownloadProgress).toHaveBeenCalled();
        expect(window.electronAPI.onTestInstalled).toHaveBeenCalled();
        expect(window.electronAPI.onHpmDownloadProgress).toHaveBeenCalled();
        expect(window.electronAPI.onHpmInstalled).toHaveBeenCalled();
        expect(window.electronAPI.onTestProcessStopped).toHaveBeenCalled();
    });
});
