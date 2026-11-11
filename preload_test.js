// preload_test.js
const { contextBridge, ipcRenderer } = require('electron');

// Adres strony testu — test rozpoznaje go (file://…/Stroop/index.html),
// a host dobiera język interfejsu. Tylko do odczytu, bez wywołań IPC.
let locationHref = '';
try {
    locationHref = new URL(process.argv.find((a) => a.startsWith('file://')) || '').href;
} catch (e) {}

// Język interfejsu ustawia host przez --nous-test-language=pl|en
// (main/testRunner.js → additionalArguments). Domyślnie polski.
function readLanguage() {
    const arg = process.argv.find((a) => a.startsWith('--nous-test-language='));
    const lang = arg ? arg.split('=')[1] : '';
    return lang === 'en' ? 'en' : 'pl';
}

contextBridge.exposeInMainWorld('electronTest', {
    // Funkcja, którą wywoła test, gdy się skończy
    sendResults: (results) => ipcRenderer.send('test-finished', results),

    // Funkcja do awaryjnego zamknięcia okna (np. przycisk "Wyjdź")
    close: () => ipcRenderer.send('test-close'),

    // Język testu (pl/en) — ustawia host przy starcie okna testu
    getLanguage: () => readLanguage(),

    // file://…/TestFolder/index.html — identyfikator załadowanego testu
    locationHref,
});
