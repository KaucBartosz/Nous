// src/modules/auth.js
import { auth, db } from "../firebaseConfig.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import {
  updateAuthUI,
  showLoginScreen,
  showError,
  showErrorLocal,
} from "./ui.js";
import { enforceSyncPolicy } from "./sync.js";
import { verifyE2E } from "./e2e.js";
import {
  getLocalAccount,
  createLocalAccount,
  updateLocalAccountLastLogin,
} from "./database.js";

// ─── Prywatny stan modułu ────────────────────────────────────────────────────

/** Aktualny status użytkownika. Nigdy nie odczytywany z DOM. */
let _currentUserStatus = "UNKNOWN";

/** Login aktualnie zalogowanego lokalnego użytkownika (null jeśli brak). */
let _currentLocalUsername = null;

/** Rate limiting — timestamp ostatniej próby logowania (online + local). */
let _lastAttemptTime = 0;
const RATE_LIMIT_MS = 1000;

// ─── Rate Limiter ────────────────────────────────────────────────────────────

/**
 * Sprawdza rate limit i aktualizuje timestamp.
 * @param {'online'|'local'} channel - Który panel wyświetla błąd
 * @returns {boolean} true = można kontynuować, false = zablokowane
 */
function checkRateLimit(channel) {
  const now = Date.now();
  if (now - _lastAttemptTime < RATE_LIMIT_MS) {
    const msg = "Zbyt szybko. Poczekaj chwilę.";
    if (channel === "local") {
      showErrorLocal(msg);
    } else {
      showError(msg);
    }
    return false;
  }
  _lastAttemptTime = now;
  return true;
}

// ─── Hashowanie haseł ────────────────────────────────────────────────────────

/**
 * Generuje kryptograficznie bezpieczny salt (16 bajtów hex).
 */
function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashuje hasło z saltem (SHA-256).
 * @param {string} salt
 * @param {string} password
 * @returns {Promise<string>} hex string
 */
async function hashPassword(salt, password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Firebase Auth ───────────────────────────────────────────────────────────

export function initAuth(onLoginSuccess) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const status = userDoc.exists() ? userDoc.data().status : "ERROR";
      _currentUserStatus = status;
      _currentLocalUsername = null;

      const executeAppStart = () => {
        updateAuthUI(user.email, status);
        enforceSyncPolicy(status);
        if (onLoginSuccess) onLoginSuccess();
      };

      if (status === "APPROVED" || status === "ADMIN") {
        verifyE2E(user, executeAppStart);
      } else {
        executeAppStart();
      }
    } else {
      // Sprawdź czy jest aktywna sesja lokalna
      if (_currentUserStatus === "LOCAL") {
        // Lokalny użytkownik zalogowany — nie pokazuj ekranu logowania
        return;
      }
      _currentUserStatus = "UNKNOWN";
      showLoginScreen();
    }
  });
}

/**
 * Logowanie przez Firebase (konto online).
 */
export async function login(email, password) {
  if (!checkRateLimit("online")) return;
  try {
    showError("Logowanie...");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === "auth/invalid-credential") {
      showError("Nieprawidłowy e-mail lub hasło");
    } else if (error.code === "auth/too-many-requests") {
      showError("Zbyt wiele prób logowania. Spróbuj ponownie później.");
    } else {
      showError("Błąd logowania: " + error.message);
    }
  }
}

/**
 * Rejestracja przez Firebase (konto online).
 */
export async function register(email, password) {
  if (!checkRateLimit("online")) return;
  if (password.length < 6) {
    showError("Hasło min. 6 znaków.");
    return;
  }

  try {
    showError("Tworzenie konta...");
    const userCred = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await setDoc(doc(db, "users", userCred.user.uid), {
      email: userCred.user.email,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    showError("Konto utworzone!");
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "auth/email-already-in-use") {
      showError("Na dany email założono już konto.");
    } else if (error.code === "auth/weak-password") {
      showError("Hasło jest zbyt słabe.");
    } else {
      showError("Błąd rejestracji: " + error.message);
    }
  }
}

/**
 * Wylogowanie z konta Firebase.
 */
export async function logout() {
  if (window.electronAPI && window.electronAPI.clearE2EKey) {
    await window.electronAPI.clearE2EKey();
  }
  await signOut(auth);
  location.reload();
}

// ─── Konta Lokalne ───────────────────────────────────────────────────────────

/**
 * Logowanie do konta lokalnego.
 * @param {string} username
 * @param {string} password
 * @param {Function} onLoginSuccess
 */
export async function loginLocal(username, password, onLoginSuccess) {
  if (!checkRateLimit("local")) return;

  if (!username || !username.trim()) {
    showErrorLocal("Podaj login.");
    return;
  }
  if (!password) {
    showErrorLocal("Podaj hasło.");
    return;
  }

  try {
    showErrorLocal("Logowanie...");
    const account = await getLocalAccount(username);

    if (!account) {
      showErrorLocal("Nie znaleziono konta o tej nazwie.");
      return;
    }

    const hash = await hashPassword(account.salt, password);
    if (hash !== account.passwordHash) {
      showErrorLocal("Nieprawidłowe hasło.");
      return;
    }

    // Sukces
    _currentLocalUsername = username;
    _currentUserStatus = "LOCAL";
    await updateLocalAccountLastLogin(username);

    updateAuthUI(username, "LOCAL");
    enforceSyncPolicy("LOCAL");
    if (onLoginSuccess) onLoginSuccess();
  } catch (error) {
    console.error("Local login error:", error);
    showErrorLocal("Błąd logowania: " + error.message);
  }
}

/**
 * Rejestracja konta lokalnego.
 * Po pomyślnej rejestracji automatycznie loguje na nowo utworzone konto.
 * @param {string} username
 * @param {string} password
 * @param {Function} onLoginSuccess
 */
export async function registerLocal(username, password, onLoginSuccess) {
  if (!checkRateLimit("local")) return;

  // Walidacja loginu
  if (!username || username.trim().length < 3) {
    showErrorLocal("Login musi mieć min. 3 znaki.");
    return;
  }
  if (username.trim().length > 30) {
    showErrorLocal("Login max. 30 znaków.");
    return;
  }

  // Walidacja hasła
  if (!password || password.length < 4) {
    showErrorLocal("Hasło musi mieć min. 4 znaki.");
    return;
  }
  if (password.length > 30) {
    showErrorLocal("Hasło max. 30 znaków.");
    return;
  }

  const trimmedUsername = username.trim();

  try {
    showErrorLocal("Tworzenie konta...");
    const existing = await getLocalAccount(trimmedUsername);
    if (existing) {
      showErrorLocal("Konto o tej nazwie już istnieje.");
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(salt, password);
    await createLocalAccount(trimmedUsername, passwordHash, salt);

    // Auto-login na nowo utworzone konto
    showErrorLocal("Konto utworzone. Logowanie...");
    _currentLocalUsername = trimmedUsername;
    _currentUserStatus = "LOCAL";
    await updateLocalAccountLastLogin(trimmedUsername);

    updateAuthUI(trimmedUsername, "LOCAL");
    enforceSyncPolicy("LOCAL");
    if (onLoginSuccess) onLoginSuccess();
  } catch (error) {
    console.error("Local register error:", error);
    showErrorLocal("Błąd rejestracji: " + error.message);
  }
}

/**
 * Wylogowanie z konta lokalnego (powrót do ekranu wyboru).
 */
export function logoutLocal() {
  _currentLocalUsername = null;
  _currentUserStatus = "UNKNOWN";
  showLoginScreen();
}

/**
 * Zmiana hasła dla aktualnie zalogowanego konta lokalnego.
 * Wymaga podania starego hasła do weryfikacji.
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function changeLocalPassword(oldPassword, newPassword) {
  if (!_currentLocalUsername || _currentUserStatus !== "LOCAL") {
    return { ok: false, error: "Brak aktywnego konta lokalnego." };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: "Nowe hasło musi mieć min. 4 znaki." };
  }
  if (newPassword.length > 30) {
    return { ok: false, error: "Nowe hasło max. 30 znaków." };
  }
  try {
    const account = await getLocalAccount(_currentLocalUsername);
    if (!account) return { ok: false, error: "Konto nie istnieje." };

    const oldHash = await hashPassword(account.salt, oldPassword);
    if (oldHash !== account.passwordHash) {
      return { ok: false, error: "Stare hasło jest nieprawidłowe." };
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newSalt, newPassword);
    await createLocalAccount(_currentLocalUsername, newHash, newSalt);
    return { ok: true };
  } catch (e) {
    console.error("changeLocalPassword error:", e);
    return { ok: false, error: e.message };
  }
}

/**
 * Reset hasła konta lokalnego przez ADMINA (bez znajomości starego hasła).
 * Może być wywołane tylko gdy zalogowany użytkownik ma status ADMIN.
 * @param {string} targetUsername - Login konta lokalnego do zresetowania
 * @param {string} newPassword
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function adminResetLocalPassword(targetUsername, newPassword) {
  if (_currentUserStatus !== "ADMIN") {
    return { ok: false, error: "Brak uprawnień. Wymagany status ADMIN." };
  }
  if (!targetUsername || !targetUsername.trim()) {
    return { ok: false, error: "Podaj nazwę konta." };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: "Nowe hasło musi mieć min. 4 znaki." };
  }
  if (newPassword.length > 30) {
    return { ok: false, error: "Nowe hasło max. 30 znaków." };
  }
  try {
    const account = await getLocalAccount(targetUsername.trim());
    if (!account) {
      return { ok: false, error: `Konto "${targetUsername}" nie istnieje.` };
    }
    const newSalt = generateSalt();
    const newHash = await hashPassword(newSalt, newPassword);
    await createLocalAccount(targetUsername.trim(), newHash, newSalt);
    return { ok: true };
  } catch (e) {
    console.error("adminResetLocalPassword error:", e);
    return { ok: false, error: e.message };
  }
}

// ─── Gość ────────────────────────────────────────────────────────────────────

/**
 * Logowanie jako gość (brak konta, brak hasła).
 */
export function loginGuest() {
  _currentLocalUsername = null;
  _currentUserStatus = "GUEST";
  updateAuthUI(null, "GUEST");
}

// ─── Gettery ─────────────────────────────────────────────────────────────────

/**
 * Zwraca aktualnie zalogowanego użytkownika Firebase (lub null).
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Zwraca login aktualnie zalogowanego lokalnego użytkownika (lub null).
 */
export function getCurrentLocalUser() {
  return _currentLocalUsername;
}

/**
 * Zwraca researcher_uid odpowiedni dla aktualnego kontekstu:
 * - Firebase: user.uid
 * - Lokalny: 'LOCAL::' + username
 * - Gość: 'GUEST'
 */
export function getResearcherUid() {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) return firebaseUser.uid;
  if (_currentUserStatus === "LOCAL" && _currentLocalUsername) {
    return `LOCAL::${_currentLocalUsername}`;
  }
  return "GUEST";
}

/**
 * Zwraca aktualny status użytkownika z bezpiecznej zmiennej modułu.
 * @returns {string} 'APPROVED' | 'PENDING' | 'ADMIN' | 'GUEST' | 'LOCAL' | 'UNKNOWN' | 'ERROR'
 */
export function getUserStatus() {
  return _currentUserStatus;
}
