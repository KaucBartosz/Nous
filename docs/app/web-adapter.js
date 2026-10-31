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
    var rows = [
      ["Data", new Date().toLocaleString()],
      ["Test ID", data.testId || data.test_id || "Nieznany"],
      ["ID Badanego", data.subjectId || data.subject_id || "Gość"],
    ];

    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (IGNORE_KEYS.indexOf(key) !== -1) continue;
      if (data[key] === undefined) continue;
      rows.push(["Wynik - " + key, data[key]]);
    }

    var out = "\uFEFFParametr;Wartość\r\n";
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
        downloadCsv("Wynik_" + testId + "_" + Date.now() + ".csv", buildCsv(data));
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
