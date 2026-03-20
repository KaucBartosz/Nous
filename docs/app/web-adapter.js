// docs/app/web-adapter.js
// Ten plik odpowiada za przechwycenie "desktopowych" wyników w wersji Web 
// i wygenerowanie sformatowanego pliku CSV (zamiast pliku konfiguracyjnego).

(function() {
    if (typeof window.electronTest === 'undefined' && typeof window.electronAPI === 'undefined') {
        window.electronTest = {
            sendResults: function(data) {
                try {
                    console.log("Nous WebAdapter: Przechwycono wynik testu", data);
                    
                    const flat = {};
                    flat['Data'] = new Date().toLocaleString();
                    flat['Test ID'] = data.testId || data.test_id || 'Nieznany';
                    flat['ID Badanego'] = data.subjectId || data.subject_id || 'Gość';
                    
                    // Add all test parameters
                    const ignoreKeys = ['wyniki', 'testId', 'subjectId', 'timestamp', 'test_id', 'subject_id', 'researcher_uid', 'demographics'];
                    for (const key in data) {
                        if (!ignoreKeys.includes(key) && data[key] !== undefined) {
                            flat[`Wynik - ${key}`] = data[key];
                        }
                    }

                    const bom = "\uFEFF";
                    let csvContent = bom + "Parametr;Wartość\r\n";

                    for (const [key, value] of Object.entries(flat)) {
                        let valStr = String(value);
                        if (valStr.includes(';') || valStr.includes('\n')) {
                            valStr = `"${valStr.replace(/"/g, '""')}"`;
                        }
                        csvContent += `${key};${valStr}\r\n`;
                    }

                    const filename = `Wynik_${flat['Test ID']}_${Date.now()}.csv`;

                    // Generate blob download
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 100);

                    // Pomyślnie wygenerowano, wymuś zamykanie karty po 2 sekundach (dla spokoju)
                    setTimeout(() => {
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
