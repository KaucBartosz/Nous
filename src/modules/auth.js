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

// Prywatna zmienna statusu — bezpieczna alternatywa dla odczytywania z DOM
let _currentUserStatus = "UNKNOWN";

export function initAuth(onLoginSuccess) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const status = userDoc.exists() ? userDoc.data().status : "ERROR";
            _currentUserStatus = status;
            updateAuthUI(user.email, status);
            enforceSyncPolicy(status);
            if (onLoginSuccess) onLoginSuccess();
        } else {
            _currentUserStatus = "UNKNOWN";
            showLoginScreen();
        }
    });
}

/**
 * Login user with email and password
 * @param {string} email 
 * @param {string} password 
 */
export async function login(email, password) {
    try {
        showError("Logowanie...");
        await signInWithEmailAndPassword(auth, email, password);
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
 * Register new user with email and password
 * @param {string} email 
 * @param {string} password 
 */
export async function register(email, password) {
    if (password.length < 6) {
        showError("Hasło min. 6 znaków.");
        return;
    }

    try {
        showError("Tworzenie konta...");
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), {
            email: userCred.user.email,
            status: "PENDING",
            createdAt: new Date().toISOString()
        });
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
    _currentUserStatus = "GUEST";
    updateAuthUI(null, "GUEST");
}

export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Zwraca aktualny status użytkownika z bezpiecznej zmiennej modułu.
 * Nie czyta z DOM, więc nie jest podatna na manipulację przez konsolę.
 * @returns {string} Status użytkownika ('APPROVED', 'PENDING', 'GUEST', 'UNKNOWN', etc.)
 */
export function getUserStatus() {
    return _currentUserStatus;
}
