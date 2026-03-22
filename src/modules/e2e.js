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

// Elements
const pinSetupModal = document.getElementById('pin-setup-modal');
const pinSetupInput = document.getElementById('pin-setup-input');
const btnSavePin = document.getElementById('btn-save-pin');
const pinSetupError = document.getElementById('pin-setup-error');

const pinEnterModal = document.getElementById('pin-enter-modal');
const pinEnterInput = document.getElementById('pin-enter-input');
const btnSubmitPin = document.getElementById('btn-submit-pin');
const btnCancelPin = document.getElementById('btn-cancel-pin');
const linkForgotPin = document.getElementById('link-forgot-pin');
const pinEnterError = document.getElementById('pin-enter-error');

const pinRecoveryModal = document.getElementById('pin-recovery-modal');
const recoveryCodeInput = document.getElementById('recovery-code-input');
const newPinInput = document.getElementById('new-pin-input');
const btnSubmitRecovery = document.getElementById('btn-submit-recovery');
const btnCloseRecoveryModal = document.getElementById('btn-close-recovery-modal');
const pinRecoveryError = document.getElementById('pin-recovery-error');

const recoveryKeyModal = document.getElementById('recovery-key-modal');
const recoveryKeyDisplay = document.getElementById('recovery-key-display');
const btnUnderstoodRecovery = document.getElementById('btn-understood-recovery');

let _onCloseCallback = null;

/**
 * Zwraca sól dla KDF dla obecnego usera 
 */
function getUserSalt() {
    const user = auth.currentUser;
    if (!user) throw new Error("Brak uzytkownika");
    // Pseudo-sól by unikać tęczowych tablic dla takich samych PINów. Używamy UID użytkownika.
    // Musi to być hex! Użyjemy hex z utf-8 UID lub po prostu sha256 z UID (zakładamy, że to jest OK lokalnie).
    // Dla uproszczenia bez zewnętrznych bibliotek:
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

    // Zapytaj Electrona, czy na tym komputerze mamy już zachowany KEK
    try {
        if (window.electronAPI && window.electronAPI.getE2EKey) {
            const savedHexKey = await window.electronAPI.getE2EKey();
            if (savedHexKey) {
                await setCloudKeyFromHex(savedHexKey);
                if (onSuccess) onSuccess();
                return; // Pin podany już kiedyś na tej maszynie!
            }
        }
    } catch (e) {
        console.warn("Failed to load local E2E key via safeStorage:", e);
    }

    try {
        const keyDoc = await getDoc(doc(db, "user_keys", user.uid));
        if (keyDoc.exists() && keyDoc.data().encryptedMasterKey) {
            // User has a key, ask for PIN
            pinEnterInput.value = "";
            pinEnterError.textContent = "";
            pinEnterModal.classList.remove('hidden');
        } else {
            // User does not have a key, generate one and ask for PIN
            pinSetupInput.value = "";
            pinSetupError.textContent = "";
            pinSetupModal.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Failed to check user_keys", e);
        import('./dialog.js').then(({ Dialog }) => {
            Dialog.alert("Błąd połączenia z bazą kluczy E2E. Prawdopodobnie brak wymaganych reguł w Firestore (collections: user_keys). Zgłoś to administratorowi. Szczegóły: " + e.message, 'error');
        });
        if (onSuccess) onSuccess(); // Pozwalamy wejść do aplikacji, ale chmura nie zadziała poprawnie
    }
}

// ========================
// 1. PIN SETUP LOGIC
// ========================
btnSavePin.addEventListener('click', async () => {
    const pin = pinSetupInput.value;
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        pinSetupError.textContent = "PIN musi składać się z 6 cyfr.";
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
        btnSavePin.disabled = true;
        btnSavePin.textContent = "Szyfrowanie...";

        // Obliczmy sól
        const saltHex = getUserSalt();

        // 1. Generuj nowy silny klucz Master (256 bit)
        const newMasterKey = generateRandomHexKey();

        // 2. Owiń ten klucz używając PINu usera (KDF w środku)
        const wrapped = await wrapCloudKey(newMasterKey, pin, saltHex);

        // 3. Zapisz do Firebase
        await setDoc(doc(db, "user_keys", user.uid), {
            encryptedMasterKey: wrapped.encryptedKey,
            iv: wrapped.iv,
            updatedAt: new Date().toISOString()
        });

        // 4. Ustaw klucz w pamięci podręcznej RAM (od razu zalogowany)
        await setCloudKeyFromHex(newMasterKey);

        // Zapisz na tym komputerze w bezpiecznym magazynie elektronowym (SafeStorage)
        if (window.electronAPI && window.electronAPI.setE2EKey) {
            await window.electronAPI.setE2EKey(newMasterKey);
        }

        pinSetupModal.classList.add('hidden');

        // 5. Wygeneruj kod odzyskiwania i pokaż go userowi (to jest surowy klucz w HEX)
        const formattedCode = formatRecoveryKey(newMasterKey);
        recoveryKeyDisplay.textContent = formattedCode;
        recoveryKeyModal.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        pinSetupError.textContent = "Błąd szyfrowania: " + e.message;
    } finally {
        btnSavePin.disabled = false;
        btnSavePin.textContent = "Zapisz PIN i Utwórz Klucz";
    }
});

btnUnderstoodRecovery.addEventListener('click', () => {
    recoveryKeyModal.classList.add('hidden');
    if (_onCloseCallback) {
        _onCloseCallback();
        _onCloseCallback = null;
    }
});


// ========================
// 2. PIN ENTER LOGIC
// ========================
btnSubmitPin.addEventListener('click', async () => {
    const pin = pinEnterInput.value;
    if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        pinEnterError.textContent = "PIN musi składać się z 6 cyfr.";
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
        btnSubmitPin.disabled = true;
        pinEnterError.textContent = "";

        // Pokaż loader/komunikat
        const originalText = btnSubmitPin.textContent;
        btnSubmitPin.textContent = "Odszyfrowywanie...";

        // Fetch user data
        const keyDoc = await getDoc(doc(db, "user_keys", user.uid));
        if (!keyDoc.exists()) throw new Error("Brak klucza w chmurze!");

        const data = keyDoc.data();
        const saltHex = getUserSalt();

        // Spróbuj odkodować Klucz Główny z chmury przy użyciu PINu
        const decryptedMasterKeyHex = await unwrapCloudKey(data.encryptedMasterKey, data.iv, pin, saltHex);

        // Ustaw klucz do pamięci
        await setCloudKeyFromHex(decryptedMasterKeyHex);

        // Zapisz na tym komputerze w bezpiecznym magazynie elektronowym (SafeStorage)
        if (window.electronAPI && window.electronAPI.setE2EKey) {
            await window.electronAPI.setE2EKey(decryptedMasterKeyHex);
        }

        // Sukces
        pinEnterModal.classList.add('hidden');
        btnSubmitPin.textContent = originalText;
        if (_onCloseCallback) {
            _onCloseCallback();
            _onCloseCallback = null;
        }

    } catch (e) {
        console.error(e);
        pinEnterError.textContent = "Nieprawidłowy PIN.";
        btnSubmitPin.textContent = "Odblokuj";
    } finally {
        btnSubmitPin.disabled = false;
    }
});

btnCancelPin.addEventListener('click', () => {
    // Teoretycznie auth nie pozwoli im przejść dalej, ale w sumie anulowanie oznacza pracę bez E2E?
    // Nie zezwalamy na chmurę bez E2E.
    // pinEnterModal.classList.add('hidden');
});


// ========================
// 3. RECOVERY LOGIC
// ========================
linkForgotPin.addEventListener('click', (e) => {
    e.preventDefault();
    pinEnterModal.classList.add('hidden');
    recoveryCodeInput.value = "";
    newPinInput.value = "";
    pinRecoveryError.textContent = "";
    pinRecoveryModal.classList.remove('hidden');
});

btnCloseRecoveryModal.addEventListener('click', () => {
    pinRecoveryModal.classList.add('hidden');
    pinEnterModal.classList.remove('hidden');
});

btnSubmitRecovery.addEventListener('click', async () => {
    const code = recoveryCodeInput.value.trim();
    const newPin = newPinInput.value;

    if (!code) {
        pinRecoveryError.textContent = "Podaj kod odzyskiwania.";
        return;
    }
    if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
        pinRecoveryError.textContent = "Nowy PIN musi mieć 6 cyfr.";
        return;
    }

    const unformattedCode = unformatRecoveryKey(code);
    if (unformattedCode.length !== 64) {
        pinRecoveryError.textContent = "Nieprawidłowy format kodu odzyskiwania.";
        return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
        btnSubmitRecovery.disabled = true;
        btnSubmitRecovery.textContent = "Resetowanie...";

        // Kod odzyskiwania to w sumie nasz nieszyfrowany Master Key! Sprawdźmy czy jest to hex
        if (!/^[0-9a-f]{64}$/i.test(unformattedCode)) {
            throw new Error("Kod zawiera niedozwolone znaki.");
        }

        const saltHex = getUserSalt();

        // Skoro kod z recovery jest prawidłowy (ufamy temu bo to po prostu 64-chars HEX klucza),
        // pakujemy go nowym PINEM.
        const wrapped = await wrapCloudKey(unformattedCode, newPin, saltHex);

        await setDoc(doc(db, "user_keys", user.uid), {
            encryptedMasterKey: wrapped.encryptedKey,
            iv: wrapped.iv,
            updatedAt: new Date().toISOString()
        });

        // Sukces
        await setCloudKeyFromHex(unformattedCode);

        // Zapisz na tym komputerze w bezpiecznym magazynie elektronowym (SafeStorage)
        if (window.electronAPI && window.electronAPI.setE2EKey) {
            await window.electronAPI.setE2EKey(unformattedCode);
        }

        pinRecoveryModal.classList.add('hidden');
        
        if (_onCloseCallback) {
            _onCloseCallback();
            _onCloseCallback = null;
        }

    } catch (e) {
        console.error(e);
        pinRecoveryError.textContent = "Błąd: " + e.message;
    } finally {
        btnSubmitRecovery.disabled = false;
        btnSubmitRecovery.textContent = "Odzyskaj Klucz";
    }
});
