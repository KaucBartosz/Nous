# Następne kroki po C1–C5 (handoff do nowej konwersacji)

Stan na dziś: C1–C5 zamknięte i zacommitowane. Testy: **280/280 zielone** (14 plików).
Drobiazgi (pkt 2) zrobione: reguły sesji w `sync/history`, `inject-adapter.js` zweryfikowany (zostaje —
kontrakt bundli PsychoJS `window.electronTest.sendResults` niezmieniony przez C1), `main.js` CSV
**celowo nietknięty** (format widoczny dla użytkownika — tabela różnic poniżej, decyzja do podjęcia).

Raporty z C1–C5: `%TEMP%\change-report-C1-*.html`, `%TEMP%\nous-src-przeglad-plikow.html`,
`%TEMP%\architecture-review-*.html`. Decyzje: `docs/adr/0001–0005` (lokalnie, gitignore).

---

## 3. Rozbicie rendererów biblioteki (średnie) — ostatni duży klon

**Co:** `src/modules/library.js` (dziś ~740 linii) zawiera 4 renderery tego samego:
`renderGridView / renderListView / renderTableView / renderCompactView` (linie ~380–750).
Każdy od nowa buduje: ikonę statusu (`statusIcon` z klasą/kolorem/tytułem), tytuł, opis, wersję,
przycisk startu, tagi (`createTagBtn`). Różni się tylko kontener
(`div` / element listy / wiersz tabeli / kompaktowa karta).

**Dlaczego:** to ostatni duplikat typu „kopiuj-wklej-popraw” w kodzie. Poprawka wyglądu karty
(np. nowy przycisk) dziś wymaga 4 identycznych edycji — łatwo o rozjazd (już raz był:
style progressbara różniły się między widokami).

**Jak (propozycja):**
1. Jeden `renderCard(test, layout)` + `getTestStatus(t)` już istnieje (deskryptory
   ikona/przycisk/tekst) — wydzielić `cardParts(t)` zwracające gotowe elementy DOM,
   a 4 renderery sprowadzić do układania tych klocków w kontenerach.
2. Dispatcher `renderTests` zostaje (switch widoku), znika ~250 linii powtórzeń.
3. Testy: `library.test.js` istnieje — dopisać asercje, że każdy widok woła te same
   `cardParts` (liczba przycisków = liczba testów w każdym widoku).

**Ryzyka:** czysty widok/DOM, zero logiki biznesowej — ryzyko niskie. Uwaga na style
inline progressbara (lekko różne w grid vs reszta — ujednolicić świadomie).

---

## 4. `main.js` (duże) — „C6”, na spokojnie

**Co:** `main.js` (921 linii, proces główny Electrona) miesza 6 tematów:
lifecycle okna (`createWindow`), kolejka pobierania (`download-and-run` + ZipSlip +
allowlista URL), klucze `safeStorage`, autoUpdater (7 handlerów), szablony
(export/import), `open-external`, `download-bulk-zip` (ZIP w RAM przez `adm-zip`).

**Dlaczego:** każda zmiana w mainkogrozi wywróceniem całej aplikacji (to proces macierzysty),
a dziś trzeba czytać 900 linii, żeby znaleźć 1 handler. Blokuje też testy jednostkowe
main (import ciągnie Electrona).

**Jak (propozycja, etapami):**
1. `main/downloads.js` — kolejka + walidacja URL + ZipSlip + wypakowanie.
2. `main/keyStore.js` — `master_key.enc` / `e2e_key.enc` nad `safeStorage`.
3. `main/testRunner.js` — `openTestWindow`, `test-finished/close`, forward wyników.
4. `main/templates.js`, `main/updater.js`, `main/bulkExport.js` — reszta handlerów 1:1.
5. `main.js` zostaje cienki: `app.whenReady` + rejestracja handlerów.
6. Testy nowych modułów z mockami `electron` (osobny config vitest z `environment: node`
   + `vi.mock('electron')` — rendererowe testy happy-dom nie tykane).

**Ryzyka:** WYSOKIE — proces główny, IPC, ścieżki `userData` per-OS (darwin/linux/win),
`AdmZip` w RAM przy dużych paczkach (rozważyć strumieniowanie). Każdą przeprowadzkę
o 1 handler + ręczny test desktopowy (pobierz test, zrób ZIP, zaktualizuj apkę).
`downloadBulkZip` format CSV — patrz decyzja 2b poniżej, rozstrzygnąć PRZED C6.

### Decyzja 2b (nierozstrzygnięta): format CSV w ZIP-ie z main.js

| Aspekt | `main.js` ZIP dziś | Eksporter `resultExporter.js` |
|---|---|---|
| Nagłówki metryczki | `Metryczka_${k}` | `Metryczka - ${k}` |
| Nagłówki wyników | `Wynik_${k}` | `Wynik - ${k}` |
| Badacz | `Badacz ID` | `Badacz UID` |
| Domyślny badany | `unknown` | `-` |
| Zagnieżdżone obiekty w metryczce | pomijane | spłaszczane |
| Quoting `"` bez `;` | cytuje | nie cytuje (ale podwaja w środku) |

Ujednolicenie = **zmiana plików, które użytkownicy już mają** (kolumny Excela się
przesuną). Opcje: (a) zostawić na zawsze + komentarz w obu miejscach, (b) wyrównać
main do eksportera + wpis w changelog + wersja minor, (c) flaga formatu. Rekomendacja
autorów: (b) przy najbliższej wersji minor, bo spójność wygrywa — ALE to decyzja
produktowa, nie techniczna.

---

## 5. Testy obszarów bez pokrycia (wedle ochoty)

Bez testów jednostkowych nadal: `sync`, `updates`, `demographics`, `tags`,
`demoCreator`, `localAccountsAdmin`, `participants`, `appUpdater`, `history`,
`recaptcha` (zaślepka — nie warto). Priorytet:

1. **`sync.js` (najwyższe ryzyko):** polityka offline/LOCAL/GUEST + oznaczanie
   `markAsSynced` po `addDoc`. Fejki: Firestore `addDoc`, `getPendingResults`,
   `getUserStatus`. Scenariusze: offline, konto lokalne, częściowy błąd (1 rekord pada).
2. **`updates.js`:** `loadUpdatesData` na `loadCatalog` z fejkami (pusty rejestr,
   przestarzałe, badge). Bez tego regresja badge'a wyjdzie dopiero na klikaniu.
3. **`tags.js`:** czysta logika (parser AND>OR, unikalność, limity) — tanie i szybkie,
   idealny pierwszy cel na rozgrzewkę nowej konwersacji.
4. **`historyQuery` już pokryty** (C3) — filtry historii bezpieczne.

---

## 6. Weryfikacja E2E (Playwright)

**Co:** `npm run test:e2e` ani razu nie odpalony w sesji C1–C5 (tylko `vitest`).
`tests/e2e/electron.spec.js` istnieje; reszta speców usunięta w commicie `61d06b4`.

**Dlaczego warto:** C1–C5 ruszały boot aplikacji (`app.js`), obsługę wyników
(`results.js`) i bibliotekę — czyli dokładnie ścieżki startowe, które E2E sprawdza.

**Jak:** na maszynie z displayem (Windows OK): `npx playwright install` (jeśli brak
przeglądarek) → `npm run test:e2e`. Jeśli flaky bez displaya: `xvfb` na Linux
albo odpuścić i polegać na 280 unitów. Po zielonym E2E dopisać scenariusze:
start testu treningowego, eksport CSV z historii, przełączenie offline.

---

## Kontekst startowy dla nowej konwersacji (wkleić)

> Projekt Nous (Electron, `C:\Users\Bartosz\Desktop\Nous`), po refaktoringu C1–C5
> (zacommotowane). Nowe moduły: `src/platform/`, `src/db/` (+ shim `modules/database.js`),
> `src/results/`, `src/session/`, `src/catalog/`, `src/notify/`. Decyzje: `docs/adr/0001–0005`
> (lokalnie). Słownik domenowy: `CONTEXT.md` (lokalnie). Testy: `npm run test:run`
> (280 zielonych). Zakres bez zmian: pomijamy `docs/`, `temp_bbtp/`. Szczegóły zadań:
> ten plik. Zacznij od wybranego punktu i potwierdź plan przed implementacją.
