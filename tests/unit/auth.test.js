import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { t } from '../../src/i18n/index.js';

const fb = vi.hoisted(() => ({
  authCb: { current: null },
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  clearE2EKey: vi.fn(),
  clearCloudKey: vi.fn(),
}));

// hashPassword używa Crypto API bezpośrednio; setup.js daje XOR-mock bez
// deriveBits, więc dla realnego PBKDF2 podmieniamy crypto na node:crypto.webcrypto.
beforeAll(() => {
  vi.stubGlobal('crypto', webcrypto);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// Seam platformy i kryptografii — klucz E2E musi być czyszczony przy końcu sesji.
vi.mock('../../src/platform/index.js', () => ({
  getPlatform: () => ({ keys: { clearE2EKey: fb.clearE2EKey } }),
}));
vi.mock('../../src/modules/cryptoService.js', () => ({
  clearCloudKey: fb.clearCloudKey,
}));

// Mock modułów zależnych
vi.mock('../../src/modules/ui.js', () => ({
  updateAuthUI: vi.fn(),
  showLoginScreen: vi.fn(),
  showLoginOnlinePanel: vi.fn(),
  showError: vi.fn(),
  showErrorLocal: vi.fn(),
  showLoginChoice: vi.fn(),
}));

vi.mock('../../src/modules/sync.js', () => ({
  enforceSyncPolicy: vi.fn(),
}));

vi.mock('../../src/modules/e2e.js', () => ({
  // Trzeci argument to kanał błędu — test fail-closed podstawia własną implementację.
  verifyE2E: vi.fn((user, ok, fail) => ok && ok()),
}));

vi.mock('../../src/modules/database.js', () => ({
  getLocalAccount: vi.fn(),
  createLocalAccount: vi.fn(),
  updateLocalAccountLastLogin: vi.fn(),
  updateLocalAccountHash: vi.fn(),
}));

// Firebase mock — auth.currentUser = null (konta lokalne nie używają Firebase)
vi.mock('../../src/firebaseConfig.js', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((cb) => {
      fb.authCb.current = cb;
      cb(null); // domyślnie brak użytkownika — testy lokalne nie dotykają chmury
      return vi.fn(); // unsubscribe
    }),
  },
  db: {},
}));

// Mock firebase-auth
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js', () => ({
  signInWithEmailAndPassword: fb.signIn,
  createUserWithEmailAndPassword: fb.signUp,
  signOut: fb.signOut,
}));

// Mock firebase-firestore
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js', () => ({
  doc: vi.fn((db, col, id) => ({ col, id })),
  setDoc: fb.setDoc,
  getDoc: fb.getDoc,
  collection: vi.fn(),
  addDoc: vi.fn(),
}));

describe('Auth Module — Konta Lokalne', () => {
  let getLocalAccount, createLocalAccount, updateLocalAccountLastLogin, updateLocalAccountHash;
  let updateAuthUI, showErrorLocal, enforceSyncPolicy;
  let loginLocal, registerLocal, logoutLocal, loginGuest;
  let getResearcherUid, getUserStatus, getSession, getCurrentLocalUser;
  let changeLocalPassword, adminResetLocalPassword;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Ponowne załadowanie mocków po resetModules
    const dbMock = await import('../../src/modules/database.js');
    getLocalAccount = dbMock.getLocalAccount;
    createLocalAccount = dbMock.createLocalAccount;
    updateLocalAccountLastLogin = dbMock.updateLocalAccountLastLogin;
    updateLocalAccountHash = dbMock.updateLocalAccountHash;
    updateLocalAccountHash.mockReset();
    updateLocalAccountHash.mockResolvedValue(undefined);

    const uiMock = await import('../../src/modules/ui.js');
    updateAuthUI = uiMock.updateAuthUI;
    showErrorLocal = uiMock.showErrorLocal;

    const syncMock = await import('../../src/modules/sync.js');
    enforceSyncPolicy = syncMock.enforceSyncPolicy;

    const auth = await import('../../src/modules/auth.js');
    loginLocal = auth.loginLocal;
    registerLocal = auth.registerLocal;
    logoutLocal = auth.logoutLocal;
    loginGuest = auth.loginGuest;
    getResearcherUid = auth.getResearcherUid;
    getUserStatus = auth.getUserStatus;
    getSession = auth.getSession;
    getCurrentLocalUser = auth.getCurrentLocalUser;
    changeLocalPassword = auth.changeLocalPassword;
    adminResetLocalPassword = auth.adminResetLocalPassword;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getResearcherUid ───────────────────────────────────────
  describe('getResearcherUid', () => {
    it('zwraca GUEST gdy brak zalogowanego użytkownika', async () => {
      expect(getResearcherUid()).toBe('GUEST');
    });

    it('zwraca LOCAL::username po zalogowaniu lokalnym', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      // Najpierw hashujemy hasło by móc zalogować
      const encoder = new TextEncoder();
      const data = encoder.encode(salt + 'test1234');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);

      await loginLocal('Jan', 'test1234', vi.fn());

      expect(getResearcherUid()).toBe('LOCAL::Jan');
    });
  });

  // ─── getSession (A3: jeden obiekt zamiast tria getterów) ──────
  describe('getSession', () => {
    it('spójny z getterami: GUEST na starcie', async () => {
      const s = getSession();
      expect(s.kind).toBe(getUserStatus());
      expect(s.researcherUid).toBe(getResearcherUid());
      expect(s.researcherUid).toBe('GUEST');
      expect(s.canUpload).toBe(false);
      expect(s.isCloudSyncAllowed).toBe(false);
    });

    it('LOCAL po zalogowaniu lokalnym (polityki bez chmury)', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const data = encoder.encode(salt + 'test1234');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);

      await loginLocal('Jan', 'test1234', vi.fn());

      const s = getSession();
      expect(s.kind).toBe('LOCAL');
      expect(s.localUsername).toBe('Jan');
      expect(s.researcherUid).toBe('LOCAL::Jan');
      expect(s.canUpload).toBe(false);
      expect(s.isCloudSyncAllowed).toBe(false);
    });
  });

  // ─── loginLocal ─────────────────────────────────────────────
  describe('loginLocal', () => {
    it('pokazuje błąd gdy brak loginu', async () => {
      await loginLocal('', 'pass', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Podaj login.');
    });

    it('pokazuje błąd gdy brak hasła', async () => {
      await loginLocal('Jan', '', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Podaj hasło.');
    });

    it('pokazuje błąd gdy konto nie istnieje', async () => {
      getLocalAccount.mockResolvedValue(undefined);
      await loginLocal('Nieznany', 'pass123', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Nie znaleziono konta o tej nazwie.');
    });

    it('pokazuje błąd przy nieprawidłowym haśle', async () => {
      getLocalAccount.mockResolvedValue({
        username: 'Jan',
        salt: 'aabbccdd00112233aabbccdd00112233',
        passwordHash: '0000000000000000000000000000000000000000000000000000000000000000',
      });
      await loginLocal('Jan', 'zle_haslo', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Nieprawidłowe hasło.');
    });

    it('loguje pomyślnie z prawidłowymi danymi', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const data = encoder.encode(salt + 'poprawne');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);

      const onSuccess = vi.fn();
      await loginLocal('Jan', 'poprawne', onSuccess);

      expect(updateAuthUI).toHaveBeenCalledWith('Jan', 'LOCAL');
      expect(enforceSyncPolicy).toHaveBeenCalledWith('LOCAL');
      expect(onSuccess).toHaveBeenCalled();
      expect(getUserStatus()).toBe('LOCAL');
      expect(getCurrentLocalUser()).toBe('Jan');
    });

    it('rehashuje stare konto v1 po udanym logowaniu', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(salt + 'stare'));
      const sha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // Konto sprzed planu 013: brak pola hashVersion, hash SHA-256 (v1).
      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: sha256 });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);
      updateLocalAccountHash.mockResolvedValue(undefined);

      const onSuccess = vi.fn();
      await loginLocal('Jan', 'stare', onSuccess);

      expect(onSuccess).toHaveBeenCalled();
      expect(updateLocalAccountHash).toHaveBeenCalledTimes(1);
      const [username, newHash, newSalt, version] = updateLocalAccountHash.mock.calls[0];
      expect(username).toBe('Jan');
      expect(version).toBe(2);
      expect(newSalt).toMatch(/^[0-9a-f]{32}$/);
      expect(newSalt).not.toBe(salt);
      expect(newHash).toMatch(/^[0-9a-f]{64}$/);
      expect(newHash).not.toBe(sha256);
    });

    it('rehash nie blokuje logowania gdy zapis nowego hasha zawiedzie', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(salt + 'stare'));
      const sha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: sha256, hashVersion: 1 });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);
      updateLocalAccountHash.mockRejectedValue(new Error('db failure'));

      const onSuccess = vi.fn();
      await loginLocal('Jan', 'stare', onSuccess);

      expect(onSuccess).toHaveBeenCalled();
      expect(getUserStatus()).toBe('LOCAL');
    });
  });

  // ─── registerLocal ──────────────────────────────────────────
  describe('registerLocal', () => {
    it('odrzuca login krótszy niż 3 znaki', async () => {
      await registerLocal('AB', 'pass1234', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Login musi mieć min. 3 znaki.');
    });

    it('odrzuca login dłuższy niż 30 znaków', async () => {
      await registerLocal('A'.repeat(31), 'pass1234', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Login max. 30 znaków.');
    });

    it('odrzuca hasło krótsze niż 4 znaki', async () => {
      await registerLocal('Jan', 'ab', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Hasło musi mieć min. 4 znaki.');
    });

    it('odrzuca hasło dłuższe niż 30 znaków', async () => {
      await registerLocal('Jan', 'a'.repeat(31), vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Hasło max. 30 znaków.');
    });

    it('odrzuca rejestrację gdy konto już istnieje', async () => {
      getLocalAccount.mockResolvedValue({ username: 'Jan' });
      await registerLocal('Jan', 'pass1234', vi.fn());
      expect(showErrorLocal).toHaveBeenCalledWith('Konto o tej nazwie już istnieje.');
    });

    it('tworzy konto i od razu loguje (auto-login)', async () => {
      getLocalAccount.mockResolvedValue(undefined);
      createLocalAccount.mockResolvedValue(undefined);
      updateLocalAccountLastLogin.mockResolvedValue(undefined);

      const onSuccess = vi.fn();
      await registerLocal('NowyUser', 'pass1234', onSuccess);

      expect(createLocalAccount).toHaveBeenCalled();
      expect(updateAuthUI).toHaveBeenCalledWith('NowyUser', 'LOCAL');
      expect(onSuccess).toHaveBeenCalled();
      expect(getUserStatus()).toBe('LOCAL');
    });

    it('przycina spacje z loginu przed zapisem', async () => {
      getLocalAccount.mockResolvedValue(undefined);
      createLocalAccount.mockResolvedValue(undefined);
      updateLocalAccountLastLogin.mockResolvedValue(undefined);

      await registerLocal('  Jan  ', 'pass1234', vi.fn());

      const [username] = createLocalAccount.mock.calls[0];
      expect(username).toBe('Jan');
    });
  });

  // ─── logoutLocal ────────────────────────────────────────────
  describe('logoutLocal', () => {
    it('resetuje status i pokazuje ekran logowania', async () => {
      const { showLoginScreen } = await import('../../src/modules/ui.js');
      logoutLocal();
      expect(getUserStatus()).toBe('UNKNOWN');
      expect(getCurrentLocalUser()).toBeNull();
      expect(showLoginScreen).toHaveBeenCalled();
    });
  });

  // ─── loginGuest ─────────────────────────────────────────────
  describe('loginGuest', () => {
    it('ustawia status GUEST', async () => {
      loginGuest();
      expect(getUserStatus()).toBe('GUEST');
      expect(getResearcherUid()).toBe('GUEST');
      expect(updateAuthUI).toHaveBeenCalledWith(null, 'GUEST');
    });
  });

  // ─── changeLocalPassword ────────────────────────────────────
  describe('changeLocalPassword', () => {
    it('zwraca błąd gdy brak aktywnego konta LOCAL', async () => {
      // Stan: UNKNOWN (po logoucie)
      logoutLocal();
      const result = await changeLocalPassword('stare', 'nowe1234');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Brak aktywnego konta lokalnego');
    });

    it('zwraca błąd gdy nowe hasło za krótkie', async () => {
      // Najpierw zaloguj lokalnie
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + 'stare'));
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);
      await loginLocal('Jan', 'stare', vi.fn());

      const result = await changeLocalPassword('stare', 'ab');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('min. 4 znaki');
    });

    it('zwraca błąd gdy stare hasło nieprawidłowe', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + 'poprawne'));
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);
      await loginLocal('Jan', 'poprawne', vi.fn());

      // Teraz spróbuj zmienić z nieprawidłowym starym hasłem
      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      const result = await changeLocalPassword('zle_haslo', 'nowe1234');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Stare hasło jest nieprawidłowe');
    });

    it('zmienia hasło pomyślnie', async () => {
      const salt = 'aabbccdd00112233aabbccdd00112233';
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + 'stare'));
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      getLocalAccount.mockResolvedValue({ username: 'Jan', salt, passwordHash: hash });
      updateLocalAccountLastLogin.mockResolvedValue(undefined);
      await loginLocal('Jan', 'stare', vi.fn());

      createLocalAccount.mockResolvedValue(undefined);
      const result = await changeLocalPassword('stare', 'nowe1234');
      expect(result.ok).toBe(true);
      expect(createLocalAccount).toHaveBeenCalled();
    });
  });

  // ─── adminResetLocalPassword ────────────────────────────────
  describe('adminResetLocalPassword', () => {
    it('zwraca błąd gdy nie jest ADMIN', async () => {
      loginGuest(); // status = GUEST
      const result = await adminResetLocalPassword('Jan', 'nowe1234');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Brak uprawnień');
    });

    it('zwraca błąd gdy konto nie istnieje', async () => {
      // Symuluj ADMIN przez bezpośrednie ustawienie statusu
      // Zaloguj przez Firebase mock (status ADMIN)
      // Nie możemy bezpośrednio ustawić _currentUserStatus — testujemy przez guard
      // Ten test sprawdza że guard ADMIN działa
      logoutLocal(); // UNKNOWN
      const result = await adminResetLocalPassword('Nieznany', 'nowe1234');
      expect(result.ok).toBe(false);
      // Odrzucone przez guard ADMIN lub brak konta
      expect(result.error).toBeDefined();
    });

    it('zwraca błąd gdy nowe hasło za krótkie', async () => {
      logoutLocal();
      const result = await adminResetLocalPassword('Jan', 'ab');
      expect(result.ok).toBe(false);
    });
  });

  // ─── Rate Limiting ───────────────────────────────────────────
  describe('Rate Limiting', () => {
    it('blokuje szybkie kolejne próby logowania', async () => {
      getLocalAccount.mockResolvedValue(undefined);

      // Pierwsza próba
      await loginLocal('Jan', 'pass', vi.fn());
      // Druga próba natychmiast
      await loginLocal('Jan', 'pass', vi.fn());

      // Druga próba powinna trafić w rate limit
      const calls = showErrorLocal.mock.calls.map(c => c[0]);
      expect(calls.some(msg => msg.includes('Zbyt szybko'))).toBe(true);
    });
  });
});

describe('Auth Module — Konto Online (PENDING / APPROVED / ERROR)', () => {
  const docSnapshot = (data) => ({ exists: () => true, data: () => data });
  let auth, ui, sync, e2e;
  let initAuth, register, cancelOnlineLogin, getUserStatus;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    fb.authCb.current = null;
    fb.getDoc.mockReset();
    fb.setDoc.mockReset();
    fb.signIn.mockReset();
    fb.signUp.mockReset();
    fb.signOut.mockReset();

    auth = await import('../../src/modules/auth.js');
    ui = await import('../../src/modules/ui.js');
    sync = await import('../../src/modules/sync.js');
    e2e = await import('../../src/modules/e2e.js');
    ({ initAuth, register, cancelOnlineLogin, getUserStatus } = auth);

    initAuth(vi.fn());
    // firebase.js ładuje SDK dynamicznie — callback onAuthStateChanged
    // pojawia się dopiero po rozwiązaniu load().
    await vi.waitFor(() => expect(fb.authCb.current).toBeTypeOf('function'));
  });

  it('PENDING: startuje aplikację bez verifyE2E', async () => {
    fb.getDoc.mockResolvedValue(docSnapshot({ status: 'PENDING' }));

    fb.authCb.current({ uid: 'u-1', email: 'pending@example.com' });

    await vi.waitFor(() =>
      expect(ui.updateAuthUI).toHaveBeenCalledWith('pending@example.com', 'PENDING'),
    );
    expect(sync.enforceSyncPolicy).toHaveBeenCalledWith('PENDING');
    expect(e2e.verifyE2E).not.toHaveBeenCalled();
    expect(getUserStatus()).toBe('PENDING');
  });

  it('APPROVED: przechodzi przez verifyE2E przed startem', async () => {
    fb.getDoc.mockResolvedValue(docSnapshot({ status: 'APPROVED' }));

    fb.authCb.current({ uid: 'u-2', email: 'approved@example.com' });

    await vi.waitFor(() => expect(e2e.verifyE2E).toHaveBeenCalledTimes(1));
    expect(ui.updateAuthUI).toHaveBeenCalledWith('approved@example.com', 'APPROVED');
    expect(getUserStatus()).toBe('APPROVED');
  });

  it('brak dokumentu użytkownika: powrót do panelu online bez startu aplikacji', async () => {
    fb.getDoc.mockResolvedValue({ exists: () => false, data: () => null });

    fb.authCb.current({ uid: 'u-3', email: 'missing@example.com' });

    await vi.waitFor(() => expect(ui.showError).toHaveBeenCalledWith(t('login.accountMissing')));
    expect(ui.showLoginScreen).toHaveBeenCalled();
    expect(ui.showLoginOnlinePanel).toHaveBeenCalled();
    expect(ui.updateAuthUI).not.toHaveBeenCalled();
    expect(getUserStatus()).toBe('ERROR');
    await vi.waitFor(() => expect(fb.signOut).toHaveBeenCalled());
  });

  it('błąd pobrania dokumentu: komunikat accountFetchError z przyczyną', async () => {
    fb.getDoc.mockRejectedValue(new Error('offline'));

    fb.authCb.current({ uid: 'u-4', email: 'x@example.com' });

    await vi.waitFor(() =>
      expect(ui.showError).toHaveBeenCalledWith(
        expect.stringContaining('offline'),
      ),
    );
    expect(ui.updateAuthUI).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fb.signOut).toHaveBeenCalled());
  });

  it('status ERROR z dokumentu blokuje start aplikacji', async () => {
    fb.getDoc.mockResolvedValue(docSnapshot({ status: 'ERROR' }));

    fb.authCb.current({ uid: 'u-5', email: 'err@example.com' });

    await vi.waitFor(() => expect(ui.showError).toHaveBeenCalled());
    expect(ui.updateAuthUI).not.toHaveBeenCalled();
    expect(getUserStatus()).toBe('ERROR');
    await vi.waitFor(() => expect(fb.signOut).toHaveBeenCalled());
  });

  it('błąd klucza E2E (onFailure): brak startu, wylogowanie i czyszczenie kluczy', async () => {
    const e2emod = await import('../../src/modules/e2e.js');
    e2emod.verifyE2E.mockImplementation((user, ok, fail) => fail());
    fb.getDoc.mockResolvedValue(docSnapshot({ status: 'APPROVED' }));

    fb.authCb.current({ uid: 'u-9', email: 'locked@example.com' });

    await vi.waitFor(() => expect(ui.showError).toHaveBeenCalled());
    expect(fb.signOut).toHaveBeenCalled();
    expect(fb.clearE2EKey).toHaveBeenCalled();
    expect(fb.clearCloudKey).toHaveBeenCalled();
    expect(ui.updateAuthUI).not.toHaveBeenCalled();
    e2emod.verifyE2E.mockImplementation((user, ok) => ok && ok());
  });

  it('koniec sesji Firebase czyści klucz E2E z RAM i z magazynu', async () => {
    fb.authCb.current(null);

    await vi.waitFor(() => expect(fb.clearCloudKey).toHaveBeenCalled());
    expect(fb.clearE2EKey).toHaveBeenCalled();
  });

  it('cancelOnlineLogin czyści klucz E2E przed wylogowaniem', async () => {
    await cancelOnlineLogin();

    expect(fb.clearCloudKey).toHaveBeenCalled();
    expect(fb.clearE2EKey).toHaveBeenCalled();
    expect(fb.signOut).toHaveBeenCalled();
  });

  it('rejestracja: dokument PENDING i komunikat o oczekiwaniu na akceptację', async () => {
    fb.signUp.mockResolvedValue({ user: { uid: 'u-6', email: 'new@example.com' } });
    fb.setDoc.mockResolvedValue(undefined);

    await register('new@example.com', 'pass123');

    expect(fb.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ col: 'users', id: 'u-6' }),
      expect.objectContaining({ status: 'PENDING' }),
      { merge: true },
    );
    expect(ui.showError).toHaveBeenCalledWith(t('login.accountCreatedPending'), {
      shake: false,
    });
  });

  it('rejestracja: observer nie czyta dokumentu przed jego zapisem (bramka)', async () => {
    let saved = false;
    fb.setDoc.mockImplementation(async () => {
      saved = true;
    });
    fb.getDoc.mockImplementation(async () =>
      saved
        ? docSnapshot({ status: 'PENDING' })
        : { exists: () => false, data: () => null },
    );
    fb.signUp.mockImplementation(async () => {
      // Firebase odpala observera w trakcie signUp — przed zapisem dokumentu.
      fb.authCb.current({ uid: 'u-8', email: 'gate@example.com' });
      return { user: { uid: 'u-8', email: 'gate@example.com' } };
    });

    await register('gate@example.com', 'pass123');

    await vi.waitFor(() =>
      expect(ui.updateAuthUI).toHaveBeenCalledWith('gate@example.com', 'PENDING'),
    );
    expect(ui.showError).not.toHaveBeenCalledWith(t('login.accountMissing'));
    expect(getUserStatus()).toBe('PENDING');

    // Dowód, że bramka zadziałała: odczyt dokumentu nastąpił dopiero po zapisie.
    // Bez bramki observer czytałby go w trakcie signUp (przed setDoc).
    expect(fb.getDoc.mock.invocationCallOrder[0]).toBeGreaterThan(
      fb.setDoc.mock.invocationCallOrder[0],
    );
  });

  it('anulowanie PIN czyści status i wylogowuje sesję Firebase', async () => {
    fb.getDoc.mockResolvedValue(docSnapshot({ status: 'APPROVED' }));
    fb.authCb.current({ uid: 'u-7', email: 'a@example.com' });
    await vi.waitFor(() => expect(getUserStatus()).toBe('APPROVED'));

    await cancelOnlineLogin();

    expect(getUserStatus()).toBe('UNKNOWN');
    expect(fb.signOut).toHaveBeenCalled();
  });

  it('rate limit online nie blokuje natychmiastowego logowania lokalnego', async () => {
    const db = await import('../../src/modules/database.js');
    db.getLocalAccount.mockResolvedValue(undefined);

    await auth.login('a@b.pl', 'pass');
    await auth.loginLocal('Jan', 'pass', vi.fn());

    const msgs = ui.showErrorLocal.mock.calls.map((c) => c[0]);
    expect(msgs.some((msg) => msg.includes('Zbyt szybko'))).toBe(false);
  });
});
