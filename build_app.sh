#!/bin/bash

echo "============================================="
echo "   AUTOMATYCZNY BUDOWNICZY NOUS (FRESH)      "
echo "============================================="

# 1. Sprawdź czy jesteśmy w dobrym folderze
if [ ! -f "package.json" ]; then
    echo "BŁĄD: Nie znaleziono pliku package.json!"
    exit 1
fi

# 2. CZYSZCZENIE STARYCH PLIKÓW (To jest nowość!)
echo "[0/3] Czyszczenie folderu dist..."
rm -rf dist
echo "      Stare pliki usunięte."

# 3. Instalacja electron-builder
echo "[1/3] Sprawdzanie narzędzi..."
if ! npm list electron-builder --depth=0 > /dev/null 2>&1; then
    echo "      Instalowanie electron-builder..."
    npm install electron-builder --save-dev
else
    echo "      electron-builder jest już zainstalowany."
fi

# 4. Konfiguracja package.json
echo "[2/3] Konfiguracja package.json..."

node -e "
const fs = require('fs');
const fileName = './package.json';
const file = require(fileName);

file.build = {
    appId: 'com.student.nous',
    productName: 'Nous',
    win: {
        target: ['nsis', 'portable'],
        icon: 'icon.ico'
    },
    nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        installerIcon: 'icon.ico',
        uninstallerIcon: 'icon.ico'
    },
    directories: {
        output: 'dist'
    },
    files: [
        '**/*',
        '!dist/*',
        '!**/*.psd'
    ]
};

fs.writeFileSync(fileName, JSON.stringify(file, null, 2));
console.log('      Konfiguracja build zaktualizowana.');
"

# 5. Budowanie
echo "[3/3] Rozpoczynanie budowania aplikacji..."
echo "      To może chwilę potrwać..."

npx electron-builder --win --x64

# 6. Wynik
if [ $? -eq 0 ]; then
    echo ""
    echo "============================================="
    echo "SUKCES!"
    echo "============================================="
    explorer dist
else
    echo "BŁĄD BUDOWANIA!"
fi