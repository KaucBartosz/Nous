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

  function renderFailure() {
    var grid = document.getElementById("tests-grid");
    if (!grid) return;
    grid.innerHTML = "";

    var box = document.createElement("div");
    box.className = "boot-failure";

    var title = document.createElement("h3");
    title.textContent = "Nie udało się załadować aplikacji";

    var text = document.createElement("p");
    text.textContent =
      "Sprawdź połączenie z internetem i odśwież stronę. Jeśli problem się " +
      "powtarza, spróbuj innej przeglądarki lub aplikacji desktopowej Nous.";

    var retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn primary";
    retry.textContent = "Odśwież";
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
