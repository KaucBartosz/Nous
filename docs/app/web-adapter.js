// docs/app/web-adapter.js
// Ten plik odpowiada za przechwycenie "desktopowych" wynikow w wersji Web
// i przeslanie ich do okna Launchera (rodzica) przez postMessage.
// Launcher obsluguje dodanie metryczki, zapis do IndexedDB i generowanie CSV.
// Jesli okno rodzica jest niedostepne, nastepuje fallback do bezposredniego CSV.

(function() {
    if (typeof window.electronTest === 'undefined' && typeof window.electronAPI === 'undefined') {
        window.electronTest = {
            sendResults: function(data) {
                try {
                    // Priorytet: wyslij wyniki do okna Launchera (rodzica)
                    if (window.opener && !window.opener.closed) {
                        window.opener.postMessage({
                            type: 'test-results',
                            data: data
                        }, '*');
                        // Zamknij po krotkim opoznieniu, aby Launcher zdazyl przetworzyc
                        setTimeout(function() {
                            window.close();
                        }, 500);
                        return;
                    }

                    // Fallback: bezposrednie generowanie CSV (gdy brak okna rodzica)
                    console.log("Nous WebAdapter: Przechwycono wynik testu", data);

                    const flat = {};
                    flat['Data'] = new Date().toLocaleString();
                    flat['Test ID'] = data.testId || data.test_id || 'Nieznany';
                    flat['ID Badanego'] = data.subjectId || data.subject_id || 'Gosc';

                    const ignoreKeys = ['wyniki', 'testId', 'subjectId', 'timestamp', 'test_id', 'subject_id', 'researcher_uid', 'demographics'];
                    for (const key in data) {
                        if (!ignoreKeys.includes(key) && data[key] !== undefined) {
                            flat['Wynik - ' + key] = data[key];
                        }
                    }

                    const bom = "\uFEFF";
                    let csvContent = bom + "Parametr;Wartosc\r\n";

                    for (const key in flat) {
                        let valStr = String(flat[key]);
                        if (valStr.includes(';') || valStr.includes('\n')) {
                            valStr = '"' + valStr.replace(/"/g, '""') + '"';
                        }
                        csvContent += key + ';' + valStr + '\r\n';
                    }

                    const filename = 'Wynik_' + flat['Test ID'] + '_' + Date.now() + '.csv';

                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);

                    var a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function() { URL.revokeObjectURL(url); }, 100);

                    setTimeout(function() {
                        window.close();
                    }, 2000);

                } catch (e) {
                    console.error("WebAdapter Error:", e);
                }
            },
            close: function() {
                window.close();
            }
        };
    }
})();
