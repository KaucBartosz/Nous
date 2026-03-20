const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
    if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
    fs.readdirSync(from).forEach(element => {
        if (fs.lstatSync(path.join(from, element)).isFile()) {
            fs.copyFileSync(path.join(from, element), path.join(to, element));
        } else {
            copyFolderSync(path.join(from, element), path.join(to, element));
        }
    });
}

function buildWeb() {
    console.log('Budowanie wersji przeglądarkowej (WebApp)...');
    const dest = path.join(__dirname, 'docs', 'app');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    // Kopiowanie wymaganych plików korzeniowych
    const filesToCopy = ['index.html', 'style.css', 'logo.png'];
    filesToCopy.forEach(file => {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(dest, file));
        } else {
            console.warn(` Brak pliku: ${file}`);
        }
    });

    // Kopiowanie kodu źródłowego
    copyFolderSync(path.join(__dirname, 'src'), path.join(dest, 'src'));

    // Struktura na testy
    const testsDest = path.join(dest, 'tests');
    if (!fs.existsSync(testsDest)) fs.mkdirSync(testsDest, { recursive: true });
    
    const registryPath = path.join(dest, 'tests-registry.json');
    if (!fs.existsSync(registryPath)) {
        const sampleRegistry = [
            {
                "id": "bystreOczko",
                "name": "Bystre Oczko (Przykład)",
                "description": "Klasyczny test na spostrzegawczość",
                "version": 1,
                "path": "tests/bystreOczko/index.html"
            }
        ];
        fs.writeFileSync(registryPath, JSON.stringify(sampleRegistry, null, 2));
    }

    console.log('✅ Budowanie zakończone!');
    console.log('--------------------------------------------------');
    console.log('Utworzono folder: docs/app/');
    console.log('Aby opublikować nowe testy na webie, wrzuć je do "docs/app/tests/"');
    console.log('a następnie dopisz je do pliku "docs/app/tests-registry.json"!');
    console.log('--------------------------------------------------');
}

buildWeb();
