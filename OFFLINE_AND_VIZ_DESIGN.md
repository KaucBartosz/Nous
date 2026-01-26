# Projekt Architektury: Offline Sync & Rich Visualization

## 1. Przechowywanie Lokalne (Offline Sync)

### Cel
Zapewnienie pełnej funkcjonalności "Historii" i bezpieczeństwa danych bez dostępu do Internetu. Obecnie wyniki offline "giną" w plikach JSON na dysku i nie są widoczne w aplikacji.

### Rozwiązanie Techniczne
Zastosujemy architekturę **Local-First** z wykorzystaniem **IndexedDB**.

#### Dlaczego IndexedDB, a nie LocalStorage?
*   **Pojemność:** LocalStorage ma limit ok. 5MB. Wyniki testów (szczególnie z pełnymi logami prób) mogą to szybko zapełnić. IndexedDB jest limitowane tylko miejscem na dysku.
*   **Struktura:** IndexedDB to baza obiektowa, idealna do przechowywania JSON-ów.
*   **Wydajność:** Działa asynchronicznie, nie blokuje interfejsu (UI) jak LocalStorage.

### Przepływ Danych (Data Flow)
1.  **Zapis:** Po zakończeniu testu, wynik jest zapisywany w IndexedDB w tabeli `results` z flagą `syncStatus: 'PENDING'`.
2.  **Widok Historii:** Aplikacja wczytuje dane **wyłącznie** z IndexedDB. Dzięki temu Historia działa identycznie online i offline.
3.  **Synchronizacja (Sync Manager):**
    *   W tle działa moduł `SyncService`.
    *   Nasłuchuje zdarzenia `navigator.onLine` oraz uruchamia się przy starcie aplikacji.
    *   Wykrywa rekordy z `syncStatus: 'PENDING'`.
    *   Wysyła je do Firebase Firestore.
    *   Po sukcesie zmienia status na `SYNCED` i aktualizuje ID dokumentu chmurowego.

### Struktura Rekordu w IndexedDB
```json
{
  "id": "uuid-v4...",      // Lokalny unikalny ID
  "testId": "reaction-time",
  "timestamp": "2026-01-26T12:00:00Z",
  "data": { ... },         // Pełny wynik
  "demographics": { ... }, // Metryczka
  "syncStatus": "PENDING", // PENDING, SYNCED, ERROR
  "firestoreId": null      // ID w chmurze po wysłaniu
}
```

---

## 2. Wizualizacja Wyników (Rich History)

### Cel
Zamiana surowej tabeli na narzędzie analityczne, pozwalające badaczowi szybko ocenić postępy pacjenta lub jakość danych.

### Rozwiązanie Techniczne
Biblioteka **Chart.js**. Jest lekka, popularna i łatwa w integracji z Vanilla JS.

### Proponowane Widoki

#### A. Wykres Trendu (W Widoku Historii)
Jeśli badacz filtruje historię po konkretnym ID pacjenta, nad tabelą pojawi się wykres liniowy:
*   **Oś X:** Data badania.
*   **Oś Y:** Główny wynik (np. Średni Czas Reakcji).
*   **Cel:** Szybka ocena czy pacjent robi postępy (np. szybszy czas reakcji po terapii).

#### B. Szczegółowa Analiza Próby (Modal)
Po kliknięciu w konkretny wiersz w tabeli historii, otworzy się modal z detalami:
1.  **Metryczka:** Pełne dane pacjenta.
2.  **Histogram Rozkładu:** Wykres słupkowy pokazujący rozkład czasów reakcji w danej sesji.
    *   Pozwala wykryć anomalie (np. pacjent zgadywał i miał czasy <100ms, lub zasypiał i miał >2000ms).
3.  **Heatmapa (Opcjonalnie):** Jeśli test dotyczy koordynacji ruchowej (np. klikanie w punkty), mapa gdzie klikał użytkownik.

---

## Plan Wdrożenia (Sugerowany)

1.  **Faza 1: Offline Database (Fundament)**
    *   Instalacja `idb` (mała biblioteka ułatwiająca pracę z IndexedDB).
    *   Implementacja zapisu wyników do IndexedDB.
    *   Przepisanie `src/modules/history.js` aby czytało z IndexedDB.
    
2.  **Faza 2: Sync Mechanism**
    *   Implementacja wysyłania danych z IndexedDB do Firebase.
    *   Wskaźniki stanu synchronizacji w tabeli (np. ikonka chmurki: szara = lokalnie, zielona = w chmurze).

3.  **Faza 3: Wykresy**
    *   Dodanie Chart.js.
    *   Implementacja wykresu trendu.

Czy przechodzimy do Fazy 1?
