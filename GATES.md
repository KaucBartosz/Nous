# GATES — poprawki UI/UX (etap P0 → P1)

Artefakt kontrolny etapów. Każdy etap ma bramkę testów jednostkowych i E2E.

## G1 — P0: testy jednostkowe
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 43 pliki / 547 testów (17:56, 4.15s)

## G2 — P0: testy E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 40/40 (1.3m)

## G3 — P1: testy jednostkowe
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 44 pliki / 552 testów (18:12, 3.96s)

## G4 — P1: testy E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 40/40 (1.3m); pierwsze podejście 2 failed po zmianie dialogu na toast,
test zaktualizowany do nowego zachowania i ponownie 40/40.

## G5 — Etap A (P2 widoczne): testy jednostkowe
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 45 pliki / 557 testów

## G6 — Etap A (P2 widoczne): testy E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 40/40. Podejścia 1-2 miały 1-2 flake w Guest Mode: późne
onAuthStateChanged(null) cofało otwarty panel logowania (showLoginScreen).
Naprawione w src/modules/ui.js — panel nie jest już resetowany, gdy jest
już widoczny. Ponownie 40/40.

## G7 — Etap B (semantyka): testy jednostkowe
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 46 pliki / 565 testów

## G8 — Etap B (semantyka): testy E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 40/40 (1.2m)

## Weryfikacja końcowa
- Po drobnych poprawkach (focusowalna ikona info, aria-level kart testów)
  ponownie: jednostkowe 46/565 PASS, E2E 40/40 PASS.
- build_web.js: transformacja login-screen zmieniona na regexową (sztywny
  fragment przestał pasować po dodaniu role="main") — build działa.
- Lighthouse na świeżym docs/app: accessibility 1.00, bez failure'ów a11y.

## G9 — publiczny odczyt kolekcji tests (firestore.rules)
WYNIK: jednostkowe 46/565 PASS, E2E 40/40 PASS.
TESTY REGUŁ (emulator, JDK 21 + JAVA_HOME): PASS — 13/13.
  Uwaga: pakiet @firebase/rules-unit-testing był brakujący w node_modules
  (jest w package-lock) — doinstalowany ręcznie z tarballa npm; `npm ci`
  zainstaluje go normalnie.
Wymagane wdrożenie: `firebase deploy --only firestore:rules` (CLI niezalogowany).

## G10 — Poprawki logowania Online (3, 4, 5, 6-UI, 8, 10): testy jednostkowe
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 46 plików / 582 testów (21:45, 4.37s). Początkowo 6 failed w nowych
testach online: callback onAuthStateChanged rejestruje się asynchronicznie
(dynamiczny import Firebase) — dodano vi.waitFor w beforeEach.

## G11 — Poprawki logowania Online: build Web (docs/app)
CHECK: npm run build:web
EXPECT: Gotowe
WYNIK: PASS — docs/app 75.70 MB, 64 pliki testów zsynchronizowane z BBTP.

## G12 — Panel admina (#7): statyczna bramka uprawnień
CHECK: node tests/checks/admin-panel-guard.js
EXPECT: ADMIN_GUARD_OK
WYNIK: PASS — ADMIN_GUARD_OK (getDoc/status ADMIN/guard zapisu/signOut;
brak zapisu statusów użytkowników).

## G13 — Testy online-flow na koncie PENDING (#9): E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 42/42 (1.4m), w tym 2 testy online na prawdziwym koncie PENDING.
Dane logowania zapisane lokalnie w tests/e2e/online-account.local.json
(gitignore'owany; alternatywa: zmienne NOUS_ONLINE_EMAIL/PASSWORD).
Testy online: badge "Oczekujący", brak suwaka sync, ponowne logowanie
po wylogowaniu. Pelna bramka domknieta.

## G14 — Usunięcie niepotrzebnego komunikatu PENDING z dashboardu
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 46 plików / 581 testów (22:01, 5.20s). Usunięto jeden test UI
banera; reszta bez zmian.

## G15 — Usunięcie komunikatu PENDING: E2E
CHECK: npm run test:e2e
EXPECT: 42 passed
WYNIK: PASS — 42/42 (1.4m). Pierwsze podejście 41/42: flake w
Guest Mode "can log out" (test przechodzi w pojedynkę). Ponownie 42/42.
Test online sprawdza badge i brak suwaka sync — bez banera.

## G16 — Wariant A: bramka rejestracji (wyścig signUp / saveUserDoc)
CHECK: npm run test:run
EXPECT: Test Files
WYNIK: PASS — 46 plików / 582 testów (22:17, 6.24s). Nowy test sprawdza
kolejność wywołań: getDoc po setDoc, oraz brak komunikatu accountMissing.
saveUserDoc przyjmuje options i wołany jest z { merge: true }.

## G17 — Wariant A: E2E i build Web
CHECK: npm run test:e2e
EXPECT: 42 passed
WYNIK: PASS — 42/42 (1.6m), w tym 2 testy na realnym koncie PENDING.
Równolegle `npm run build:web`: PASS (docs/app odświeżony).
