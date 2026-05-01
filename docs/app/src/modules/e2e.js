// src/modules/e2e.js
import { db, auth } from '../firebaseConfig.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import {
    hasCloudKey,
    setCloudKeyFromHex,
    clearCloudKey,
    generateRandomHexKey,
    wrapCloudKey,
    unwrapCloudKey,
    formatRecoveryKey,
    unformatRecoveryKey
} from './cryptoService.js';
import { showError } from './ui.js';

// Cached DOM elements (populated by initE2E)
let _els = null;
let _onCloseCallback = null;

function _getEls() {
    if (_els) return _els;
    _els = {
        pinSetupModal: document.getElementById('pin-setup-modal'),
        pinSetupInput: document.getElementById('pin-setup-input'),
        btnSavePin: document.getElementById('btn-save-pin'),
        pinSetupError: document.getElementById('pin-setup-error'),
        pinEnterModal: document.getElementById('pin-enter-modal'),
        pinEnterInput: document.getElementById('pin-enter-input'),
        btnSubmitPin: document.getElementById('btn-submit-pin'),
        btnCancelPin: document.getElementById('btn-cancel-pin'),
        linkForgotPin: document.getElementById('link-forgot-pin'),
        pinEnterError: document.getElementById('pin-enter-error'),
        pinRecoveryModal: document.getElementById('pin-recovery-modal'),
        recoveryCodeInput: document.getElementById('recovery-code-input'),
        newPinInput: document.getElementById('new-pin-input'),
        btnSubmitRecovery: document.getElementById('btn-submit-recovery'),
        btnCloseRecoveryModal: document.getElementById('btn-close-recovery-modal'),
        pinRecoveryError: document.getElementById('pin-recovery-error'),
        recoveryKeyModal: document.getElementById('recovery-key-modal'),
        recoveryKeyDisplay: document.getElementById('recovery-key-display'),
        btnUnderstoodRecovery: document.getElementById('btn-understood-recovery'),
    };
    return _els;
}

/**
 * Initializes E2E event listeners.
 * Call once after DOMContentLoaded.
 */
export function initE2E() {
    const e = _getEls();

    e.btnSavePin?.addEventListener('click', async () => {
        const pin = e.pinSetupInput.value;
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
            e.pinSetupError.textContent = "PIN musi składać się z 6 cyfr.";
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSavePin.disabled = true;
            e.btnSavePin.textContent = "Szyfrowanie...";

            const saltHex = getUserSalt();
            const newMasterKey = generateRandomHexKey();
            const wrapped = await wrapCloudKey(newMasterKey, pin, saltHex);

            await setDoc(doc(db, "user_keys", user.uid), {
                encryptedMasterKey: wrapped.encryptedKey,
                iv: wrapped.iv,
                updatedAt: new Date().toISOString()
            });

            await setCloudKeyFromHex(newMasterKey);

            if (window.electronAPI && window.electronAPI.setE2EKey) {
                await window.electronAPI.setE2EKey(newMasterKey);
            }

            e.pinSetupModal.classList.add('hidden');

            const formattedCode = formatRecoveryKey(newMasterKey);
            e.recoveryKeyDisplay.textContent = formattedCode;
            e.recoveryKeyModal.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            e.pinSetupError.textContent = "Błąd szyfrowania: " + err.message;
        } finally {
            e.btnSavePin.disabled = false;
            e.btnSavePin.textContent = "Zapisz PIN i Utwórz Klucz";
        }
    });

    e.btnUnderstoodRecovery?.addEventListener('click', () => {
        e.recoveryKeyModal.classList.add('hidden');
        if (_onCloseCallback) {
            _onCloseCallback();
            _onCloseCallback = null;
        }
    });

    e.btnSubmitPin?.addEventListener('click', async () => {
        const pin = e.pinEnterInput.value;
        if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
            e.pinEnterError.textContent = "PIN musi składać się z 6 cyfr.";
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSubmitPin.disabled = true;
            e.pinEnterError.textContent = "";

            const originalText = e.btnSubmitPin.textContent;
            e.btnSubmitPin.textContent = "Odszyfrowywanie...";

            const keyDoc = await getDoc(doc(db, "user_keys", user.uid));
            if (!keyDoc.exists()) throw new Error("Brak klucza w chmurze!");

            const data = keyDoc.data();
            const saltHex = getUserSalt();

            const decryptedMasterKeyHex = await unwrapCloudKey(data.encryptedMasterKey, data.iv, pin, saltHex);

            await setCloudKeyFromHex(decryptedMasterKeyHex);

            if (window.electronAPI && window.electronAPI.setE2EKey) {
                await window.electronAPI.setE2EKey(decryptedMasterKeyHex);
            }

            e.pinEnterModal.classList.add('hidden');
            e.btnSubmitPin.textContent = originalText;
            if (_onCloseCallback) {
                _onCloseCallback();
                _onCloseCallback = null;
            }

        } catch (err) {
            console.error(err);
            e.pinEnterError.textContent = "Nieprawidłowy PIN.";
            e.btnSubmitPin.textContent = "Odblokuj";
        } finally {
            e.btnSubmitPin.disabled = false;
        }
    });

    // btnCancelPin intentionally empty — kept for future use

    e.linkForgotPin?.addEventListener('click', (ev) => {
        ev.preventDefault();
        e.pinEnterModal.classList.add('hidden');
        e.recoveryCodeInput.value = "";
        e.newPinInput.value = "";
        e.pinRecoveryError.textContent = "";
        e.pinRecoveryModal.classList.remove('hidden');
    });

    e.btnCloseRecoveryModal?.addEventListener('click', () => {
        e.pinRecoveryModal.classList.add('hidden');
        e.pinEnterModal.classList.remove('hidden');
    });

    e.btnSubmitRecovery?.addEventListener('click', async () => {
        const code = e.recoveryCodeInput.value.trim();
        const newPin = e.newPinInput.value;

        if (!code) {
            e.pinRecoveryError.textContent = "Podaj kod odzyskiwania.";
            return;
        }
        if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
            e.pinRecoveryError.textContent = "Nowy PIN musi mieć 6 cyfr.";
            return;
        }

        const unformattedCode = unformatRecoveryKey(code);
        if (unformattedCode.length !== 64) {
            e.pinRecoveryError.textContent = "Nieprawidłowy format kodu odzyskiwania.";
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSubmitRecovery.disabled = true;
            e.btnSubmitRecovery.textContent = "Resetowanie...";

            if (!/^[0-9a-f]{64}$/i.test(unformattedCode)) {
                throw new Error("Kod zawiera niedozwolone znaki.");
            }

            const saltHex = getUserSalt();
            const wrapped = await wrapCloudKey(unformattedCode, newPin, saltHex);

            await setDoc(doc(db, "user_keys", user.uid), {
                encryptedMasterKey: wrapped.encryptedKey,
                iv: wrapped.iv,
                updatedAt: new Date().toISOString()
            });

            await setCloudKeyFromHex(unformattedCode);

            if (window.electronAPI && window.electronAPI.setE2EKey) {
                await window.electronAPI.setE2EKey(unformattedCode);
            }

            e.pinRecoveryModal.classList.add('hidden');

            if (_onCloseCallback) {
                _onCloseCallback();
                _onCloseCallback = null;
            }

        } catch (err) {
            console.error(err);
            e.pinRecoveryError.textContent = "Błąd: " + err.message;
        } finally {
            e.btnSubmitRecovery.disabled = false;
            e.btnSubmitRecovery.textContent = "Odzyskaj Klucz";
        }
    });
}

/**
 * Zwraca sól dla KDF dla obecnego usera
 */
function getUserSalt() {
    const user = auth.currentUser;
    if (!user) throw new Error("Brak uzytkownika");
    return Array.from(user.uid).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

/**
 * Check if the user has E2E setup in Firebase.
 * Shows PIN enter or PIN setup accordingly.
 * @param {Object} user - Firebase user object
 * @param {Function} onSuccess - Callback called when Cloud Key is loaded to RAM
 */
export async function verifyE2E(user, onSuccess) {
    if (hasCloudKey()) {
        if (onSuccess) onSuccess();
        return;
    }

    if (!user) {
        if (onSuccess) onSuccess();
        return;
    }

    _onCloseCallback = onSuccess;

    try {
        if (window.electronAPI && window.electronAPI.getE2EKey) {
            const savedHexKey = await window.electronAPI.getE2EKey();
            if (savedHexKey) {
                await setCloudKeyFromHex(savedHexKey);
                if (onSuccess) onSuccess();
                return;
            }
        }
    } catch (e) {
        console.warn("Failed to load local E2E key via safeStorage:", e);
    }

    const e = _getEls();

    try {
        const keyDoc = await getDoc(doc(db, "user_keys", user.uid));
        if (keyDoc.exists() && keyDoc.data().encryptedMasterKey) {
            e.pinEnterInput.value = "";
            e.pinEnterError.textContent = "";
            e.pinEnterModal.classList.remove('hidden');
        } else {
            e.pinSetupInput.value = "";
            e.pinSetupError.textContent = "";
            e.pinSetupModal.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Failed to check user_keys", e);
        import('./dialog.js').then(({ Dialog }) => {
            Dialog.alert("Błąd połączenia z bazą kluczy E2E. Prawdopodobnie brak wymaganych reguł w Firestore (collections: user_keys). Zgłoś to administratorowi. Szczegóły: " + e.message, 'error');
        });
        if (onSuccess) onSuccess();
    }
}
