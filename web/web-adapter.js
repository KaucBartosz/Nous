// web/web-adapter.js
// Mostek dla testów BBTP uruchamianych w wersji przeglądarkowej.
// Test wywołuje `window.electronTest.sendResults(dane)`; adapter przekazuje
// wynik do okna Launchera (postMessage), a gdy rodzica nie ma — zapisuje CSV
// bezpośrednio. Utrzymywany ręcznie, kopiowany przez build_web.js.
//
// Ten plik jest zwykłym skryptem (nie modułem), bo wstrzykują go strony testów.

(function () {
  if (typeof window.electronTest !== "undefined" || typeof window.electronAPI !== "undefined") {
    return;
  }

  // Skrypt nie jest modułem i ładuje się w komponencie testu (poza kontekstem
  // i18n) — etykiety wybieramy samodzielnie z tego samego klucza co aplikacja.
  var TEXTS = {
    pl: {
      date: "Data",
      testId: "Test ID",
      subjectId: "ID Badanego",
      guest: "Gość",
      unknown: "Nieznany",
      parameter: "Parametr",
      value: "Wartość",
      resultPrefix: "Wynik - ",
      filenamePrefix: "Wynik_",
    },
    en: {
      date: "Date",
      testId: "Test ID",
      subjectId: "Subject ID",
      guest: "Guest",
      unknown: "Unknown",
      parameter: "Parameter",
      value: "Value",
      resultPrefix: "Result - ",
      filenamePrefix: "Result_",
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

  var IGNORE_KEYS = [
    "wyniki",
    "testId",
    "subjectId",
    "timestamp",
    "test_id",
    "subject_id",
    "researcher_uid",
    "demographics",
    "participant",
    "psychopyVersion",
    "frameRate",
  ];

  /** Wartość komórki CSV: obiekty serializujemy, żeby nie trafiało "[object Object]". */
  function cellValue(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function escapeCell(value) {
    var s = cellValue(value);
    return s.indexOf(";") !== -1 || s.indexOf("\n") !== -1 || s.indexOf('"') !== -1
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  function buildCsv(data) {
    var t = texts();
    var rows = [
      [t.date, new Date().toLocaleString()],
      [t.testId, data.testId || data.test_id || t.unknown],
      [t.subjectId, data.subjectId || data.subject_id || t.guest],
    ];

    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (IGNORE_KEYS.indexOf(key) !== -1) continue;
      if (data[key] === undefined) continue;
      rows.push([t.resultPrefix + key, data[key]]);
    }

    var out = "\uFEFF" + t.parameter + ";" + t.value + "\r\n";
    rows.forEach(function (row) {
      out += escapeCell(row[0]) + ";" + escapeCell(row[1]) + "\r\n";
    });
    return out;
  }

  function downloadCsv(filename, csv) {
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 100);
  }

  function closeSoon(delay) {
    setTimeout(function () {
      window.close();
    }, delay);
  }

  window.electronTest = {
    sendResults: function (data) {
      try {
        // Priorytet: okno Launchera (rodzic) — tam jest metryczka, IndexedDB i CSV.
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            { type: "test-results", data: data },
            window.location.origin,
          );
          closeSoon(500);
          return;
        }

        // Fallback: brak rodzica (test otwarty bezpośrednio) — CSV na miejscu.
        console.log("Nous WebAdapter: przechwycono wynik testu", data);
        var testId = data.testId || data.test_id || "test";
        // Wzorzec zgodny z i18n `webAdapter.filename` (Result_/Wynik_ + id + czas).
        var filename = t.filenamePrefix + testId + "_" + Date.now() + ".csv";
        downloadCsv(filename, buildCsv(data));
        closeSoon(2000);
      } catch (e) {
        console.error("WebAdapter Error:", e);
      }
    },
    close: function () {
      window.close();
    },
  };
})();
