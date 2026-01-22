// preload_test.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronTest', {
    // Funkcja, którą wywoła test, gdy się skończy
    sendResults: (results) => ipcRenderer.send('test-finished', results),
    
    // Funkcja do awaryjnego zamknięcia okna (np. przycisk "Wyjdź")
    close: () => ipcRenderer.send('test-close')
});