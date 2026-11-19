# GATES — release 1.5.2

Artefakt kontrolny wydania. Bramki poniżej dotyczą partii zmian
„Zabezpiecz logowanie E2E i ujednolic testy" (commit e64d143).

## G19 — Jednostkowe + admin guard + reguły Firestore
CHECK: npm run verify
EXPECT: Test Files / ADMIN_GUARD_OK / testów
WYNIK: PASS — jednostkowe 47 plików / 598 testów, ADMIN_GUARD_OK,
reguły na emulatorze 14/14. Wyjście komendy: 0.

## G20 — Build Web (docs/app)
CHECK: npm run build:web
EXPECT: Gotowe
WYNIK: PASS — docs/app 75.72 MB, 63 pliki testów zsynchronizowane z BBTP.
Working tree po buildzie czysty (artefakt odtwarzalny).

## G21 — E2E
CHECK: npm run test:e2e
EXPECT: passed
WYNIK: PASS — 43/43 (1.6m), w tym 2 testy online na realnym koncie PENDING.

## Zakres wydania
- fail-closed E2E: błąd odczytu klucza przerywa start aplikacji,
  sesja czyszczona przez endSession();
- jedna reguła lokalizacji testów BBTP w tools/tests-library.js;
- workflow CI .github/workflows/verify.yml;
- etykiety aria i synchronizacja docs/app.

## Wdrożenie (nie wykonane w ramach przygotowania)
- `firebase deploy --only firestore:rules` — CLI niezalogowany.
- Push master i tag v1.5.2 / release electron-builder — wymagają zgody.
