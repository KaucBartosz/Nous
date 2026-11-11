// src/modules/e2e.js
import { fetchUserKeys, saveUserKeys } from '../cloud/firebase.js';
import {
    hasCloudKey,
    setCloudKeyFromHex,
    generateRandomHexKey,
    wrapCloudKey,
    unwrapCloudKey,
    formatRecoveryKey,
    unformatRecoveryKey
} from './cryptoService.js';
import {
    isValidPin,
    saltForUid,
    setupNewMaster,
    unlockWithPin,
    recoverWithCode,
    describeRemoteKey,
} from '../session/e2ePolicy.js';
import { createCloudVault, createLocalVault } from '../session/keyVault.js';

/** Vault chmury nad prawdziwym Firestore (zależności jawne, polityka w session/). */
function cloudVault() {
    return createCloudVault({
        getDocFn: fetchUserKeys,
        setDocFn: saveUserKeys,
        wrapFn: wrapCloudKey,
        unwrapFn: unwrapCloudKey,
        randomHexFn: generateRandomHexKey,
    });
}
import { getPlatform } from '../platform/index.js';
import { t } from '../i18n/index.js';

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
        if (!isValidPin(pin)) {
            e.pinSetupError.textContent = t('e2e.pinInvalid');
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSavePin.disabled = true;
            e.btnSavePin.textContent = t('e2e.encrypting');

            // C4: orkiestracja w session/e2ePolicy.js, tu tylko UI + persist
            const newMasterKey = await setupNewMaster(
                { uid: user.uid, pin, salt: saltForUid(user.uid) },
                cloudVault(),
                { setRamKey: setCloudKeyFromHex },
            );

            // C1: zapis klucza przez seam (Web/Fake obsłużone w adapterze)
            await getPlatform().keys.setE2EKey(newMasterKey);

            e.pinSetupModal.classList.add('hidden');

            const formattedCode = formatRecoveryKey(newMasterKey);
            e.recoveryKeyDisplay.textContent = formattedCode;
            e.recoveryKeyModal.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            e.pinSetupError.textContent = t('e2e.encryptError', { message: err.message });
        } finally {
            e.btnSavePin.disabled = false;
            e.btnSavePin.textContent = t('e2e.savePin');
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
        if (!isValidPin(pin)) {
            e.pinEnterError.textContent = t('e2e.pinInvalid');
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSubmitPin.disabled = true;
            e.pinEnterError.textContent = "";

            const originalText = e.btnSubmitPin.textContent;
            e.btnSubmitPin.textContent = t('e2e.decrypting');

            // C4: unwrap w policy; brak klucza w chmurze rzuca jak wcześniej
            const decryptedMasterKeyHex = await unlockWithPin(
                { uid: user.uid, pin, salt: saltForUid(user.uid) },
                cloudVault(),
                { setRamKey: setCloudKeyFromHex },
            );

            await getPlatform().keys.setE2EKey(decryptedMasterKeyHex);

            e.pinEnterModal.classList.add('hidden');
            e.btnSubmitPin.textContent = originalText;
            if (_onCloseCallback) {
                _onCloseCallback();
                _onCloseCallback = null;
            }

        } catch (err) {
            console.error(err);
            e.pinEnterError.textContent = t('e2e.invalidPin');
            e.btnSubmitPin.textContent = t('e2e.unlock');
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
            e.pinRecoveryError.textContent = t('e2e.recoveryCodeRequired');
            return;
        }
        if (!isValidPin(newPin)) {
            e.pinRecoveryError.textContent = t('e2e.newPinInvalid');
            return;
        }

        const unformattedCode = unformatRecoveryKey(code);
        if (unformattedCode.length !== 64) {
            e.pinRecoveryError.textContent = t('e2e.recoveryCodeInvalid');
            return;
        }

        const user = auth.currentUser;
        if (!user) return;

        try {
            e.btnSubmitRecovery.disabled = true;
            e.btnSubmitRecovery.textContent = t('e2e.resetting');

            if (!/^[0-9a-f]{64}$/i.test(unformattedCode)) {
                throw new Error(t('e2e.recoveryCodeIllegalChars'));
            }

            // C4: rotacja w policy
            await recoverWithCode(
                { uid: user.uid, cleanCode: unformattedCode, newPin, salt: saltForUid(user.uid) },
                cloudVault(),
                { setRamKey: setCloudKeyFromHex },
            );

            await getPlatform().keys.setE2EKey(unformattedCode);

            e.pinRecoveryModal.classList.add('hidden');

            if (_onCloseCallback) {
                _onCloseCallback();
                _onCloseCallback = null;
            }

        } catch (err) {
            console.error(err);
            e.pinRecoveryError.textContent = t('e2e.recoveryError', { message: err.message });
        } finally {
            e.btnSubmitRecovery.disabled = false;
            e.btnSubmitRecovery.textContent = t('e2e.recoverKey');
        }
    });
}

/**
 * Stan zdalnego klucza (C4: decyzja w session/e2ePolicy.js, tu tylko modale).
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
        // C1: odczyt klucza przez seam (Web zwraca null → spada do modali PIN, jak wcześniej)
        const savedHexKey = await getPlatform().keys.getE2EKey();
        if (savedHexKey) {
            await setCloudKeyFromHex(savedHexKey);
            if (onSuccess) onSuccess();
            return;
        }
    } catch (e) {
        console.warn("Failed to load local E2E key via safeStorage:", e);
    }

    const e = _getEls();

    const remoteState = await describeRemoteKey(user.uid, (uid) => cloudVault().fetchMeta(uid));
    if (remoteState === "error") {
        console.error("Failed to check user_keys");
        import('./dialog.js').then(({ Dialog }) => {
            Dialog.alert(t('e2e.keyDbError'), 'error');
        });
        if (onSuccess) onSuccess();
        return;
    }
    if (remoteState === "present") {
        e.pinEnterInput.value = "";
        e.pinEnterError.textContent = "";
        e.pinEnterModal.classList.remove('hidden');
    } else {
        e.pinSetupInput.value = "";
        e.pinSetupError.textContent = "";
        e.pinSetupModal.classList.remove('hidden');
    }
}
