# Statystyki per test — spostrzeżenia i rekomendacja (BBTP)

Cel: ujednolicenie wysyłania/porównywania wyników testów JS (sendResults) z wykorzystaniem cache statystyk z bazy danych.

## 1. Stan obecny (z raportu RAPORT_SENDRESULTS.md)
- 13 testów JS, wszystkie wysyłają `score` i `statystyki` (lowercase).
- Brak jednolitego schematu: różne nazwy tych samych pojęć (`poprawne`/`poprawne_reakcje`, `bledne`/`bledne_reakcje`/`bledne_lacznie`, `wszystkie`/`wszystkie_proby`/`wszystkie_kliki`, `skutecznosc`/`skutecznosc_proc`/`accuracy_percent`, czas w wielu wariantach), `wyniki` vs `wyniki_szczegolowe`, `testId` lowercase vs PascalCase, `score` jako tekst.
- Brakujące pola: `wyniki` (PingPong, Samochodzik), `sredni_czas_reakcji` (FabrykaFigur, PingPong, Samochodzik), jednolite `pominiete` (tylko FabrykaFigur).

## 2. Rekomendowana architektura (cache statystyk z bazy)

### Warstwy
- **Źródło prawdy:** tabela surowych wyników (to, co zapisuje `sendResults`).
- **Cache statystyk:** tabela/kolekcja `test_stats_cache`, jeden rekord per sesja/test: klucz `testId + subjectId + sessionId` (lub `runId`), wartości = kanoniczne metryki.

### Schemat cache (kanoniczny kształt)
```json
{
  "testId": "GoNoGo",
  "subjectId": "...",
  "sessionId": "...",
  "schema_version": "1.2",
  "metrics": {
    "poprawne": 42,
    "bledne": 3,
    "wszystkie_proby": 50,
    "pominiete": 5,
    "skutecznosc": 84,
    "sredni_czas_ms": 412
  },
  "computed_at": "ISO8601"
}
```

### Kiedy cache powstaje
- **On-write (write-through):** przy zapisie wyniku (sendResults → DB) od razu licz statystyki i zapisuj rekord cache (w tej samej transakcji). Preferowane dla spójności.
- **Alternatywa lazy (cache-aside):** comparator sprawdza cache; przy miss liczy z bazy i zapisuje (TTL 10–30 min). Prostsze, ale ryzyko stale data.

### Wersjonowanie schematu
- Każdy rekord cache ma `schema_version`; rejestr testów (JSON) też ma wersję.
- Zmiana schematu → bump wersji → stare rekordy traktowane jako miss → automatyczny recompute z bazy.

### Invalidation
- Nowy wynik dla danego `testId/subject/session` → upsert rekordu cache.
- Zmiana schematu → recompute.
- Safety net: TTL (np. 24h) + LRU, żeby cache sam się odświeżał.

### Normalizacja (normalizer)
- Wczytuje payload (JSON/CSV) + rejestr testów (`schemas/tests_registry.json`).
- Wyciąga metryki wg `source` (obsługa zagnieżdżonych `statystyki.x` i aliasów `wyniki`/`wyniki_szczegolowe`).
- Emituje kanoniczny rekord `{ testId, subjectId, timestamp, metrics, extra }`.
- Brakujące pola → `null`/`0`.

### Comparator (funkcja porównywania)
- Wejście: `testId` + dwa zestawy (np. source=JS vs source=Python albo dwie sesje).
- Query cache po `testId` i `source`/`session`; fallback: liczenie z bazy + zapis do cache.
- Porównanie metryk z tolerancją (RT ±5 ms, skuteczność ±1%).
- Raport: metryki przekraczające tolerancję, brakujące pola, brakujące wyniki prób.

## 3. Ryzyka i mitigacje
| Ryzyko | Mitigacja |
|--------|-----------|
| Stale cache po zmianie schematu | `schema_version` + recompute on mismatch |
| Race conditions (zapis + odczyt) | Write-through w tej samej transakcji co zapis wyniku |
| Duża pamięć cache | TTL + LRU + cache tylko ostatnich N sesji |
| Brakujące pola w starych wynikach | Normalizer ustawia `null`/`0` |

## 4. Co przygotować dalej (dla kolejnego agenta)
1. Rejestr testów `schemas/tests_registry.json` (na bazie RAPORT_SENDRESULTS.md) z metrykami, aliasami i wersją.
2. Schemat tabeli/kolekcji `test_stats_cache` (SQL lub NoSQL) + indeksy po `testId`, `subjectId`, `sessionId`, `schema_version`.
3. Normalizer (Python lub JS/Node) z `schema_version`.
4. Comparator z tolerancją i raportem różnic.
5. Decyzja: on-write vs cache-aside + TTL.

## 5. Otwarte pytania do rozstrzygnięcia z agentem znającym program/bazę
- Baza: SQL (Postgres/MySQL/SQLite) czy NoSQL?
- Backend: Node/JS, Python, inny?
- Cache: Redis dostępny czy tabela w tej samej bazie?
- Klucz sesji: porównanie JS vs Python (dwa źródła) czy wyniki między osobami/sesjami?
- Czy `score` ma być liczbą/obiektem zamiast tekstu (wymaga zmiany w sendResults)?

---
Plik źródłowy szczegółów: `RAPORT_SENDRESULTS.md`.  
Ta notatka ma być punktem startu dla kolejnego agenta (zna program i bazę danych).
