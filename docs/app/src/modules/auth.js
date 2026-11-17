// src/modules/auth.js
// C1: chmura przez seam — ten moduł nie zna Firebase ani gstatic.
import {
  onAuthStateChanged,
  signIn,
  signUp,
  signOutRemote,
  fetchUserDoc,
  saveUserDoc,
  currentUid,
  currentUser,
} from "../cloud/firebase.js";
import {
  updateAuthUI,
  showLoginScreen,
  showLoginOnlinePanel,
  showError,
  showErrorLocal,
} from "./ui.js";
import { enforceSyncPolicy } from "./sync.js";
import { verifyE2E } from "./e2e.js";
import {
  getLocalAccount,
  createLocalAccount,
  updateLocalAccountLastLogin,
  updateLocalAccountHash,
} from "./database.js";
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  needsRehash,
  HASH_VERSION,
} from "../session/passwordHash.js";
import { createSession, canUploadResult, isCloudSyncAllowed } from "../session/session.js";
import { getPlatform } from "../platform/index.js";
import { t } from "../i18n/index.js";

// ─── Prywatny stan modułu ────────────────────────────────────────────────────

/** Aktualny status użytkownika. Nigdy nie odczytywany z DOM. */
let _currentUserStatus = "UNKNOWN";

/** Login aktualnie zalogowanego lokalnego użytkownika (null jeśli brak). */
let _currentLocalUsername = null;

/** Rate limiting — osobne znaczniki dla online i lokalnego (nie blokują się). */
let _lastOnlineAttemptTime = 0;
let _lastLocalAttemptTime = 0;
const RATE_LIMIT_MS = 1000;

// Statusy, z którymi możemy uruchomić aplikację. Wszystkie inne (ERROR,
// UNKNOWN, brak dokumentu, nieznana wartość z bazy) kończą logowanie błędem —
// zamiast pokazywać dashboard z badge'em "Błąd".
const VALID_ONLINE_STATUSES = ["APPROVED", "PENDING", "ADMIN"];

// Krótki retry łagodzi wyścig z rejestracji: createUserWithEmailAndPassword
// loguje użytkownika zanim saveUserDoc zdąży zapisać dokument PENDING.
const USERDOC_ATTEMPTS = 3;
const USERDOC_RETRY_MS = 200;

// ─── Bramka rejestracji ──────────────────────────────────────────────────────
// signUp() loguje użytkownika, zanim saveUserDoc() zapisze status PENDING.
// Observer auth nie może czytać dokumentu w tej szczelinie czasowej.
let _registrationGate = null;

function beginRegistrationGate() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  _registrationGate = { promise, resolve };
}

function endRegistrationGate() {
  const gate = _registrationGate;
  _registrationGate = null;
  gate?.resolve();
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

/**
 * Sprawdza rate limit i aktualizuje timestamp dla danego kanału.
 * @param {'online'|'local'} channel - Który panel wyświetla błąd
 * @returns {boolean} true = można kontynuować, false = zablokowane
 */
function checkRateLimit(channel) {
  const now = Date.now();
  const isLocal = channel === "local";
  const last = isLocal ? _lastLocalAttemptTime : _lastOnlineAttemptTime;
  if (now - last < RATE_LIMIT_MS) {
    const msg = t("login.tooFast");
    if (isLocal) showErrorLocal(msg);
    else showError(msg);
    return false;
  }
  if (isLocal) _lastLocalAttemptTime = now;
  else _lastOnlineAttemptTime = now;
  return true;
}

// ─── Firebase Auth ───────────────────────────────────────────────────────────

/** Pobiera dokument użytkownika z krótkim retry (bez głośnego logowania). */
async function fetchUserDocWithRetry(uid) {
  let lastError = null;
  for (let attempt = 0; attempt < USERDOC_ATTEMPTS; attempt += 1) {
    try {
      const doc = await fetchUserDoc(uid);
      if (doc) return doc;
    } catch (error) {
      lastError = error;
    }
    if (attempt < USERDOC_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, USERDOC_RETRY_MS));
    }
  }
  if (lastError) throw lastError;
  return null;
}

/** Wróć do panelu online z czytelnym komunikatem i wyczyść status sesji. */
function abortOnlineLogin(message) {
  _currentUserStatus = "ERROR";
  _currentLocalUsername = null;
  showLoginScreen();
  showLoginOnlinePanel();
  showError(message);
}

export function initAuth(onLoginSuccess) {
  onAuthStateChanged(async (user) => {
    if (user) {
      // Rejestracja w toku — odczekaj na zapis dokumentu użytkownika.
      if (_registrationGate) await _registrationGate.promise;

      let userData;
      try {
        userData = await fetchUserDocWithRetry(user.uid);
      } catch (error) {
        console.error("[auth] Nie udało się pobrać konta online:", error);
        abortOnlineLogin(t("sync.accountFetchError", { message: error.message }));
        return;
      }

      const status = userData?.status;
      if (!userData || !VALID_ONLINE_STATUSES.includes(status)) {
        console.error("[auth] Brak lub nieprawidłowy dokument konta online:", user.uid, status);
        abortOnlineLogin(t("login.accountMissing"));
        return;
      }

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
        // PENDING nie ma klucza E2E — dostaje dashboard z banerem oczekiwania.
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
    showError(t("login.loggingIn"), { shake: false });
    await signIn(email, password);
  } catch (error) {
    console.error("Login error:", error);
    if (error.code === "auth/invalid-credential") {
      showError(t("login.invalidCredentials"));
    } else if (error.code === "auth/too-many-requests") {
      showError(t("login.tooManyRequests"));
    } else {
      showError(t("login.loginError", { message: error.message }));
    }
  }
}

/**
 * Rejestracja przez Firebase (konto online).
 */
export async function register(email, password) {
  if (!checkRateLimit("online")) return;
  if (password.length < 6) {
    showError(t("login.passwordMinLength"));
    return;
  }

  beginRegistrationGate();
  try {
    showError(t("login.creatingAccount"), { shake: false });
    const userCred = await signUp(email, password);
    await saveUserDoc(
      userCred.user.uid,
      {
        email: userCred.user.email,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
    showError(t("login.accountCreatedPending"), { shake: false });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.code === "auth/email-already-in-use") {
      showError(t("login.emailAlreadyInUse"));
    } else if (error.code === "auth/weak-password") {
      showError(t("login.weakPassword"));
    } else {
      showError(t("login.registrationError", { message: error.message }));
    }
  } finally {
    // Nawet przy błędzie observer nie może zostać zablokowany bramką.
    endRegistrationGate();
  }
}

/**
 * Wylogowanie z konta Firebase.
 */
export async function logout() {
  // C1: czyszczenie klucza przez seam (Web/Fake: noop)
  await getPlatform().keys.clearE2EKey();
  await signOutRemote();
  location.reload();
}

/**
 * Anulowanie modalu E2E: czyści status PRZED wylogowaniem, żeby późniejsze
 * onAuthStateChanged(null) nie widziało już APPROVED i nie próbowało
 * uruchamiać aplikacji z nieaktualnym stanem.
 */
export async function cancelOnlineLogin() {
  _currentUserStatus = "UNKNOWN";
  _currentLocalUsername = null;
  await signOutRemote();
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
    showErrorLocal(t("login.enterLogin"));
    return;
  }
  if (!password) {
    showErrorLocal(t("login.enterPassword"));
    return;
  }

  try {
    showErrorLocal(t("login.loggingIn"), { shake: false });
    const account = await getLocalAccount(username);

    if (!account) {
      showErrorLocal(t("login.accountNotFound"));
      return;
    }

    // Konta sprzed planu 013 nie mają pola hashVersion — to v1 (SHA-256).
    const version = account.hashVersion ?? 1;
    const valid = await verifyPassword(
      account.salt,
      password,
      account.passwordHash,
      version,
    );
    if (!valid) {
      showErrorLocal(t("login.invalidPassword"));
      return;
    }

    // Migracja hasha przy logowaniu: błąd nie może zablokować logowania.
    if (needsRehash(version)) {
      try {
        const newSalt = generateSalt();
        const newHash = await hashPassword(newSalt, password);
        await updateLocalAccountHash(username, newHash, newSalt, HASH_VERSION);
        console.info("[auth] local password hash migrated to v2");
      } catch (error) {
        // Bez hasła i bez hasha w logu — tylko fakt nieudanej migracji.
        console.warn("[auth] local password rehash failed:", error);
      }
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
    showErrorLocal(t("login.loginError", { message: error.message }));
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
    showErrorLocal(t("login.loginMinLength"));
    return;
  }
  if (username.trim().length > 30) {
    showErrorLocal(t("login.loginMaxLength"));
    return;
  }

  // Walidacja hasła
  if (!password || password.length < 4) {
    showErrorLocal(t("login.localPasswordMinLength"));
    return;
  }
  if (password.length > 30) {
    showErrorLocal(t("login.localPasswordMaxLength"));
    return;
  }

  const trimmedUsername = username.trim();

  try {
    showErrorLocal(t("login.creatingAccount"), { shake: false });
    const existing = await getLocalAccount(trimmedUsername);
    if (existing) {
      showErrorLocal(t("login.accountExists"));
      return;
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(salt, password);
    await createLocalAccount(trimmedUsername, passwordHash, salt, HASH_VERSION);

    // Auto-login na nowo utworzone konto
    showErrorLocal(t("login.accountCreatedLoggingIn"), { shake: false });
    _currentLocalUsername = trimmedUsername;
    _currentUserStatus = "LOCAL";
    await updateLocalAccountLastLogin(trimmedUsername);

    updateAuthUI(trimmedUsername, "LOCAL");
    enforceSyncPolicy("LOCAL");
    if (onLoginSuccess) onLoginSuccess();
  } catch (error) {
    console.error("Local register error:", error);
    showErrorLocal(t("login.registrationError", { message: error.message }));
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
    return { ok: false, error: t("login.noLocalAccount") };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: t("login.newPasswordMinLength") };
  }
  if (newPassword.length > 30) {
    return { ok: false, error: t("login.newPasswordMaxLength") };
  }
  try {
    const account = await getLocalAccount(_currentLocalUsername);
    if (!account) return { ok: false, error: t("login.accountNotExist") };

    const version = account.hashVersion ?? 1;
    const oldValid = await verifyPassword(
      account.salt,
      oldPassword,
      account.passwordHash,
      version,
    );
    if (!oldValid) {
      return { ok: false, error: t("login.oldPasswordIncorrect") };
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newSalt, newPassword);
    await createLocalAccount(_currentLocalUsername, newHash, newSalt, HASH_VERSION);
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
    return { ok: false, error: t("login.adminNoPermission") };
  }
  if (!targetUsername || !targetUsername.trim()) {
    return { ok: false, error: t("login.enterAccountName") };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: t("login.newPasswordMinLength") };
  }
  if (newPassword.length > 30) {
    return { ok: false, error: t("login.newPasswordMaxLength") };
  }
  try {
    const account = await getLocalAccount(targetUsername.trim());
    if (!account) {
      return {
        ok: false,
        error: t("login.accountNotExistNamed", { name: targetUsername }),
      };
    }
    const newSalt = generateSalt();
    const newHash = await hashPassword(newSalt, newPassword);
    await createLocalAccount(targetUsername.trim(), newHash, newSalt, HASH_VERSION);
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
  return currentUser();
}

/**
 * Zwraca login aktualnie zalogowanego lokalnego użytkownika (lub null).
 */
export function getCurrentLocalUser() {
  return _currentLocalUsername;
}

/**
 * Zwraca researcher_uid odpowiedni dla aktualnego kontekstu (shim C4 —
 * reguła w session/session.js, wołający bez zmian):
 * - Firebase: user.uid
 * - Lokalny: 'LOCAL::' + username
 * - Gość: 'GUEST'
 */
export function getResearcherUid() {
  return createSession({
    firebaseUid: currentUid(),
    kind: _currentUserStatus,
    localUsername: _currentLocalUsername,
  }).researcherUid;
}

/**
 * Zwraca aktualny status użytkownika z bezpiecznej zmiennej modułu.
 * @returns {string} 'APPROVED' | 'PENDING' | 'ADMIN' | 'GUEST' | 'LOCAL' | 'UNKNOWN' | 'ERROR'
 */
export function getUserStatus() {
  return _currentUserStatus;
}

/**
 * Jednolity widok sesji (A3: thin slice — 1 obiekt zamiast tria getterów).
 * Stare gettery zostają (mockowane w testach); nowy kod woli getSession().
 * @returns {{uid, kind, localUsername, researcherUid, canUpload, isCloudSyncAllowed}}
 */
export function getSession() {
  const session = createSession({
    firebaseUid: currentUid(),
    kind: _currentUserStatus,
    localUsername: _currentLocalUsername,
  });
  return {
    ...session,
    canUpload: canUploadResult(_currentUserStatus),
    isCloudSyncAllowed: isCloudSyncAllowed(_currentUserStatus),
  };
}
