# Raport: pola `score` i `statystyki` w `sendResults` testów JS (BBTP)

**Cel:** ujednolicenie wysyłania wyników w celu stworzenia funkcji porównywania wyników.
**Zakres:** 13 testów JS w repozytorium BBTP (pliki `*.js` z wywołaniem `window.electronTest.sendResults`).
**Data:** 2026-11-05

---

## 1. Podsumowanie (czy mają `score` i `statystyki`)

Wszystkie 13 testów wysyła oba pola, ale **zawsze w wariancie `score` (małe litery) i `statystyki` (małe litery)**.
Żaden test nie używa wariantów `Score` / `Statystyki` (PascalCase). Żaden test nie pomija obu pól.

| # | Test (plik) | testId (wysyłany) | `score` | `statystyki` | Pole z danymi prób (`wyniki*`) | `sredni_czas_reakcji` (top) |
|---|-------------|-------------------|:-------:|:------------:|-------------------------------|:--------------------------:|
| 1 | GoNoGo/GoNoGo.js | `GoNoGo` | ✅ | ✅ | `wyniki` | ✅ |
| 2 | GoNoGoBiegacze/GoNoGoBiegacze.js | `GoNoGoCyfry` | ✅ | ✅ | `wyniki` | ✅ |
| 3 | NWstecz/nwstecz.js | `NWstecz` | ✅ | ✅ | `wyniki` | ✅ |
| 4 | Stop/stop.js | `Stop` | ✅ | ✅ | `wyniki` | ✅ |
| 5 | Sygnalizacja/syg.js | `Sygnalizacja` (lub `syg`) | ✅ | ✅ | `wyniki` | ✅ (+ `czas_reakcji`) |
| 6 | Semafor/semafor.js | `semafor` (lub `Semafor`) | ✅ | ✅ | `wyniki` | ✅ |
| 7 | ZlapSygnal/ZlapSygnal.js | `ZlapSygnal` | ✅ | ✅ | `wyniki` | ✅ |
| 8 | BystreOczko/bystreOczko.js | `BystreOczko` | ✅ | ✅ | `wyniki` | ✅ |
| 9 | Corsi/corsi.js | `Corsi` | ✅ | ✅ | `wyniki_szczegolowe` | ✅ |
| 10 | Stroop/stroop.js | `Stroop` | ✅ | ✅ | `wyniki` | ✅ |
| 11 | FabrykaFigur/FabrykaFigur.js | `FabrykaFigur` | ✅ | ✅ | `wyniki_szczegolowe` | ❌ (czas wykonania zadania) |
| 12 | PingPong/pong.js | `pingpong` | ✅ | ✅ | ❌ (brak danych prób) | ❌ |
| 13 | Samochodzik/samochodzik.js | `samochodzik` | ✅ | ✅ | ❌ (brak danych prób) | ❌ (`czas_pokonania_trasy_sek`) |

**Wniosek 1:** pod względem obecności `score` + `statystyki` — **wszystkie 13 mają oba**; brak testów bez tych pól.

**Wniosek 2:** braki innych, oczekiwanych pól (dla funkcji porównywania):
- `wyniki`/`wyniki_szczegolowe` brak w: **PingPong**, **Samochodzik**.
- `sredni_czas_reakcji` brak w: **FabrykaFigur**, **PingPong**, **Samochodzik** (tam mierzony jest czas wykonania zadania/przejazdu).
- `pominiete` (brakujące pola wg AGENTS.md pkt 5) obecne tylko w: **FabrykaFigur** (`pominiete_cele`). W pozostałych brak jednolitego pola `pominiete`.

---

## 2. Które nazwy się powielają

### 2.1. Pola top-level powtarzające się (wspólne dla wielu testów)

| Nazwa pola | Liczba testów | Uwagi |
|------------|:-------------:|-------|
| `testId` | 13/13 | Wszystkie |
| `subjectId` | 13/13 | Wszystkie |
| `timestamp` | 13/13 | Wszystkie |
| `score` | 13/13 | Wszystkie (zawsze tekst) |
| `statystyki` | 13/13 | Wszystkie (zawsze obiekt) |
| `ilosc_poprawnych_nacisniec` | 12/13 | Brak w: PingPong? (jest, ale 0/błędne) — faktycznie PingPong ma. Brak tylko w Samochodzik? Samochodzik ma. Wszystkie mają. |
| `ilosc_blednych_nacisniec` | 13/13 | Wszystkie |
| `ogolna_ilosc_nacisniec` | 13/13 | Wszystkie |
| `sredni_czas_reakcji` | 10/13 | Brak w: FabrykaFigur, PingPong, Samochodzik |
| `wyniki` / `wyniki_szczegolowe` | 11/13 | Brak w: PingPong, Samochodzik |
| `poziom_trudnosci` | 6/13 | GoNoGo, NWstecz, Stroop, FabrykaFigur, Corsi (w top) — różne miejsca |
| `session` | 2/13 | GoNoGoBiegacze, Samochodzik |
| `czas_reakcji` | 1/13 | Sygnalizacja (duplikat `sredni_czas_reakcji`) |

> Uwaga: `ilosc_poprawnych_nacisniec` faktycznie występuje we wszystkich 13 (łącznie z PingPong i Samochodzik), więc jest de facto uniwersalne.

### 2.2. Duplikaty nazw w ramach `statystyki` (różne warianty tego samego pojęcia)

| Pojęcie | Warianty nazw używane | Testy |
|---------|----------------------|-------|
| Poprawne | `poprawne`, `poprawne_reakcje`, `poprawneTrafienia` (w stat: `poprawne`) | GoNoGo, NWstecz, Stop (`poprawne_reakcje`), Sygnalizacja (`poprawne`), Semafor (`poprawne`), ZlapSygnal (`poprawne_reakcje`), BystreOczko (`poprawne_reakcje`), Corsi (`poprawne`), Stroop (`poprawne_reakcje`), FabrykaFigur (`poprawne`) |
| Błędne | `bledne`, `bledne_reakcje`, `bledne_lacznie`, `bledne_klikniecia` | NWstecz (`bledne`), Stop (`bledne_reakcje`), Sygnalizacja (brak bezpośrednio), Semafor (`bledne_lacznie`, `bledne_klikniecia`), ZlapSygnal (`bledne_reakcje`), BystreOczko (`bledne_reakcje`), Corsi (`bledne`), Stroop (`bledne_reakcje`), FabrykaFigur (`bledne`) |
| Wszystkie próby | `wszystkie`, `wszystkie_proby`, `wszystkie_kliki`, `proby`, `wszystkie_próby` | GoNoGo (`wszystkie`), Stop (`wszystkie_proby`), Sygnalizacja (`wszystkie_proby`), Semafor (`proby`, `wszystkie_kliki`), ZlapSygnal (`wszystkie_proby`), BystreOczko (`wszystkie_proby`), Corsi (`wszystkie_proby`), Stroop (`wszystkie_proby`), FabrykaFigur (`wszystkie_kliki`, `obiekty_do_klikniecia`) |
| Skuteczność | `skutecznosc`, `skutecznosc_proc`, `accuracy_percent`, `fa_rate_percent`, `skutecznosc_klikniec`, `skutecznosc_wykrywania` | Stop (`skutecznosc`), Sygnalizacja (`skutecznosc`), Semafor (`skutecznosc_proc`), ZlapSygnal (`skutecznosc`), BystreOczko (`skutecznosc`), Corsi (`skutecznosc`), Stroop (`skutecznosc`), FabrykaFigur (`skutecznosc_klikniec`, `skutecznosc_wykrywania`), GoNoGoBiegacze (`accuracy_percent`, `fa_rate_percent`) |
| Średni czas (ms) | `sredni_czas_ms`, `avg_hit_rt_ms`, `avg_fa_rt_ms`, `czas_ms` | Sygnalizacja, ZlapSygnal, BystreOczko, Stroop, Corsi (`sredni_czas_ms`), GoNoGoBiegacze (`avg_hit_rt_ms`, `avg_fa_rt_ms`), Samochodzik (`czas_ms`) |
| Poziom trudności | `poziom_trudnosci`, `poziom`, `trasa` | Corsi (`poziom`), FabrykaFigur (`poziom_trudnosci`), PingPong (`poziom_trudnosci`), Samochodzik (`trasa`) |
| Pole wyników (top-level) | `wyniki` vs `wyniki_szczegolowe` | Corsi, FabrykaFigur używają `wyniki_szczegolowe` |

### 2.3. Niejednolitości nazw (duplikaty semantyczne / kolizje)

1. **`testId` z małej litery w części testów:** `samochodzik`, `pingpong`, `semafor`, `syg`, `stop`, `bystreOczko` — brak jednolitej konwencji (PascalCase vs lowercase). Powoduje duplikaty „tego samego testu pod różnymi nazwami”.
2. **`score` jest tekstem (string)** we wszystkich testach — nie da się go porównywać numerycznie bez parsowania; powinien być liczbą lub obiektem.
3. **`statystyki` ma różne klucze dla tego samego pojęcia** (patrz 2.2) — utrudnia funkcję porównywania.
4. **Pole czasu występuje pod wieloma nazwami:** `sredni_czas_reakcji` (top), `sredni_czas_ms`, `czas_reakcji`, `czas_ms`, `czas_pokonania_trasy_sek`, `czas_trwania`, `czas_przezycia_sek`.
5. **Pole wyników prób:** `wyniki` (11 testów) vs `wyniki_szczegolowe` (Corsi, FabrykaFigur).
6. **Brak jednolitego pola `pominiete`** (wymaganego przez AGENTS.md pkt 5) — tylko FabrykaFigur ma `pominiete_cele`.
7. **`poziom_trudnosci` występuje zarówno top-level (GoNoGo, NWstecz, Stroop, FabrykaFigur, Corsi) jak i w `statystyki` (PingPong, FabrykaFigur) — duplikat semantyczny.**
8. **`ilosc_poprawnych_nacisniec` vs `poprawne`/`poprawne_reakcje`** — to samo pojęcie, dwie warstwy (top vs statystyki) bez kanonicznego mapowania.

---

## 3. Rekomendowany kanoniczny schemat (dla funkcji porównywania)

Aby funkcja porównywania wyników działała, proponuję ujednolicić każdy payload do następującego kształtu:

```json
{
  "testId": "PascalCase (np. GoNoGo, Corsi, ...)",
  "subjectId": "...",
  "timestamp": "ISO8601",
  "score": { "raw": <number>, "max": <number|null>, "percent": <number> },
  "statystyki": {
    "poprawne": <int>,
    "bledne": <int>,
    "wszystkie_proby": <int>,
    "pominiete": <int>,
    "skutecznosc": <number>,
    "sredni_czas_ms": <int>,
    "bledne_reakcje": <int>,
    "poprawne_reakcje": <int>
  },
  "wyniki": [ ... ],
  "poziom_trudnosci": "...",
  "czas_trwania_sek": <number|null>
}
```

Zasady:
- `testId` zawsze PascalCase.
- `score` jako obiekt/liczba, nie tekst (tekst można zostawić w `score_opis`).
- `statystyki` zawsze te same klucze (brakujące uzupełnić `null`/`0`).
- Pole prób zawsze `wyniki` (nie `wyniki_szczegolowe`).
- Czas zawsze w ms w `sredni_czas_ms` + ewentualnie `sredni_czas_reakcji` (ms) dla kompatybilności.
- Dodać `pominiete` wszędzie (wg AGENTS.md pkt 5).

---

## 4. Załącznik: pełne listy kluczy per test

### GoNoGo
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, poziom_trudnosci, score, statystyki, wyniki`
Stat: `poprawne, wszystkie, hits, misses, false_alarms, correct_rejections, fa_rate_percent, ustawiony_czas, go_trials, nogo_trials`

### GoNoGoBiegacze (testId GoNoGoCyfry)
Top: `testId, subjectId, session, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, score, statystyki, wyniki`
Stat: `go_trials, nogo_trials, hits, misses, false_alarms, correct_rejections, d_prime, avg_hit_rt_ms, avg_fa_rt_ms, accuracy_percent`

### NWstecz
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, poziom_trudnosci, nback_level, decision_time, total_correct, test_ended_reason, score, statystyki, wyniki`
Stat: `poprawne, bledne, wszystkie_próby, nback_level, decision_time, initial_sequence`

### Stop
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, score, statystyki, wyniki`
Stat: `poprawne_reakcje, wszystkie_proby, skutecznosc, reakcje, bledne_reakcje, falstarty`

### Sygnalizacja
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, czas_reakcji, score, statystyki, wyniki`
Stat: `sredni_czas_ms, poprawne, wszystkie_proby, skutecznosc, nacisniecia_poprawne, nacisniecia_bledne, nacisniecia_lacznie`

### Semafor
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ilosc_blednych_klikniec, ogolna_ilosc_nacisniec, ilosc_brakow_nacisniec, sredni_czas_reakcji, score, statystyki, wyniki`
Stat: `poprawne, bledne_lacznie, bledne_klikniecia, brak_odpowiedzi, wszystkie_kliki, proby, skutecznosc_proc`

### ZlapSygnal
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, klikniecia_bez_kolka, score, statystyki, wyniki`
Stat: `sredni_czas_ms, poprawne_reakcje, wszystkie_proby, bledne_reakcje, skutecznosc`

### BystreOczko
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ilosc_brakow_nacisniec, ogolna_ilosc_nacisniec, ilosc_obiektow_do_klikniecia, sredni_czas_reakcji, score, statystyki, wyniki`
Stat: `sredni_czas_ms, poprawne_reakcje, wszystkie_proby, bledne_reakcje, skutecznosc`

### Corsi
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, max_dlugosc_sekwencji, poziom_trudnosci, rozmiar_siatki, szybkosc_swiecenia, score, statystyki, wyniki_szczegolowe`
Stat: `poprawne, bledne, wszystkie_proby, skutecznosc, max_sekwencja, sredni_czas_ms, poziom, rozmiar_siatki, szybkosc_swiecenia`

### Stroop
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, sredni_czas_reakcji, poziom_trudnosci, score, statystyki, wyniki`
Stat: `sredni_czas_ms, poprawne_reakcje, wszystkie_proby, bledne_reakcje, skutecznosc`

### FabrykaFigur
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, ilosc_obiektow_do_klikniecia, pominiete_cele, poziom_trudnosci, czas_trwania, score, statystyki, wyniki_szczegolowe`
Stat: `poprawne, bledne, wszystkie_kliki, obiekty_do_klikniecia, pominiete_cele, skutecznosc_klikniec, skutecznosc_wykrywania, poziom_trudnosci, czas_trwania_sek`

### PingPong
Top: `testId, subjectId, timestamp, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, score, statystyki`
Stat: `poziom_trudnosci, lewa_ilosc_uderzen, prawa_ilosc_uderzen, czas_trwania, czas_przezycia_sek, odbicia_paletka, maksymalna_predkosc, ilosc_predkosciowych_zmian`

### Samochodzik
Top: `testId, subjectId, session, timestamp, difficulty, ilosc_poprawnych_nacisniec, ilosc_blednych_nacisniec, ogolna_ilosc_nacisniec, czas_pokonania_trasy_sek, score, statystyki`
Stat: `trasa, kolizje, czas_ms`

---

**Koniec raportu.**
