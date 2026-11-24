# Nous - Oficjalne Wydania

Witaj w repozytorium dystrybucyjnym aplikacji **Nous**.

🌐 **Strona projektu:** [https://kaucbartosz.github.io/Nous/](https://kaucbartosz.github.io/Nous/)

## 📥 Pobierz najnowszą wersję

Kliknij poniżej, aby przejść do sekcji pobierania i wybrać wersję dla swojego systemu:

[![Pobierz najnowszą wersję](https://img.shields.io/github/v/release/KaucBartosz/Nous?label=Najnowsza%20Wersja&style=for-the-badge&color=blue)](https://github.com/KaucBartosz/Nous/releases/latest)

---

## 💻 Instrukcja instalacji

### Windows

1. Pobierz plik instalacyjny `.exe` z sekcji [Releases](https://github.com/KaucBartosz/Nous/releases/latest).
2. Uruchom pobrany plik.
3. **Uwaga:** Jeśli zobaczysz ekran **"System Windows ochronił ten komputer" (SmartScreen)**:
   - Kliknij **"Więcej informacji"** (More info).
   - Kliknij przycisk **"Uruchom mimo to"** (Run anyway).
   *(Dzieje się tak, ponieważ aplikacja jest nowa i nie posiada jeszcze drogiego certyfikatu korporacyjnego).*

### macOS

1. Pobierz plik `.dmg` z sekcji [Releases](https://github.com/KaucBartosz/Nous/releases/latest).
2. Otwórz go i przeciągnij ikonę aplikacji do folderu `Applications/Aplikacje`.
3. **Przy pierwszym uruchomieniu:**
   - Jeśli system zablokuje otwarcie ("Nieznany programista"), kliknij na ikonę aplikacji **Prawym Przyciskiem Myszy** i wybierz **Otwórz**.
   - W oknie dialogowym potwierdź chęć otwarcia.

### Linux

1. Pobierz plik `.AppImage` z sekcji [Releases](https://github.com/KaucBartosz/Nous/releases/latest).
2. Dla `.AppImage`:
   - Nadaj plikowi uprawnienia do wykonywania za pomocą terminala:

     ```bash
     chmod +x Nous*.AppImage
     ```

   - Uruchom plik dwuklikiem lub z terminala.
   - Skoro używasz linuxa to na pewno sobie poradzisz!

---

## 🔄 Automatyczne Aktualizacje

Aplikacja posiada wbudowany system aktualizacji.
Gdy wydamy nową wersję w tym repozytorium, Twoja aplikacja automatycznie ją wykryje przy następnym uruchomieniu i zaproponuje pobranie oraz instalację.

---

## 🐛 Zgłaszanie błędów

Możesz zgłaszać problemy z działaniem aplikacji w zakładce [Issues](https://github.com/KaucBartosz/Nous/issues) lub na email 7k89yxz17@mozmail.com.

1. Przejdź do zakładki Issues.
2. Kliknij "New Issue".
3. Opisz problem, system operacyjny i kroki do powtórzenia błędu.

---

&copy; 2026 Nous. Wszelkie prawa zastrzeżone.

---

## 🛠️ Development (dla contributorów)

Poniższe komendy odtworzą środowisko deweloperskie i pozwolą zweryfikować zmiany przed wysłaniem PR.

1. Wymagany **Node.js 24.x** — taką samą wersję używają workflow CI (`.github/workflows/release.yml`).
2. `npm ci` — instalacja zależności z `package-lock.json`.
3. `npm start` — uruchomienie aplikacji w Electronie.
4. `npm run test:run` — **jednorazowy** suite jednostkowy. Użyj go zamiast `npm test`, który działa w trybie watch i nigdy się nie kończy w CI.
5. `npm run test:e2e` — testy scenariuszowe (Playwright). Wymagają uruchomionego Electrona i konta Firebase, dlatego nie są częścią bramki CI.
6. `npm run build:web` — generuje katalog `docs/app`. Źródłem prawdy jest `src/` i `web/`, a nie wygenerowany artefakt — nie edytuj `docs/app` ręcznie.
7. `npm run dist -- --publish never` — suchy build instalatora bez publikacji wydania.
8. Reguły Firestore znajdują się w `firestore.rules` i wymagają przeglądu przed każdym wdrożeniem.
