# Testy Webowe BBTP w Nous (docs/app/tests)

Ten folder zawiera przeglądarkowe wersje testów psychologicznych zaimportowane z repozytorium **BBTP** (`https://github.com/KaucBartosz/BBTP.git`).

---

## 1. Jak testy działają w wersji przeglądarkowej (WebApp)

W wersji webowej programu Nous testy są uruchamiane w osobnych kartach przeglądarki (`window.open(test.webPath, "_blank")`) na podstawie wpisów w `docs/app/tests-registry.json`.

Każdy folder testu stanowi samodzielną aplikację opartą o silnik **PsychoJS** (przeglądarkowy port PsychoPy):

```
docs/app/tests/<NazwaTestu>/
├── index.html                  # Główny punkt wejścia otwierany przez WebApp
├── <nazwaTestu>.js             # Logika testu (bodźce, reakcje, wyliczanie RT, sendResults)
├── <nazwaTestu>-legacy-...js   # Wersja dla starszych przeglądarek (opcjonalna)
├── lib/                        # Silnik PsychoJS (NIE USUWAĆ!)
│   ├── psychojs-2025.1.1.js    # Moduł ES importowany przez plik testu
│   ├── psychojs-2025.1.1.iife.js
│   └── psychojs-2025.1.1.css   # Style wizualne silnika PsychoJS
└── resources/                  # Zasoby: grafiki bodźców (.png), dźwięki, arkusze prób (.csv)
```

> [!IMPORTANT]
> **Dlaczego foldery `lib/` i pliki `index.html` są absolutnie niezbędne:**
> - `index.html` definiuje kontener DOM (`#root`), ładuje biblioteki pomocnicze (jQuery, PreloadJS), arkusze stylów oraz wstrzyknięty **WebAdapter**.
> - Główny plik skryptu każdego testu (np. `GoNoGo.js`) rozpoczyna się od importu:
>   `import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';`
> - Usunięcie folderu `lib/` lub pliku `index.html` uniemożliwia start testu (błąd 404 / `Failed to resolve module specifier`).

---

## 2. Mostek komunikacyjny: WebAdapter (`web-adapter.js`)

Testy z BBTP są projektowane z myślą o środowisku **Electron** i domyślnie oczekują obecności obiektu `window.electronTest.sendResults(dane)`.

W wersji webowej mostek zapewnia plik [web-adapter.js](file:///C:/Users/HARDPC/Desktop/Nous/web/web-adapter.js):
1. **Wstrzyknięcie do `index.html`:**
   Każdy plik `index.html` w `tests/<NazwaTestu>/` ma w sekcji `<head>` osadzony skrypt:
   ```html
   <script src="../../web-adapter.js"></script>
   ```
2. **Emulacja API `window.electronTest`:**
   `web-adapter.js` tworzy globalny obiekt `window.electronTest` i implementuje metodę `sendResults(data)`.
3. **Przekazanie wyników do okna głównego (Launcher):**
   - Jeśli test został otwarty z poziomu aplikacji Nous (`window.opener`), wyniki są przesyłane bezpiecznym mechanizmem `postMessage`:
     ```javascript
     window.opener.postMessage({ type: "test-results", data: data }, window.location.origin);
     ```
   - Okno główne Nous ([src/platform/web.js](file:///C:/Users/HARDPC/Desktop/Nous/src/platform/web.js)) nasłuchuje zdarzenia `onResults`, zapisuje rekord do lokalnej bazy **IndexedDB** bieżącego badacza i zamyka okno testu.
   - **Fallback:** Gdy test zostanie uruchomiony bezpośrednio (bez okna rodzica), `web-adapter.js` automatycznie generuje i pobiera plik CSV na dysk użytkownika.

---

## 3. Patch `sendResults` (expInfo)

Wiele testów PsychoJS przechowuje metadane badania (`participant`, `session`, `date`) w zmiennej `expInfo`, nie dołączając ich bezpośrednio do obiektu przekazywanego w wywołaniu `sendResults`.

Skrypt synchronizujący [inject-adapter.js](file:///C:/Users/HARDPC/Desktop/Nous/inject-adapter.js) automatycznie dopisuje na końcu każdego pliku testowego `.js` poniższy fragment (wrapper):

```javascript
// Nous: patch sendResults byuc dołączania wszystkich pól expInfo (participant, session, date ...)
(function() {
    if (typeof window.electronTest !== 'undefined' && window.electronTest.sendResults) {
        var _orig = window.electronTest.sendResults;
        window.electronTest.sendResults = function(data) {
            return _orig(Object.assign({}, typeof expInfo !== 'undefined' ? expInfo : {}, data));
        };
    }
})();
```

Dzięki temu ID badanego oraz parametry sesji są zawsze kompletne w bazie danych Nous.

---

## 4. Jak poprawnie aktualizować i synchronizować testy z BBTP

Gdy w repozytorium **BBTP** (np. `C:\Users\HARDPC\Desktop\BBTP`) pojawią się zmiany (np. poprawki liczenia czasów reakcji, nowe bodźce, nowe bloki statystyk):

### Krok 1: Uruchomienie skryptu synchronizującego
W katalogu głównym Nous uruchom:
```bash
node scripts/sync-bbtp.js "C:\Users\HARDPC\Desktop\BBTP"
```
*(Gdy ścieżka nie zostanie podana, skrypt domyślnie użyje `C:\Users\HARDPC\Desktop\BBTP`, a jeśli folder nie istnieje – sklonuje repozytorium z GitHub).*

Skrypt automatycznie:
- Kopiuje zaktualizowane foldery testów do `docs/app/tests/`, ignorując pliki robocze (`.py`, `.zip`, `.map`, foldery `out/`, `tests/` z testów automatycznych Playwright itp.),
- Rejestruje nowe testy w [docs/app/tests-registry.json](file:///C:/Users/HARDPC/Desktop/Nous/docs/app/tests-registry.json),
- Uruchamia [inject-adapter.js](file:///C:/Users/HARDPC/Desktop/Nous/inject-adapter.js), wstrzykując `web-adapter.js` do `index.html` oraz doklejając patch `sendResults`.

### Krok 2: Przebudowa powłoki webowej
```bash
node build_web.js
```
Skrypt `build_web.js` zsynchronizuje kod aplikacji z `src/` do `docs/app/src/`, usunie zbędne source-mapy i przygotuje wersję gotową do publikacji na GitHub Pages.

### Krok 3: Weryfikacja testów jednostkowych
```bash
npm run test:run
```
Upewnij się, że testy platformy webowej i parsowania rejestru testów przechodzą bez błędów.

---

## 5. Podsumowanie zasad dla agentów i deweloperów
1. **Nigdy nie usuwaj `index.html` ani `lib/`** z folderów poszczególnych testów w `docs/app/tests/`.
2. Pliki `.zip` w repozytorium BBTP to paczki 1:1 przygotowane do pobrania – wersja webowa Nous korzysta bezpośrednio z rozpakowanych folderów testów.
3. Jeśli po synchronizacji `git status` pokazuje zmiany w plikach `lib/` lub `index.html`, a treść kodu się nie zmieniła, jest to najczęściej zmiana formatowania znaków końca linii (CRLF vs LF) w systemie Windows (`git checkout -- "docs/app/tests/*/index.html"`).
