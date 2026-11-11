// web/boot-guard.js
// Siatka bezpieczeństwa dla wersji przeglądarkowej: jeśli moduł aplikacji nie
// wystartuje (brak sieci, błąd JS, zablokowany CDN), użytkownik nie może zostać
// z pustym szkieletem i zerowym wyjaśnieniem. Wtedy pokazujemy komunikat
// z odświeżeniem.
//
// Detekcja jest celowo nieinwazyjna: patrzymy na placeholder w siatce testów,
// który `loadTestsList()` zawsze nadpisuje przy starcie.

(function () {
  var TIMEOUT_MS = 12000;

  function bootFailed() {
    var hint = document.getElementById("library-boot-hint");
    return !!hint && hint.isConnected;
  }

  // Ten plik ładuje się przed modułami aplikacji, na wypadek gdyby moduł i18n
  // nigdy nie wystartował — musi wybrać język samodzielnie.
  var TEXTS = {
    pl: {
      title: "Nie udało się załadować aplikacji",
      text:
        "Sprawdź połączenie z internetem i odśwież stronę. Jeśli problem się " +
        "powtarza, spróbuj innej przeglądarki lub aplikacji desktopowej Nous.",
      retry: "Odśwież",
    },
    en: {
      title: "Could not load the application",
      text:
        "Check your internet connection and refresh the page. If the problem " +
        "persists, try a different browser or the Nous desktop app.",
      retry: "Refresh",
    },
  };

  function texts() {
    var lang = "en";
    try {
      var saved = localStorage.getItem("nous-language");
      var nav = (navigator.language || "").toLowerCase();
      lang = saved || (nav.indexOf("pl") === 0 ? "pl" : "en");
    } catch (e) {
      // localStorage niedostępny — zostaje domyślny EN.
    }
    return TEXTS[lang] || TEXTS.pl;
  }

  function renderFailure() {
    var grid = document.getElementById("tests-grid");
    if (!grid) return;
    grid.innerHTML = "";

    var t = texts();

    var box = document.createElement("div");
    box.className = "boot-failure";

    var title = document.createElement("h3");
    title.textContent = t.title;

    var text = document.createElement("p");
    text.textContent = t.text;

    var retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn primary";
    retry.textContent = t.retry;
    retry.addEventListener("click", function () {
      window.location.reload();
    });

    box.append(title, text, retry);
    grid.appendChild(box);
  }

  window.setTimeout(function () {
    if (bootFailed()) renderFailure();
  }, TIMEOUT_MS);
})();
