# Plan modernizacji UI pozostałych zakładek

Cel: przenieść język wizualny zakładki **Statystyka** na wszystkie pozostałe
widoki, bez zmiany funkcjonalności i bez big-bang refaktoru.

Dokument jest planem wykonawczym. Implementacja idzie fazami — każda faza
zostawia aplikację w stanie działającym i wizualnie spójnym.

---

## 1. Co dokładnie definiuje „design Statystyki”

Wzorzec jest już w `style.css` (linie 2558–3315) i `index.html` (747–956):

| Element | Klasy | Cechy |
|---|---|---|
| Nagłówek strony | `.stats-header`, `.stats-header-title`, `.stats-header-icon` | ikona 46×46 w kafelku 14 px, gradient primary, `h3` 20 px/700, podtytuł 13 px muted |
| Sekcje | `.stats-section`, `.stats-section-header` | karta `--glass-bg` + `--glass-border`, radius 12 px, padding 16/18, nagłówek `h4` 15 px z ikoną primary |
| Pasek filtrów | `.stats-controls`, `.stats-field` | karta jw., pola z etykietą uppercase 11 px |
| Przełącznik trybu | `.stats-segmented`, `.stats-segmented-btn` | pill, aktywny = `--primary` + `--primary-glow` |
| Kafelki KPI | `.stats-kpi` | akcent 2 px u góry, wartość 26 px, `tabular-nums`, warianty `is-up`/`is-down` |
| Tabele | `.stats-table` | sticky `thead`, zebra, hover, radius 10 px, `tabular-nums` dla liczb |
| Chipy | `.metric-chip` | pill, zaznaczenie `rgba(79,140,242,.16)` + primary border |
| Stany puste | `.stats-empty` | ikona 48 px, `h4`, opis, CTA |
| Hero | `.stats-hero` | radialny gradient primary, border primary 28% |
| Motyw jasny | `[data-theme="light"] .stats-*` | osobne nadpisania tła/obramowań |

Wspólny mianownik: **tokeny zamiast kolorów na sztywno**, radius 12–14 px,
jeden typ skali, jedna definicja karty, jeden styl tabeli, zawsze stan pusty.

---

## 2. Diagnoza rozjazdu

Konkretne źródła niespójności:

1. **Kolory na sztywno w globalnym CSS** — `style.css`:
   - `th { background: #252526; color: #888 }` (937–942)
   - `th, td { border-bottom: 1px solid #333 }` (930–935)
   - `label { color: #ccc }` (966–972)
   - `input/select/textarea { background: #2d2d2d; border: 1px solid #444; border-radius: 4px }` (978–992)
   - `.table-container { border-radius: 8px }` (916–921)
   - `.test-card { border-radius: 8px; height: 200px }` (694–737)
   - `.library-search-input`, `.view-switcher` — `#252526`, `#444`, `#1e1e1e`, `#333` (1150–1168)
   - `.modal-content { background: #252526; border: 1px solid #444 }` (753–761)
2. **Brak wspólnych tokenów** — są tylko kolory. Brak `--radius-*`, `--space-*`,
   `--shadow-*`, `--focus-ring`. Stąd radiusy 4/6/8/12/14 px w różnych miejscach.
3. **Brak nagłówka strony** — `.stats-header` istnieje tylko w Statystyce.
   Pozostałe widoki startują od `h3` (Historia, Ustawienia, Kreator) albo od razu
   od treści (Biblioteka, Aktualizacje).
4. **161 inline `style="…"` w `index.html`** — głównie Aktualizacje, Historia,
   Ustawienia i Metryczka. To one trzymają stare odstępy i promienie.
5. **`--primary-color` nie istnieje** — `index.html:1047` i `style.css:1808`
   używają `var(--primary-color)`, a token to `--primary`. Pasek postępu
   aktualizacji renderuje się bez tła. **Bug, nie kosmetyka.**
6. **Brak stanów pustych** poza Statystyką — puste tabele/listingi nie mówią,
   co zrobić dalej.

---

## 3. Zasady wykonania

- **Nie zmieniaj nazw klas używanych przez testy**: `.test-card`,
  `.test-card-compact`, `.table-container`, `.stats-*`, wszystkie `id`. Nowe
  klasy dodawaj obok, stare zostają jako aliasy.
- **`docs/app/` to artefakt** — nigdy nie edytuj ręcznie. Po zmianach:
  `npm run build:web`.
- **Jedna zakładka = jeden commit** (albo dwie fazy = dwa commity). Łatwo
  wtedy cofnąć pojedynczy widok.
- **Surgical diff**: nie reformatuj plików, nie ruszaj logiki JS, nie usuwaj
  inline styles z widoków, których nie dotykasz.
- **Każda faza kończy się weryfikacją** (sekcja 6).

---

## 4. Fazy

### Faza 0 — Fundament: tokeny + prymitywy (~2–3 h)

Plik: `style.css` (tylko dopisanie na górze i wydzielenie reguł).

**Krok 0.1 — tokeny w `:root` i `[data-theme="light"]`:**

```css
:root {
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 14px;
    --radius-pill: 999px;

    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;

    --card-bg: var(--glass-bg);
    --card-border: var(--glass-border);
    --shadow-elev: 0 12px 24px -12px rgba(0, 0, 0, 0.45);
    --focus-ring: 0 0 0 3px var(--primary-glow);

    --page-title-size: 20px;
    --section-title-size: 15px;
    --label-size: 11px;
}
```

Motyw jasny: te same nazwy, inne wartości cienia (`0 10px 15px -3px rgba(0,0,0,.1)`).

**Krok 0.2 — prymitywy** (nowa sekcja „WSPÓLNE KOMPONENTY” przed Statystyką):

| Nowa klasa | Źródło (obecnie) | Uwaga |
|---|---|---|
| `.page-header`, `.page-header-icon`, `.page-header-sub` | `.stats-header*` | uogólnienie, `h3` bez zmian |
| `.panel`, `.panel-header`, `.panel-sub` | `.stats-section*` | |
| `.toolbar` | `.stats-controls` | |
| `.field`, `.field-label` | `.stats-field*` | |
| `.segmented`, `.segmented-btn` | `.stats-segmented*` | |
| `.data-table-wrap`, `.data-table` | `.stats-section .table-container`, `.stats-table` | |
| `.empty-state` | `.stats-empty` | |
| `.chip` | `.metric-chip` | `.metric-chip` zostaje aliasem |

**Krok 0.3 — aliasy, żeby Statystyka nie zmieniła wyglądu:**

```css
.page-header, .stats-header { /* … */ }
.panel, .stats-section { /* … */ }
.data-table, .stats-table { /* … */ }
```

Reguły `[data-theme="light"] .stats-section` rozszerz na
`[data-theme="light"] .panel, [data-theme="light"] .stats-section`.

**Krok 0.4 — naprawa `--primary-color`:**
`index.html:1047` → `var(--primary)`. `style.css:1808` → `var(--primary)`.

**Weryfikacja:** `npm run test:run` zielone; Statystyka wygląda identycznie
przed/po (porównaj zrzuty w obu motywach).

---

### Faza 1 — Biblioteka Testów (~3 h, największy efekt)

Pliki: `index.html` (305–387), `src/catalog/testCard.js`,
`src/catalog/catalogView.js`, `style.css` (688–737, 1141–1470).

1. Dodaj `.page-header`: „Biblioteka Testów” + licznik testów w `.page-header-sub`.
   Tytuł i licznik wyprowadź z istniejącego stanu w `catalogView.js` (nie
   dodawaj nowego fetcha).
2. Zamień `.library-toolbar` na `.toolbar` + `.field` (search) + `.segmented`
   (przełącznik widoku grid/list/table/compact). Tryb treningowy zostaje jako
   `.chip`/switch w tym samym pasku.
3. Karty: `.test-card` → radius `--radius-md`, tło `--card-bg`, border
   `--card-border`, hover = `--primary` + `--shadow-elev` (bez `translateY(-4px)`
   — Statystyka nie „skacze”; użyj `translateY(-2px)`).
   Usuń sztywne `height: 200px` na rzecz `min-height`, żeby dłuższe tytuły nie
   ucinały się.
4. `.meta` → `.chip` / muted 12 px, `tabular-nums` dla wersji i dat.
5. Pusty stan: `.empty-state` z ikoną `search_off`, „Brak testów spełniających
   filtr” + przycisk „Wyczyść filtry” (jeśli search niepusty).
6. `.test-card-compact` dopasuj do tych samych tokenów.

**Uwaga:** `tests/unit/library.test.js` sprawdza `.test-card` i
`.test-card-compact` — nie zmieniaj nazw.

---

### Faza 2 — Historia Wyników (~3 h)

Pliki: `index.html` (418–745), `src/history/historyTable.js`,
`src/history/historyFilters.js`, `src/modules/history.js`, `style.css`.

1. `.page-header`: „Historia Wyników” + podtytuł z liczbą wyników.
2. Akcje (CSV, Gość, Chmura) → `.toolbar`; przyciski w jednym rzędzie, na
   mobile zawijają się same (`flex-wrap`), bez inline `style`.
3. Filtry → `.segmented` + `.chip` (zachowaj istniejące `filter-*` w
   `historyFilters.js`, dodaj klasy wizualne).
4. Tabela → `.data-table`: sticky nagłówek, zebra, hover, `tabular-nums` w
   kolumnach liczbowych, radius 10 px. Usuń inline `style` z nagłówków kolumn.
5. Paginacja: `.segmented` zamiast `.btn outline small` + `pagination-info`
   jako `.panel-sub`.
6. Pusty stan: „Brak wyników” + CTA „Wykonaj pierwszy test”.

---

### Faza 3 — Aktualizacje (~2 h)

Pliki: `index.html` (958–1126), `style.css` (`.app-update-container`).

1. Karta aktualizacji → `.panel` + `.panel-header` (ikona `cloud_sync`).
   Usuń inline `background/padding/border-radius/border` (linie 963–969).
2. Status → `.chip` z wariantami (`is-success` / `is-warning` / `is-danger`).
3. Pasek postępu → tokeny (`--primary` po naprawie z Fazy 0), wysokość 6 px,
   `--radius-pill`.
4. Tabela wersji → `.data-table`.
5. Data i wersje → `tabular-nums`.

---

### Faza 4 — Metryczka + Kreator (~3 h)

Pliki: `index.html` (1127–1342), `src/modules/demographics.js`,
`src/modules/demoCreator.js`, `style.css` (`.form-container`, `.form-group`,
`.participants-*`, `.checkbox-group-container`, `.radio-group-container`).

1. `.page-header` dla obu widoków: „Metryczka” i „Kreator metryczek”.
2. `.form-container` → `.panel`; `max-width` zostaje (600/800 px).
3. Pola: jednolity `.field` — etykieta 11 px uppercase, input 9–10 px padding,
   radius `--radius-sm`, focus = `--focus-ring`. Podmień globalne `#2d2d2d`/
   `#444` na `--bg-sidebar`/`--border`.
4. `.form-row` → grid 2 kolumny ≥ 720 px, 1 kolumna poniżej.
5. Kartoteka badanych → `.panel` + karty na `.test-card`-owych tokenach;
   pusty stan z istniejącym tekstem jako `.empty-state`.
6. Kreator: dynamiczne pola (`demoCreator.js:38–56`) dostają `.field`
   zamiast gołego `.form-row`.

**Ryzyko:** `tests/unit/demographics` / `demoCreator` mogą sprawdzać strukturę
DOM. Uruchom testy po każdej zmianie w tych modułach.

---

### Faza 5 — Ustawienia, Co nowego, O programie, Konta lokalne (~2 h)

Pliki: `index.html` (1343–2002+, `about-modal` 2290+), `style.css`,
`src/modules/localAccountsAdmin.js`, `src/modules/whatsNew*.js`.

1. `.page-header` w Ustawieniach i „Co nowego”.
2. `.settings-section` → `.panel`; sekcje w jednej kolumnie z `gap: var(--space-4)`.
3. `theme-option`, switche, radio → wspólne `.chip` / `.segmented` (bez zmiany
   logiki `settings.js`).
4. Modale (`#about-modal`, `#custom-dialog*`, `passwordModal`) → tokeny:
   `--bg-sidebar` zamiast `#252526`, `--border` zamiast `#444`,
   radius `--radius-lg`.
5. Konta lokalne: `.local-account-row` → `.panel` + `.data-table`-owe odstępy;
   pusty stan gdy brak kont.

---

### Faza 6 — Porządki i audyt (~2–3 h)

1. Usuń pozostałe inline `style` z widoków już zmigrowanych (cel: < 40 w
   `index.html`, wszystkie w modułach dynamicznych).
2. Audyt motywu jasnego: każda nowa reguła z kolorem tła musi mieć wariant
   `[data-theme="light"]` albo używać tokenu.
3. `:focus-visible` na wszystkich interaktywnych elementach (`--focus-ring`).
4. Breakpointy: 1200 / 900 / 640 px — header zawija się, tabele scrollują
   poziomo, toolbar przechodzi w kolumnę.
5. `aria-label` / `aria-pressed` dla segmented i przełączników (wzór już jest
   w Statystyce).
6. `npm run build:web`.

---

## 5. Kolejność i czas

| Faza | Zakres | Czas |
|---|---|---|
| 0 | tokeny + prymitywy + bug `--primary-color` | 2–3 h |
| 1 | Biblioteka | 3 h |
| 2 | Historia | 3 h |
| 3 | Aktualizacje | 2 h |
| 4 | Metryczka + Kreator | 3 h |
| 5 | Ustawienia / Co nowego / O programie / Konta | 2 h |
| 6 | porządki + audyt | 2–3 h |

Razem ~17–19 h roboczych. Fazy 1–5 są niezależne po Fazie 0 — można je robić
w dowolnej kolejności.

---

## 6. Weryfikacja (po każdej fazie)

```bash
npm run test:run          # jednostkowe, bez interakcji
npm run test:e2e          # Electron, smoke UI
npm run build:web         # artefakt docs/app
npm start                 # kontrola wzrokowa
```

Kontrola wzrokowa — checklist dla każdego zmienionego widoku:

- [ ] Motyw ciemny i jasny wyglądają spójnie
- [ ] Nagłówek strony ma ikonę, tytuł i podtytuł
- [ ] Karty mają ten sam radius, tło i border co Statystyka
- [ ] Tabela ma sticky nagłówek, zebra i hover
- [ ] Stan pusty istnieje i mówi, co zrobić
- [ ] Fokus klawiatury widoczny na każdym przycisku/polu
- [ ] 375 px szerokości: nic nie wychodzi poza ekran

---

## 7. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Testy oparte na klasach/DOM | Nie zmieniaj nazw; dodawaj klasy obok |
| Regresja Statystyki przy wydzielaniu prymitywów | Aliasy `X, .stats-X` w jednej regule; test wizualny przed/po |
| `docs/app` rozjedzie się ze źródłem | Zawsze `npm run build:web`, nigdy edycja artefaktu |
| Inline styles w JS (`demoCreator.js`, `dialog.js`) | Migruj tylko te, które dotykasz w danej fazie |
| Motyw jasny „ginie” przy nowych tłach | Zakaz kolorów hex w nowych regułach; tylko tokeny |

---

## 8. Poza zakresem

- Zmiany logiki, routingu, zapisu danych.
- Nowe funkcje (np. wykresy w Historii).
- Redesign sidebara i ekranu logowania (są spójne same w sobie).
- Zmiana palety — `--primary` i tokeny kolorów zostają.
