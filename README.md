# Nous - Launcher Testów Psychologicznych

<p align="center">
  <img src="logo.png" alt="Nous Logo" width="120" />
</p>

**Nous** to desktopowa aplikacja stworzona w technologii Electron, służąca do zarządzania, pobierania i uruchamiania testów psychologicznych/psychometrycznych. Aplikacja zapewnia bezpieczne środowisko do przeprowadzania badań, przechowywania wyników oraz synchronizacji danych z chmurą Firebase.

---

## 📑 Spis Treści

- [Stos Technologiczny](#-stos-technologiczny)
- [Architektura Aplikacji](#-architektura-aplikacji)
- [Bezpieczeństwo](#-bezpieczeństwo)
- [Sposób Działania](#-sposób-działania)
- [Struktura Projektu](#-struktura-projektu)
- [Instalacja i Uruchomienie](#-instalacja-i-uruchomienie)
- [Budowanie Aplikacji](#-budowanie-aplikacji)

---

## 🛠 Stos Technologiczny

| Kategoria | Technologia | Wersja |
|-----------|-------------|--------|
| **Framework Desktop** | Electron | 40.0.0 |
| **Backend Chmurowy** | Firebase (Auth, Firestore, App Check) | 12.8.0 |
| **Baza Lokalna** | IndexedDB (via idb) | 8.0.3 |
| **Obsługa Archiwów** | adm-zip | 0.5.16 |
| **Build Tool** | electron-builder | 26.4.0 |
| **Frontend** | Vanilla JavaScript (ES Modules) | - |
| **Stylowanie** | CSS3 | - |

---

## 🏗 Architektura Aplikacji

Aplikacja wykorzystuje **architekturę trójwarstwową Electrona** z pełną izolacją kontekstów:

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN PROCESS (main.js)                   │
│  • Zarządzanie oknami (BrowserWindow)                       │
│  • Operacje systemowe (plik, sieć, crypto)                  │
│  • Bezpieczne przechowywanie kluczy (safeStorage)           │
│  • Obsługa IPC                                              │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ IPC (Inter-Process Communication)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   PRELOAD (preload.js)                      │
│  • Most między Main a Renderer                              │
│  • contextBridge - bezpieczne API                           │
│  • Ograniczony dostęp do Node.js                            │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ window.electronAPI
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              RENDERER PROCESS (index.html + src/)           │
│  • Interfejs użytkownika                                    │
│  • Moduły aplikacji (auth, database, sync, etc.)            │
│  • Firebase SDK                                             │
└─────────────────────────────────────────────────────────────┘
```

### Kluczowe Elementy

1. **Main Process** (`main.js`) - Proces główny z pełnym dostępem do Node.js i API systemowych
2. **Preload Script** (`preload.js`) - Warstwa pośrednia eksponująca kontrolowane API
3. **Renderer Process** - Frontend aplikacji z modułami w `src/modules/`

---

## 🔒 Bezpieczeństwo

Aplikacja implementuje wielowarstwowy model bezpieczeństwa:

### 1. Izolacja Kontekstu (Context Isolation)

```javascript
webPreferences: {
    nodeIntegration: false,    // Brak bezpośredniego dostępu do Node.js
    contextIsolation: true,    // Pełna izolacja kontekstów
    preload: path.join(__dirname, 'preload.js')
}
```

Renderer nie ma bezpośredniego dostępu do API Node.js - wszystkie operacje przechodzą przez kontrolowane API `contextBridge`.

### 2. Walidacja Danych Wejściowych

**Walidacja ID Testów (Path Traversal Prevention):**

```javascript
if (!/^[a-zA-Z0-9_-]+$/.test(testId)) {
    // Blokada prób ataków typu "../../../Windows"
    return 'BŁĄD BEZPIECZEŃSTWA: Nieprawidłowe ID testu!';
}
```

**Allowlist Domen Pobierania:**

```javascript
const allowedDomains = ['github.com', 'raw.githubusercontent.com'];
if (!allowedDomains.includes(parsedUrl.hostname)) {
    return 'BŁĄD BEZPIECZEŃSTWA: Niedozwolona domena!';
}
```

**Wymuszenie HTTPS:**

```javascript
if (parsedUrl.protocol !== 'https:') {
    return 'BŁĄD BEZPIECZEŃSTWA: Tylko HTTPS jest dozwolony!';
}
```

### 3. Ochrona przed ZipSlip

Przed rozpakowaniem archiwum ZIP, każdy plik jest walidowany:

```javascript
for (const entry of zipEntries) {
    const targetPath = path.join(testFolder, entry.entryName);
    if (!targetPath.startsWith(testFolder)) {
        throw new Error('Malicious ZIP detected!');
    }
}
```

### 4. Szyfrowanie Danych (AES-256-GCM)

Wrażliwe dane użytkownika są szyfrowane przed zapisem do IndexedDB:

```javascript
// Algorytm: AES-GCM (Authenticated Encryption)
// Klucz: 256-bit (32 bajty)
// IV: 12 bajtów (generowany losowo dla każdego rekordu)

cryptoKey = await window.crypto.subtle.importKey(
    "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
);
```

### 5. Bezpieczne Przechowywanie Klucza Master

Klucz szyfrowania jest chroniony przez system operacyjny za pomocą `safeStorage` (Electron):

```javascript
// Windows: DPAPI (Data Protection API)
// macOS: Keychain
// Linux: libsecret

const encryptedKey = safeStorage.encryptString(newKey);
fs.writeFileSync(keyFilePath, encryptedKey);
```

### 6. Podpisywanie Wyników (HMAC-SHA256)

Eksportowane wyniki badań są podpisywane cyfrowo:

```javascript
const hmac = crypto.createHmac('sha256', masterKey);
hmac.update(JSON.stringify(dataToSave.wyniki));
const signature = hmac.digest('hex');
```

### 7. Firebase App Check (reCAPTCHA v3)

Ochrona backendu przed nieautoryzowanymi żądaniami:

```javascript
const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('SITE_KEY'),
    isTokenAutoRefreshEnabled: true
});
```

---

## ⚙ Sposób Działania

### Cykl Życia Testu

```
                    ┌──────────────────┐
                    │  Biblioteka      │
                    │  Firebase        │
                    │  (Firestore)     │
                    └────────┬─────────┘
                             │
                     1. Pobierz metadane
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    BIBLIOTEKA TESTÓW                        │
│  • Lista dostępnych testów z Firebase                       │
│  • Status lokalny (zainstalowany/do aktualizacji)           │
│  • Sortowanie i wyszukiwanie                                │
└─────────────────────────────────────────────────────────────┘
                             │
                    2. Pobierz i zainstaluj
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM CACHE                             │
│  Lokalizacja: %AppData%/Nous/tests_library/                 │
│  Struktura:                                                 │
│    └── {testId}/                                            │
│        ├── meta.json (wersja, data aktualizacji)            │
│        └── {rozpakowane pliki testu}                        │
└─────────────────────────────────────────────────────────────┘
                             │
                  3. Uruchom test (fullscreen)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 OKNO TESTOWE (BrowserWindow)                │
│  • Pełny ekran (fullscreen: true)                           │
│  • Izolowane środowisko                                     │
│  • Komunikacja przez IPC                                    │
└─────────────────────────────────────────────────────────────┘
                             │
                   4. Zakończenie testu
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  ZAPIS WYNIKÓW                              │
│  • Szyfrowanie AES-256-GCM                                  │
│  • Zapis do IndexedDB                                       │
│  • Opcjonalny eksport JSON z HMAC                           │
│  • Auto-synchronizacja z Firebase (jeśli włączona)          │
└─────────────────────────────────────────────────────────────┘
```

### Synchronizacja Danych

Aplikacja wykrywa status połączenia i automatycznie synchronizuje dane:

```javascript
window.addEventListener('online', () => {
    syncNow(); // Automatyczna synchronizacja przy powrocie online
});
```

**Statusy synchronizacji:**

- `PENDING` - Oczekuje na wysłanie do chmury
- `SYNCED` - Zsynchronizowany z Firebase

---

## 📁 Struktura Projektu

```
BBTP-Launcher/
├── main.js              # Proces główny Electron
├── preload.js           # Bridge między Main a Renderer
├── preload_test.js      # Preload dla okna testowego
├── index.html           # Główny interfejs użytkownika
├── style.css            # Style aplikacji
├── package.json         # Zależności i konfiguracja buildu
│
├── src/
│   ├── app.js           # Inicjalizacja aplikacji
│   ├── firebaseConfig.js # Konfiguracja Firebase
│   │
│   ├── lib/
│   │   └── idb.js       # Biblioteka IndexedDB
│   │
│   └── modules/
│       ├── auth.js          # Uwierzytelnianie Firebase
│       ├── cryptoService.js # Szyfrowanie AES-GCM
│       ├── database.js      # Operacje IndexedDB
│       ├── sync.js          # Synchronizacja z chmurą
│       ├── library.js       # Biblioteka testów
│       ├── updates.js       # Aktualizacje testów
│       ├── results.js       # Obsługa wyników
│       ├── history.js       # Historia badań
│       ├── demographics.js  # Dane demograficzne
│       ├── demoCreator.js   # Kreator metryczek
│       ├── dialog.js        # Dialogi modalne
│       ├── recaptcha.js     # reCAPTCHA helper
│       └── ui.js            # Utilities UI
│
└── dist/                # Zbudowane aplikacje
```

---

## 🚀 Instalacja i Uruchomienie

### Wymagania

- Node.js 18+
- npm 9+

### Instalacja Zależności

```bash
npm install
```

### Uruchomienie w Trybie Deweloperskim

```bash
npm start
```

---

## 📦 Budowanie Aplikacji

### Windows (NSIS Installer + Portable)

```bash
npm run dist
```

Wynikowe pliki znajdziesz w katalogu `dist/`:

- `Nous Setup X.X.X.exe` - Instalator NSIS
- `Nous X.X.X.exe` - Wersja portable

### Linux (AppImage + DEB)

```bash
npm run dist:linux
```

---

## 📋 Licencja

Ten projekt jest objęty licencją ISC.

---

<p align="center">
  <i>Nous - Bezpieczne narzędzie do badań psychometrycznych</i>
</p>
