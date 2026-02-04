// src/modules/auth.js
import { auth, db } from '../firebaseConfig.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { updateAuthUI, showLoginScreen, showError } from './ui.js';

export function initAuth(onLoginSuccess) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const status = userDoc.exists() ? userDoc.data().status : "ERROR";
            updateAuthUI(user.email, status);
            if (onLoginSuccess) onLoginSuccess();
        } else {
            showLoginScreen();
        }
    });


}

export async function login(email, password) {
    try {
        showError("Logowanie...");
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        showError("Nieprawidłowy e-mail lub hasło");
    }
}

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
        if (error.code === 'auth/email-already-in-use') {
            showError("Na dany email założono już konto.");
        } else {
            showError("Nieprawidłowy e-mail lub hasło");
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
