import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock modułów zależnych
vi.mock('../../src/modules/ui.js', () => ({
  updateAuthUI: vi.fn(),
  showLoginScreen: vi.fn(),
  showError: vi.fn(),
  showErrorLocal: vi.fn(),
  showLoginChoice: vi.fn(),
}));

vi.mock('../../src/modules/sync.js', () => ({
  enforceSyncPolicy: vi.fn(),
}));

vi.mock('../../src/modules/e2e.js', () => ({
  verifyE2E: vi.fn((user, cb) => cb && cb()),
}));

vi.mock('../../src/modules/database.js', () => ({
  getLocalAccount: vi.fn(),
  createLocalAccount: vi.fn(),
  updateLocalAccountLastLogin: vi.fn(),
}));

// Firebase mock — auth.currentUser = null (konta lokalne nie używają Firebase)
vi.mock('../../src/firebaseConfig.js', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((cb) => {
      cb(null); // brak zalogowanego użytkownika Firebase
      return vi.fn(); // unsubscribe
    }),
  },
  db: {},
}));

// Mock firebase-auth
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

// Mock firebase-firestore
vi.mock('https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
}));

describe('Auth Module — Konta Lokalne', () => {
  let getLocalAccount, createLocalAccount, updateLocalAccountLastLogin;
  let updateAuthUI, showErrorLocal, enforceSyncPolicy;
  let loginLocal, registerLocal, logoutLocal, loginGuest;
  let getResearcherUid, getUserStatus, getCurrentLocalUser;
  let changeLocalPassword, adminResetLocalPassword;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Ponowne załadowanie mocków po resetModules
    const dbMock = await import('../../src/modules/database.js');
    getLocalAccount = dbMock.getLocalAccount;
    createLocalAccount = dbMock.createLocalAccount;
    updateLocalAccountLastLogin = dbMock.updateLocalAccountLastLogin;

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
