# Poradnik Agenta Testów – Projekt Nous

## 1. Architektura Nous

**Nous** (v1.1.8) to launcher (Electron) do badań psychologicznych i klinicznych:

- Zarządza biblioteką testów z GitHub (paczki ZIP)
- Obsługuje metryczki badanych (demografię)
- Przechowuje wyniki: IndexedDB lokalnie + synchronizacja Firebase

### Rodzaj testów

#### Testy Webowe (JS/HTML) – jedyny wspierany format

- **Plik startowy**: `index.html` (w głównym folderze lub podfolderze)
- **Komunikacja**: `window.electronTest` (bridge)
- **Zakończenie**: `window.electronTest.sendResults(data)` – zapis wyników
- **Wyjście bez zapisu**: `window.electronTest.close()` – ESC/przerwanie
- Uruchamiane w pełnoekranowym oknie Electrona

> Tryb HPM (Python/PsychoPy, `main.py`) został wycofany — precyzja pomiaru
> w wersji JS jest wystarczająca. Sekcje Python w tym poradniku usunięto;
> paczki testów zawierają wyłącznie pliki JS/HTML.

---

## 2. Standardowe Nazewnictwo Wyników (OBOWIĄZKOWE)

Wszystkie testy muszą zwracać te same pola w `sendResults()`:

### Główne pola (używane w podsumowaniu zaraz po teście)

```javascript
{
  "testId": "nazwa_testu",              // string, bez spacji
  "subjectId": "opcjonalny_id",         // jeśli test sam nadaje ID
  "timestamp": "2025-02-20T12:00:00Z",   // ISO string
  "ilosc_poprawnych_nacisniec": 5,      // liczba poprawnych kliknięć/naciśnięć
  "ilosc_blednych_nacisniec": 3,        // liczba błędnych kliknięć/naciśnięć
  "ogolna_ilosc_nacisniec": 8,          // łączna liczba kliknięć/naciśnięć
  "sredni_czas_reakcji": 450            // średni RT w ms (TYLKO jeśli test mierzy RT)
}
```

### Dodatkowe pola (opcjonalne, widoczne w pliku wynikowym)

- `score`: tekst podsumowania (np. `"Poprawne: 5 | Błędne: 3 | Skuteczność: 62%"`)
- `statystyki`: obiekt ze szczegółowymi statystykami
- `wyniki`: surowe dane prób (lista obiektów)
- `poziom_trudnosci`: dla testów z wyborem poziomu (GoNoGo, PingPong, Samochodzik itp.)

**WAŻNE:**

- Jeśli test **NIE mierzy czasu reakcji**, **NIE umieszczaj** `sredni_czas_reakcji` w wynikach
- Jeśli test mierzy RT, zawsze licz średni RT dla **wszystkich odpowiedzi** (poprawnych i błędnych), chyba że specyfika testu wymaga inaczej
- Niektóre testy mają dodatkowe pola specyficzne dla testu – to jest dopuszczalne (patrz sekcja 10)

---

## 3. Checklista dla Nowych/Przeglądanych Testów

### Integracja z Nous (JS)

- [ ] Sprawdzenie `window.electronTest` przed zapisem CSV: `psychoJS.experiment.save = function() { return Promise.resolve(); }`
- [ ] ESC = wyjście bez zapisu: `if (!isCompleted) window.electronTest.close()`
- [ ] Normalne zakończenie: `window.electronTest.sendResults({...})` z ujednoliconymi polami
- [ ] Filtrowanie `_trialsData`: tylko wiersze z `typeof t.correct !== 'undefined'` (pomijamy welcome)

### Nazewnictwo wyników

- [ ] `ilosc_poprawnych_nacisniec` (nie: trafień, kliknięć, odpowiedzi)
- [ ] `ilosc_blednych_nacisniec` (nie: błędów, pomyłek)
- [ ] `ogolna_ilosc_nacisniec` (nie: wszystkie_kliki, total_clicks)
- [ ] `sredni_czas_reakcji` tylko jeśli test mierzy RT

### Ekran wprowadzający

- [ ] Tekst instrukcji wyjaśniający zadanie
- [ ] Wyjście przez ESC (bez zapisu lub pusty wynik)
- [ ] Kontynuacja przez klawisz (spacja/Enter)

### Obsługa ekranu dotykowego (JS)

- [ ] Pobranie canvas: `psychoJS.window._renderer.view` lub `document.querySelector('canvas')`
- [ ] Event listeners: `touchstart`, `touchend`, `touchmove` z `preventDefault()`
- [ ] Konwersja współrzędnych: `touchToPsycho(clientX, clientY)` → jednostki PsychoJS
- [ ] Funkcja `pointInStim(px, py, stim)` z zabezpieczeniem na `pos`/`size`
- [ ] Czyszczenie stanu dotyku po obsłużeniu (`_touchJustStarted = false`)

### Inne

- [ ] Usunięcie referencji do legacy scripts z `index.html`
- [ ] Brak zduplikowanego kodu (np. podwójne sprawdzanie ESC)
- [ ] Poprawne liczenie statystyk (np. średni RT dla wszystkich odpowiedzi, nie tylko poprawnych)

---

## 4. Typowe Problemy i Rozwiązania

### Problem: Zafałszowana średnia RT / liczba prób

**Przyczyna**: `_trialsData` zawiera wiersz z rutyny welcome (bez `correct`)
**Rozwiązanie**: Filtrowanie przed pętlą wyników:

```javascript
let allData = (psychoJS.experiment._trialsData || []).filter(
  function (t) { return typeof t.correct !== 'undefined'; }
);
```

### Problem: Dotyk nie działa

**Przyczyna**: Brak konwersji współrzędnych lub błędne sprawdzanie `contains`
**Rozwiązanie**:

- Konwersja `touchToPsycho()` z aspect ratio
- Funkcja `pointInStim()` z zabezpieczeniem na `pos`/`size`
- Sprawdzanie `opacity > 0` przed hit-testem

### Problem: Niezgodne nazwy wyników

**Przyczyna**: Różne testy używają różnych nazw
**Rozwiązanie**: Zawsze używać:

- `ilosc_poprawnych_nacisniec`
- `ilosc_blednych_nacisniec`
- `ogolna_ilosc_nacisniec`
- `sredni_czas_reakcji` (tylko jeśli mierzy RT)

---

## 5. Przykłady Poprawnego Kodu

### JS: quitPsychoJS z ujednoliconymi polami

```javascript
async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }
  if (typeof window.electronTest !== 'undefined') {
      if (isCompleted) {
          let allData = (psychoJS.experiment._trialsData || []).filter(
              function (t) { return typeof t.correct !== 'undefined'; }
          );
          let poprawneNacisniecia = 0;
          let wszystkieNacisniecia = 0;
          let sumRT = 0;
          let validRTCount = 0;

          for (let trial of allData) {
              wszystkieNacisniecia++;
              if (trial.correct === 1) poprawneNacisniecia++;
              if (typeof trial.rt === 'number' && trial.rt >= 0) {
                  sumRT += trial.rt;
                  validRTCount++;
              }
          }

          let bledneNacisniecia = Math.max(0, wszystkieNacisniecia - poprawneNacisniecia);
          let sredniCzasReakcji = validRTCount > 0 ? Math.round((sumRT / validRTCount) * 1000) : 0;

          window.electronTest.sendResults({
              testId: expInfo['expName'],
              subjectId: expInfo['participant'],
              timestamp: new Date().toISOString(),
              ilosc_poprawnych_nacisniec: poprawneNacisniecia,
              ilosc_blednych_nacisniec: bledneNacisniecia,
              ogolna_ilosc_nacisniec: wszystkieNacisniecia,
              sredni_czas_reakcji: sredniCzasReakcji, // TYLKO jeśli test mierzy RT
              score: `Poprawne: ${poprawneNacisniecia} | Błędne: ${bledneNacisniecia} | ...`,
              wyniki: allData
          });
      } else {
          window.electronTest.close();
      }
  }
  psychoJS.window.close();
  psychoJS.quit({message: message, isCompleted: isCompleted});
  return Scheduler.Event.QUIT;
}
```

### JS: Obsługa dotyku

```javascript
// W experimentInit:
window._touchJustStarted = false;
window._touchPsychoX = null;
window._touchPsychoY = null;
let canvas = (psychoJS.window._renderer && psychoJS.window._renderer.view) || document.querySelector('canvas');
if (canvas) {
  window._touchCanvas = canvas;
  function touchToPsycho(clientX, clientY) {
    let r = canvas.getBoundingClientRect();
    let aspect = r.width / r.height;
    return {
      x: (2 * (clientX - r.left) / r.width - 1) * aspect,
      y: 1 - 2 * (clientY - r.top) / r.height
    };
  }
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      let p = touchToPsycho(e.touches[0].clientX, e.touches[0].clientY);
      window._touchJustStarted = true;
      window._touchPsychoX = p.x;
      window._touchPsychoY = p.y;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
}

// W trialRoutineEachFrame:
function pointInStim(px, py, stim) {
  let pos = stim.pos || stim._pos;
  let size = stim.size || stim._size || [0.08, 0.08];
  if (!pos || (typeof pos[0] !== 'number') || (typeof pos[1] !== 'number')) return false;
  let hx = (Array.isArray(size) ? size[0] : size) / 2;
  let hy = (Array.isArray(size) ? size[1] : size) / 2;
  return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
}

if (show_feedback === false && window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas) {
  for (let ix = 0; ix < lamp_grid.length; ix++) {
    for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
      if (lamp_grid[ix][iy].opacity === 0) continue;
      if (pointInStim(window._touchPsychoX, window._touchPsychoY, lamp_grid[ix][iy])) {
        // ... obsługa kliknięcia ...
        break;
      }
    }
    if (show_feedback) break;
  }
  window._touchJustStarted = false;
  window._touchPsychoX = null;
  window._touchPsychoY = null;
} else if (window._touchJustStarted) {
  window._touchJustStarted = false;
  window._touchPsychoX = null;
  window._touchPsychoY = null;
}
```

---

## 6. Struktura Plików Testu

```
NazwaTestu/
├── index.html              # Entry point
├── NazwaTestu.js           # Główny plik JS (lub semafor.js, Poppelv2.js itd.)
├── resources/              # Zasoby (obrazy, dźwięki)
│   ├── obraz1.png
│   └── obraz2.png
├── lib/                    # Biblioteki PsychoJS (opcjonalne)
│   └── psychojs-2025.1.1.js
└── data/                   # Zapis CSV (jeśli nie Nous)
```

---

## 7. Tryb Treningowy

- Włącza się przełącznikiem w Bibliotece (per użytkownik, zapamiętany w `localStorage`).
- Launcher zapamiętuje stan przełącznika **w momencie startu testu** (snapshot).
- Po zakończeniu testu w trybie treningowym launcher **nie pokazuje okna wyników
  i nie zapisuje nic do Historii** — pokazuje tylko toast
  „Tryb treningowy włączony. Nie zapisano wyniku".
- Test JS **nie otrzymuje** informacji o trybie treningowym — nie musi nic
  obsługiwać ani zmieniać (np. liczby prób).

---

## 8. Ważne Uwagi

- **Nie tworzyć** dokumentacji/README chyba że użytkownik wyraźnie poprosi
- **Nie zmieniać** logiki testu bez wyraźnej prośby użytkownika
- **Zachowywać** oryginalne działanie testu przy dodawaniu funkcji
- **Sprawdzać** czy test działa zarówno z myszą jak i dotykiem (jeśli dotyk jest dodany)
- **Ujednolicać** nazewnictwo wyników we wszystkich testach
- **Filtrować** `_trialsData` aby pominąć wiersze bez `correct` (welcome itp.)
- **ESC zawsze** = `window.electronTest.close()` (bez zapisu) gdy `isCompleted === false`

---

## 9. Przykładowe Zadania

### "Przeanalizuj test X i popraw..."

1. Przeczytaj główny plik JS
2. Sprawdź `quitPsychoJS` pod kątem nazewnictwa
3. Sprawdź obsługę ESC
4. Sprawdź czy są referencje do legacy scripts
5. Sprawdź czy test mierzy RT (jeśli tak, czy `sredni_czas_reakcji` jest w wynikach)
6. Wprowadź poprawki zgodnie z checklistą

### "Dodaj obsługę ekranu dotykowego"

1. W `experimentInit`: pobierz canvas, dodaj touch listeners
2. W `trialRoutineEachFrame`: dodaj funkcję `pointInStim` i blok obsługi dotyku
3. Pamiętaj o czyszczeniu stanu dotyku po obsłużeniu

---

## 10. Testy w Projekcie

| Test | Typ | RT | Dotyk | Specyfika |
|------|-----|----|-------|-----------|
| **BystreOczko** | JS | ✅ tak | ✅ JS | Siatka sygnalizatorów; `ilosc_obiektow_do_klikniecia` |
| **Poppel** | JS | ❌ nie | ✅ JS | Obiekty przesuwające się; `ilosc_obiektow_do_klikniecia` |
| **Semafor** | JS | ❌ nie | ✅ JS | Matryce logiczne; `ilosc_obiektow_do_klikniecia` |
| **Raven** | JS | ✅ tak | ❌ | Test matryc logicznych |
| **GoNoGo** | JS | ✅ tak | ❌ | Go/NoGo; `poziom_trudnosci`; parzyste=GO |
| **Stop** | JS | ✅ tak | ❌ | Samochód + znak STOP; kliknięcie myszą |
| **Sygnalizacja** | JS | ✅ tak | ❌ | Dwa auta, dwa światła; klawisze A/D lub strzałki; "falstart" = błąd |
| **Samochodzik** | JS | ❌ nie | ❌ | Nawigacja autem; `czas_pokonania_trasy_sek`; kolizje=błędy |
| **Piórkowski** | JS | ✅ tak | ❌ | Kółka losowo; kliknięcie w auto; `klikniecia_bez_kolka`; wybór czasu trwania |
| **PingPong** | JS | ❌ nie | ❌ | Odbijanie piłki 2 paletkami; `ilosc_poprawnych_nacisniec` = odbicia paletką, `ilosc_blednych_nacisniec` = przepuszczone; `poziom_trudnosci`; tryb Trudny ma progresję prędkości |

### Uwagi o specyficznych polach wynikowych

- **Samochodzik**: `ilosc_poprawnych_nacisniec` = 1 jeśli trasa ukończona, `ilosc_blednych_nacisniec` = liczba kolizji, `czas_pokonania_trasy_sek` = czas przejazdu
- **Piórkowski**: `ogolna_ilosc_nacisniec` = łączna liczba kółek (trafione + pominięte), `klikniecia_bez_kolka` = kliknięcia bez aktywnego kółka
- **GoNoGo**: `ogolna_ilosc_nacisniec` = liczba naciśnięć spacji (nie łączna liczba prób), `poziom_trudnosci` = nazwa wybranego poziomu
- **Sygnalizacja**: `ogolna_ilosc_nacisniec` = tylko aktywne kliknięcia (bez `too_slow`), RT liczone tylko od momentu pojawienia się zielonego światła
- **PingPong**: ⚠️ wymaga refaktoryzacji – brak integracji z Nous

---

**Ostatnia aktualizacja**: 2026-10-15
**Wersja Nous**: 1.4.0
