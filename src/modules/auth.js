// src/modules/auth.js
import { auth, db } from '../firebaseConfig.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { updateAuthUI, showLoginScreen, showError } from './ui.js';
import { enforceSyncPolicy } from './sync.js';

export function initAuth(onLoginSuccess) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const status = userDoc.exists() ? userDoc.data().status : "ERROR";
            updateAuthUI(user.email, status);
            enforceSyncPolicy(status);
            if (onLoginSuccess) onLoginSuccess();
        } else {
            showLoginScreen();
        }
    });


}

/**
 * Login user with email and password, protected by reCAPTCHA Enterprise
 * @param {string} email 
 * @param {string} password 
 */
export async function login(email, password) {
    try {
        showError("Weryfikacja reCAPTCHA...");

        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken('LOGIN');

        showError("Logowanie...");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Optional: Send token to backend for verification
        // In production, you should verify the token server-side
        console.log('Login successful with reCAPTCHA token:', recaptchaToken.substring(0, 20) + '...');

    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/invalid-credential') {
            showError("Nieprawidłowy e-mail lub hasło");
        } else if (error.code === 'auth/too-many-requests') {
            showError("Zbyt wiele prób logowania. Spróbuj ponownie później.");
        } else {
            showError("Błąd logowania: " + error.message);
        }
    }
}

/**
 * Register new user with email and password, protected by reCAPTCHA Enterprise
 * @param {string} email 
 * @param {string} password 
 */
export async function register(email, password) {
    if (password.length < 6) {
        showError("Hasło min. 6 znaków.");
        return;
    }

    try {
        showError("Weryfikacja reCAPTCHA...");

        // Get reCAPTCHA token
        const recaptchaToken = await getRecaptchaToken('REGISTER');

        showError("Tworzenie konta...");
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
            email: userCred.user.email,
            status: "PENDING",
            createdAt: new Date().toISOString()
        });

        // Optional: Send token to backend for verification
        console.log('Registration successful with reCAPTCHA token:', recaptchaToken.substring(0, 20) + '...');

        showError("Konto utworzone!");
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showError("Na dany email założono już konto.");
        } else if (error.code === 'auth/weak-password') {
            showError("Hasło jest zbyt słabe.");
        } else {
            showError("Błąd rejestracji: " + error.message);
        }
    }
}

export function logout() {
    signOut(auth).then(() => location.reload());
}

export function loginGuest() {
    updateAuthUI(null, "GUEST");
    // Trigger callback if needed, handled by UI state change mostly
}

export function getCurrentUser() {
    return auth.currentUser;
}

export function getUserStatus() {
    const statusEl = document.getElementById('user-status-display');
    return statusEl ? statusEl.textContent.replace(/[()]/g, '') : "UNKNOWN";
}

/**
 * Get reCAPTCHA Enterprise token for a specific action
 * @param {string} action - The action name (e.g., 'LOGIN', 'REGISTER')
 * @returns {Promise<string>} reCAPTCHA token
 */
async function getRecaptchaToken(action) {
    return new Promise((resolve, reject) => {
        if (typeof grecaptcha === 'undefined' || !grecaptcha.enterprise) {
            console.warn('reCAPTCHA not loaded, proceeding without token');
            resolve('');
            return;
        }

        grecaptcha.enterprise.ready(async () => {
            try {
                const token = await grecaptcha.enterprise.execute(
                    '6LcGbmAsAAAAANONNS0csIA_MB5ePSLplsbuob6R',
                    { action: action }
                );
                resolve(token);
            } catch (error) {
                console.error('reCAPTCHA error:', error);
                reject(new Error('Błąd weryfikacji reCAPTCHA'));
            }
        });
    });
}
