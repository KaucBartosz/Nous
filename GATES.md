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
