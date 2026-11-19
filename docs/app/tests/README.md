# Testy w wersji webowej

Katalog `docs/app/tests/` jest **artefaktem budowy**. Źródłem prawdy są `src/`, `web/` oraz zewnętrzny katalog testów BBTP. Nie edytuj wygenerowanych plików ręcznie.

## Jak zbudować

```bash
npm run build:web
```

`build_web.js` kopiuje `src/` do `docs/app/src/`, przygotowuje powłokę webową i synchronizuje foldery testów z BBTP. Katalog BBTP jest wybierany kolejno:

1. zmienna `BBTP_DIR`,
2. katalog `BBTP` obok repozytorium Nous,
3. brak — testy nie są synchronizowane (w konsoli pojawia się ostrzeżenie).

Jeśli `BBTP_DIR` nie jest ustawiony, build nadal działa, ale biblioteka testów może być pusta.

## Mostek WebAdapter

Testy BBTP oczekują `window.electronTest.sendResults(data)`. W wersji webowej zapewnia go `web/web-adapter.js`, który:

- nasłuchuje wyników testu,
- przekazuje je do okna głównego przez `postMessage` (gdy test został otwarty z aplikacji),
- zapisuje wynik do IndexedDB przez `src/platform/web.js`,
- przy uruchomieniu bez okna rodzica generuje plik CSV do pobrania.

`build_web.js` wstrzykuje adapter do `index.html` każdego testu oraz dopisuje `test-lang.js` (wybór języka testu z `localStorage`).

## Struktura folderu testu

Każdy test to katalog z `index.html`, plikiem eksperymentu `.js`, modułami i18n i `meta.json` (nazwa oraz opis PL/EN). Nie usuwaj `index.html`, `lib/` ani `meta.json` — bez nich test nie startuje albo biblioteka nie ma poprawnego opisu.

## Weryfikacja

```bash
npm run verify
```

Komenda uruchamia testy jednostkowe, statyczną bramkę panelu admina oraz testy semantyki reguł Firestore na emulatorze (wymagany JDK 21). Testy E2E uruchamiasz osobno:

```bash
npm run test:e2e
```

Domyślnie używają hermetycznego zbioru testów z `tests/fixtures/tests-library/`. Prawdziwą bibliotekę BBTP można podać przez `NOUS_E2E_TESTS_DIR`.
