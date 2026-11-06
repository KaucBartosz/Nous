# Plan wdrożenia: zakładka „Statystyka” w programie Nous

**Repozytorium:** `C:\Users\HARDPC\Desktop\Nous`  
**Folder planu:** `C:\Users\HARDPC\Desktop\Nous\Dodanie_statystyki`  
**Data:** 2026-11-05  
**Status:** plan (przed implementacją)  
**Powiązane źródła:** `BBTP/RAPORT_SENDRESULTS.md`, `BBTP/STATYSTYKA.md`, `src/modules/history.js`, `src/results/*`, `src/db/*`

---

## 0. Kontekst i źródła danych

Nous przechowuje wyniki testów w IndexedDB (`results`), z polami m.in.:
- `id`, `timestamp`, `test_id`, `subject_id`, `researcher_uid`, `sync_status`
- `wyniki` = surowy payload testu (`score`, `statystyki`, `wyniki`/`wyniki_szczegolowe`, metryki)

Historia (`modules/history.js`) już:
- filtruje po `researcher_uid`,
- filtruje po teście/badanym/statusie/dacie,
- paginuje i renderuje wiersze.

Zakładka „Statystyka” ma **nie dublować Historii**, tylko dodać **agregację i porównanie** wyników tego samego testu.

---

## 1. Cel i zakres

### 1.1. Cele
1. **Osobisty:** użytkownik porównuje, jak jego wynik zmieniał się w czasie / między wykonaniami danego testu.
2. **Badawczy:** badacz od razu widzi średni wynik z danego testu, z możliwością filtrowania:
   - **Wszyscy** (wszyscy badani w lokalnej bazie bieżącego badacza),
   - **Po ID badanego** (`subject_id`),
   - **Kartoteka** (wybór profilu z Kartoteki Badanych).

### 1.2. Zakres (MVP)
- nowa zakładka w nawigacji: **pod „Historia Wyników”, nad „Aktualizacje”**,
- tryb **Osobisty** i **Badawczy** (przełącznik w widoku),
- wybór testu (wymagany),
- porównanie dwóch wykonań (tabela różnic + delta),
- widok średnich (badawczy),
- metryki numeryczne z czytelnymi etykietami,
- tylko **lokalne** wyniki (bez chmury/gościa),
- dostępna także w wersji web (jak Historia).

### 1.3. Poza zakresem MVP
- wykresy (można dodać później; MVP = tabele),
- import chmury/gościa,
- synchronizacja statystyk do chmury,
- zaawansowana normalizacja schematów testów (BBTP) — tylko etykiety i ekstrakcja numeryczna.

---

## 2. UX / nawigacja

### 2.1. Nawigacja
W `index.html` dodać przycisk między `nav-history` a `nav-updates`:

```html
<button id="nav-statistics" class="nav-item">
  <span class="material-icons">bar_chart</span>
  Statystyka
</button>
```

### 2.2. Widok
Nowy kontener:

```html
<div id="statistics-view" class="hidden">
  <!-- nagłówek, przełącznik trybu, filtry, tabela -->
</div>
```

### 2.3. Polityka powłoki
- **Web:** zakładka widoczna (jak Historia). Nie dodawać do `hiddenNav`.
- **Desktop:** widoczna.
- Nie ukrywać w `toWebShell` (build_web.js) — brak transformacji.

---

## 3. Tryby pracy

### 3.1. Osobisty
- źródło: wyniki bieżącego badacza (`researcher_uid === targetUid`),
- wybór testu,
- lista wykonań (data, badany, wynik) z możliwością zaznaczenia **dwóch** do porównania,
- domyślnie: ostatnie dwa wykonania,
- tabela różnic: metryka / wykonanie A / wykonanie B / różnica (Δ) / zmiana %,
- tabela trendu (wszystkie wykonania dla wybranej metryki).

### 3.2. Badawczy
- źródło: wyniki bieżącego badacza (lokalne),
- wybór testu,
- filtr zakresu:
  1. **Wszyscy**,
  2. **Po ID badanego** (wpisanie `subject_id`),
  3. **Kartoteka** (dropdown profili z `participants`; filtr po `participant_id` lub `display_name`),
- tabela średnich: metryka / liczba wykonań / średnia / min / max,
- opcjonalnie: porównanie dwóch zakresów (np. dwa badanych) — **faza 2**.

---

## 4. Architektura (deep modules)

Zgodnie z zasadami „improve-codebase”: logika domenowa w jednym głębokim module, UI cienka.

### 4.1. Nowe moduły

| Moduł | Rola | Typ |
|-------|------|-----|
| `src/statistics/statisticsQuery.js` | Ekstrakcja metryk, filtrowanie, grupowanie, agregacja, porównanie, etykiety | **deep** (czyste funkcje, testowalne) |
| `src/modules/statistics.js` | Orkiestrator widoku: init, ładowanie danych, zdarzenia, render | cienki |
| `src/statistics/statisticsTable.js` | Render tabel (wykonań, różnic, średnich, trendu) | cienki DOM |
| `src/statistics/statisticsFilters.js` | UI filtrów (test, zakres, badany, kartoteka, metryki) | cienki DOM |

### 4.2. Zasady
- `statisticsQuery.js` jest **jedynym właścicielem** logiki statystycznej (jak `historyQuery.js` dla historii).
- Brak duplikacji logiki filtrowania z `historyQuery.js`; można współdzielić `testIdOf`, `subjectIdOf` z `resultPackage.js`.
- Brak „spaghetti” w `history.js` — statystyka nie modyfikuje historii.
- Każdy plik < 1000 linii; przy przekroczeniu dzielić.

### 4.3. Zależności
- `resultPackage.js` (`testIdOf`, `subjectIdOf`),
- `flattenObject` z `utils.js`,
- `getAllResults`, `getAllParticipants`,
- `getResearcherUid`, `getCurrentUser`.

---

## 5. Model danych i ekstrakcja metryk

### 5.1. Ekstrakcja
Dla wyniku `r`:
1. `testId = testIdOf(r)`
2. `subjectId = subjectIdOf(r)`
3. spłaszcz `r.wyniki` przez `flattenObject` → mapa `klucz → wartość`,
4. odrzuć klucze metadanych (lista `STATS_IGNORE_KEYS`),
5. zachowaj tylko wartości numeryczne (`typeof === 'number' && !isNaN`),
6. zbuduj `metrics: [{ key, label, value }]`.

### 5.2. Lista ignorowanych kluczy
```js
const STATS_IGNORE_KEYS = [
  "testId", "test_id", "subjectId", "subject_id",
  "timestamp", "researcher_uid", "demographics",
  "__hpm_context", "participant", "psychopyVersion", "frameRate",
];
```
(ponowne użycie `WEB_RESULT_IGNORE_KEYS` jako bazy + rozszerzenie.)

### 5.3. Etykiety metryk (czytelne)
Słownik `METRIC_LABELS` (PL) dla znanych kluczy, np.:
- `score` → „Wynik (score)”
- `sredni_czas_reakcji`, `sredni_czas_ms` → „Średni czas reakcji (ms)”
- `czas_reakcji` → „Czas reakcji”
- `poprawne`, `poprawne_reakcje` → „Poprawne”
- `bledne`, `bledne_reakcje` → „Błędne”
- `wszystkie`, `wszystkie_proby`, `wszystkie_kliki` → „Wszystkie próby”
- `skutecznosc`, `skutecznosc_proc`, `accuracy_percent` → „Skuteczność”
- `pominiete`, `pominiete_cele` → „Pominięte”
- `poziom_trudnosci` → „Poziom trudności”
- `max_dlugosc_sekwencji`, `max_sekwencja` → „Maks. długość sekwencji”

Dla nieznanych kluczy: humanizacja (`snake_case` → „Snake case”, `camelCase` → „Camel case”).

### 5.4. Wybór metryk
- UI: checkboxy z czytelnymi etykietami (domyślnie zaznaczone kluczowe: wynik, poprawne, błędne, wszystkie próby, skuteczność, średni czas).
- Wybór zapisywany w `localStorage` (per użytkownik) — opcjonalnie w MVP: stan w pamięci.

### 5.5. Aliasy i normalizacja (na podstawie `RAPORT_SENDRESULTS.md`)
- **testId:** wyniki mogą mieć niespójną wielkość liter (`syg`, `semafor`, `pingpong`, `samochodzik`, `stop`, `bystreOczko`). W statystyce grupować po znormalizowanym kluczu (mapa aliasów → PascalCase), ale zachować oryginał do wyświetlenia.
- **metryki:** warianty nazw tego samego pojęcia (`poprawne`/`poprawne_reakcje`, `bledne`/`bledne_reakcje`, `wszystkie`/`wszystkie_proby`, `skutecznosc`/`skutecznosc_proc`, `sredni_czas_reakcji`/`sredni_czas_ms`) mapować na **jedną etykietę** w UI; nie wymuszamy jednego klucza w danych.
- **score:** w testach jest stringiem → przy ekstrakcji próbować `Number(score)`; jeśli się nie uda, pominąć jako metrykę numeryczną (zostaje widoczny w Historii).
- **brakujące pola:** ustawiać `null` (wyświetlane jako „—”), nie `0`, żeby nie fałszować średnich.
- **brakujące wyniki prób:** PingPong i Samochodzik nie mają `wyniki` — statystyka działa na metrykach top-level, bez wymuszania pól prób.

---

## 6. Agregacje i porównanie (czyste funkcje)

W `statisticsQuery.js`:

### 6.1. Filtrowanie wyników
```js
filterStatisticsResults(results, { testId, subjectIds, researcherUid })
```
- filtr po teście,
- filtr po liście badanych (pusta = wszyscy),
- sort malejąco po `timestamp`.

### 6.2. Porównanie dwóch wykonań
```js
compareRuns(runA, runB, metricKeys)
```
Zwraca tablicę:
```js
[{ key, label, valueA, valueB, delta, deltaPercent }]
```
- `delta = valueB - valueA`,
- `deltaPercent = (delta / valueA) * 100` (gdy `valueA !== 0`),
- brak wartości → `null`.

### 6.3. Średnie
```js
aggregateMetrics(runs, metricKeys)
```
Zwraca:
```js
[{ key, label, count, avg, min, max }]
```
- średnia arytmetyczna wartości numerycznych,
- `min`/`max` tylko gdy `count > 0`.

### 6.4. Trend
```js
trendForMetric(runs, metricKey)
```
Zwraca listę `{ timestamp, subjectId, value }`.

### 6.5. Distinct testy/badani
```js
distinctTestIds(results)
distinctSubjectIds(results, testId)
```

---

## 7. Szczegóły UI

### 7.1. Struktura widoku
1. Nagłówek: „Statystyka”.
2. Przełącznik trybu: **Osobisty / Badawczy**.
3. Filtry wspólne:
   - Test (select),
   - Metryki (checkboxy w rozwijanym panelu).
4. Tryb osobisty:
   - lista wykonań (checkboxy, max 2),
   - tabela różnic,
   - tabela trendu (wybrana metryka).
5. Tryb badawczy:
   - zakres: Wszyscy / Po ID badanego / Kartoteka,
   - input/select badanego,
   - tabela średnich,
   - licznik wykonań.

### 7.2. Etykiety i formatowanie
- daty: `toLocaleString()`,
- liczby: max 2 miejsca po przecinku,
- brak wartości: „—”,
- delta: `+`/`-` z kolorem (CSS klasy, bez inline styles jeśli możliwe).

### 7.3. Pusta lista
Komunikat: „Brak wyników dla wybranego testu/zakresu.”

---

## 8. Integracja z istniejącym kodem

### 8.1. `src/modules/ui.js`
- dodać `navStatistics`, `viewStatistics` do `getElementsLazy()`,
- dodać wpis do `VIEW_CONFIG`:
  ```js
  statistics: { view: "viewStatistics", nav: "navStatistics", callback: "onStatistics" }
  ```

### 8.2. `src/app.js`
- import `initStatisticsView`, `loadStatisticsData`,
- nasłuch `navStatistics`,
- `switchView("statistics", { onStatistics: loadStatisticsData })`,
- init w sekcji subsystems.

### 8.3. `src/modules/statistics.js`
- `initStatisticsView()` — bindowanie zdarzeń,
- `loadStatisticsData()` — pobranie wyników i render.

### 8.4. `src/platform/shell.js`
- brak zmian (zakładka dostępna web).

### 8.5. `index.html`
- nav button + view container (szablon).

### 8.6. `docs/app`
- regeneracja przez `npm run build:web` (nie edytować ręcznie).

---

## 9. Zmiany plików (lista)

### Nowe
- `src/statistics/statisticsQuery.js`
- `src/statistics/statisticsTable.js`
- `src/statistics/statisticsFilters.js`
- `src/modules/statistics.js`
- `tests/unit/statisticsQuery.test.js`

### Zmodyfikowane
- `index.html`
- `src/modules/ui.js`
- `src/app.js`
- `src/modules/utils.js` (tylko jeśli brakuje helpera humanizacji — opcjonalnie)
- `tests/unit/ui.test.js` (dodać elementy `nav-statistics`, `view-statistics` do mocka, jeśli testowane)

### Nie modyfikować
- `src/modules/history.js` (brak zmian — unikanie regresji).

---

## 10. Testy

### 10.1. Unit (Vitest)
W `tests/unit/statisticsQuery.test.js`:
- `filterStatisticsResults` (test + badani),
- `extractMetrics` (tylko numeryczne, ignorowane klucze),
- `compareRuns` (delta, %, brak wartości),
- `aggregateMetrics` (avg/min/max/count),
- `distinctTestIds`, `distinctSubjectIds`,
- etykiety (`metricLabel`).

### 10.2. UI (opcjonalnie)
- `switchView("statistics")` nie rzuca błędów,
- render pustej listy.

### 10.3. Akceptacja
- `npm run test:run` przechodzi,
- nowa zakładka widoczna pod Historią, nad Aktualizacjami,
- porównanie dwóch wykonań działa,
- średnie liczone poprawnie,
- brak regresji w Historii.

---

## 11. Ryzyka i mitigacje

| Ryzyko | Mitigacja |
|--------|-----------|
| Heterogeniczne metryki testów | Ekstrakcja numeryczna + etykiety + wybór metryk |
| Brak `score` liczbowego | Traktować jako tekst/metrikę opcjonalną; brak → „—” |
| Duplikaty wyników (cloud+local) | MVP tylko lokalne |
| Duża liczba wyników | Sortowanie + opcjonalna paginacja w trendzie |
| Regresja Historii | Brak zmian w `history.js`; osobny moduł |
| Plik > 1000 linii | Podział na query/table/filters |

---

## 12. Kolejność wdrożenia

### Faza 1 — szkielet
1. Dodać nav + view w `index.html`.
2. Dodać `ui.js` + `app.js` wiring.
3. Utworzyć puste moduły.

### Faza 2 — logika
4. Zaimplementować `statisticsQuery.js` + testy.
5. Zaimplementować filtry i tabelę.

### Faza 3 — integracja
6. Podpiąć ładowanie danych.
7. Dodać tryb badawczy (kartoteka).

### Faza 4 — jakość
8. Testy, lint, `build:web`.
9. Weryfikacja manualna (desktop + web).

---

## 13. Decyzje (zatwierdzone przez użytkownika)

1. Forma porównania: **tabela różnic** (MVP).
2. Filtr kartoteka: **wybór profilu z Kartoteki Badanych**.
3. Dostępność web: **tak (jak Historia)**.
4. Metryki: **wszystkie numeryczne, z czytelnymi etykietami i wyborem**.
5. Źródło danych: **tylko lokalne**.
6. Zakładka: **pod Historią, nad Aktualizacjami**.

---

**Koniec planu.**

---

## 14. Status realizacji

### Faza 1 — szkielet — ✅
Nav + widok `#statistics-view` w `index.html`, wpisy w `ui.js` / `app.js`.

### Faza 2 — logika — ✅
`statisticsQuery.js` (metryki, aliasy testów, porównania, agregacje, trend)
oraz testy `tests/unit/statisticsQuery.test.js`.

### Faza 3 — integracja — ✅
Ładowanie danych w `statistics.js`, tryb osobisty i badawczy
(Wszyscy / Po ID badanego / Kartoteka).

### Faza 4 — jakość — ✅ (etap 2: UX/CSS)
- Weryfikacja manualna potwierdzona przez użytkownika (etap 1).
- Dopracowanie wizualne: nagłówek z segmentowanym przełącznikiem trybu,
  kafelki KPI, sekcje z ikonami, chipy metryk, pigułki delt,
  mini-słupki trendu, stan pusty, motyw jasny/ciemny, responsywność,
  style fokusu i pasek przewijania tabel.
- `style.css`: sekcja `--- STATYSTYKA ---` (dopisywana na końcu, bez zmian istniejących reguł).
- Build: `node build_web.js`; testy: 34 pliki / 482 testy — wszystkie przechodzą.

Pozostało (opcjonalnie): testy e2e Playwright dla zakładki „Statystyka”.
