# Propozycja Rozwoju PsychoLauncher (Nous)

## Status Obecny
Aplikacja jest funkcjonalnym MVP z solidnymi podstawami (Electron, Firebase, ADM-Zip). Spełnia główne założenia, ale brakuje jej głębi w obsłudze trybu offline (poza samym uruchomieniem testu) oraz wyrafinowania w UI/UX.

Jako Senior Software Architect rekomenduję wdrożenie następujących usprawnień, podzielonych na priorytety.

---

## 1. Prawdziwe "Offline-First" (Priorytet: WYSOKI)
**Problem:** Obecnie "Historia" działa tylko online (pobiera dane z Firestore). Wyniki zrobione offline można tylko zapisać do pliku – nie trafiają one automatycznie do historii aplikacji, ani nie synchronizują się po odzyskaniu połączenia.

**Rozwiązanie: Lokalna Baza Danych (IndexedDB / LocalStorage Wrapper)**
*   **Wdrożenie:** Użycie lekkiej nakładki (np. `idb` dla IndexedDB) do zapisu wszystkich wyników lokalnie.
*   **Mechanizm:**
    1.  Po zakończeniu testu wynik **zawsze** trafia do lokalnej bazy.
    2.  Jeśli jest internet: Launchery wysyła kopię do Firestore.
    3.  Jeśli brak internetu: Oznacza rekord jako `need_sync`.
    4.  **Sync Manager:** Serwis w tle nasłuchujący zdarzenia `online`, który wysyła zaległe wyniki.
*   **Zysk:** Badacz ma dostęp do pełnej historii (także wyników innych badaczy, jeśli zostały wcześniej zcache'owane) bez internetu.

## 2. Bezpieczeństwo i Integralność Danych (Priorytet: WYSOKI)
**Problem:**
1.  Klucz HMAC jest zaszyty w kodzie (`Inzynierka_Secret_Key_2026`).
2.  Pobierane pliki ZIP nie są weryfikowane (brak sumy kontrolnej).

**Rozwiązanie:**
*   **Integrity Check:** Dodanie pola `sha256` do kolekcji `tests` w Firebase. `main.js` po pobraniu pliku obliczy hash i porówna go przed rozpakowaniem. To zapobiegnie uruchomieniu uszkodzonych lub podmienionych plików.
*   **Bezpieczniejszy Magazyn:** Przeniesienie sekretów do `safeStorage` (Electron API) lub użycie zmiennych środowiskowych podczas budowania aplikacji, aby nie były widoczne w repozytorium (choć w aplikacji klienckiej pełne ukrycie jest niemożliwe, można utrudnić dostęp).

## 3. UX: Feedback podczas pobierania (Priorytet: ŚREDNI)
**Problem:** Użytkownik widzi tylko komunikat "Pobieranie...", nie wiedząc, czy pobiera się 5% czy 95%. Przy słabym internecie i dużych testach to frustrujące.

**Rozwiązanie:**
*   Implementacja streamowania postępu w `main.js` (nasłuchiwanie zdarzenia `data` w `https.get`).
*   Wysyłanie procentowego postępu przez IPC do `app.js` i wyświetlenie paska postępu (Progress Bar) na karcie testu.

## 4. Refaktoryzacja Kod (Priorytet: ŚREDNI)
**Problem:** Plik `src/app.js` ma ponad 500 linii i robi wszystko (Auth, UI, Logic).

**Rozwiązanie:** Modularność (ES Modules).
*   `src/modules/auth.js` - obsługa Firebase Auth.
*   `src/modules/ui.js` - manipulatory DOM.
*   `src/modules/sync.js` - nowa logika synchronizacji.
*   `src/modules/renderer.js` - główny plik spinający.
To ułatwi testowanie i dalszy rozwój.

## 5. Rich Visualization (Priorytet: NISKI/BONUS)
**Problem:** Tabela historii jest surowa.
**Rozwiązanie:** Dodanie `Chart.js` do wyświetlania wykresu postępów (np. średni czas reakcji w czasie) dla danego pacjenta/badacza.

---

## Rekomendowany Plan Działania
1.  **Refaktoryzacja**: Podział `app.js` na moduły (aby robić porządek przed dodaniem nowej logiki).
2.  **Mechanizm Sync (Offline)**: To kluczowa wartość dodana.
3.  **Pasek Postępu**: Szybkie zwycięstwo UX (Quick Win).

Czekam na decyzję, od czego zaczynamy.
