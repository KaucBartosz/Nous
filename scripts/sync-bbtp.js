// Skrypt do automatycznego pobierania i synchronizacji testów z BBTP
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_URL = 'https://github.com/KaucBartosz/BBTP.git';
const TEMP_DIR = path.join(__dirname, '..', 'temp_bbtp');
const TESTS_DEST_DIR = path.join(__dirname, '..', 'docs', 'app', 'tests');
const REGISTRY_PATH = path.join(__dirname, '..', 'docs', 'app', 'tests-registry.json');
const INJECTOR_PATH = path.join(__dirname, '..', 'inject-adapter.js');

// Wykluczenia - czego NIE kopiować
const IGNORE_EXTENSIONS = ['.py', '.md', '.zip', '.psd', '.txt', '.gitignore'];
const IGNORE_DIRS = ['.git', '.github', '.claude', '.vscode'];

function cleanTemp() {
    if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
}

function copyRecursive(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (IGNORE_EXTENSIONS.includes(ext) || entry.name.startsWith('.')) {
                continue;
            }
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

try {
    console.log('1. Klonowanie repozytorium BBTP...');
    cleanTemp();
    execSync(`git clone --depth 1 ${REPO_URL} "${TEMP_DIR}"`, { stdio: 'inherit' });

    console.log('\n2. Przetwarzanie folderów testów...');
    if (!fs.existsSync(TESTS_DEST_DIR)) fs.mkdirSync(TESTS_DEST_DIR, { recursive: true });

    const rootEntries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });
    const importedTests = [];

    for (let entry of rootEntries) {
        if (entry.isDirectory() && !IGNORE_DIRS.includes(entry.name)) {
            // Sprawdź czy to faktycznie test (np. czy ma index.html gdzieś w środku)
            const srcFolder = path.join(TEMP_DIR, entry.name);
            if (fs.existsSync(path.join(srcFolder, 'index.html'))) {
                console.log(` -> Kopiowanie testu: ${entry.name}`);
                const destFolder = path.join(TESTS_DEST_DIR, entry.name);
                copyRecursive(srcFolder, destFolder);
                importedTests.push(entry.name);
            }
        }
    }

    console.log('\n3. Aktualizacja tests-registry.json...');
    let registry = [];
    if (fs.existsSync(REGISTRY_PATH)) {
        registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    }

    let modified = false;
    for (let testName of importedTests) {
        if (!registry.find(r => r.id === testName)) {
            console.log(` -> Dodawanie nowego wpisu do rejestru: ${testName}`);
            registry.push({
                id: testName,
                name: testName,
                description: `Zaimportowano z repozytorium BBTP (${testName})`,
                version: 1,
                path: `tests/${testName}/index.html`
            });
            modified = true;
        }
    }

    // Opcjonalnie usuwamy z rejestru wpisy testów, których już nie ma?
    // Zakładamy, że nie usuwamy, chyba że użytkownik o to poprosi.
    
    // Sortujmy alfabetycznie
    registry.sort((a, b) => a.name.localeCompare(b.name));
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));

    console.log('\n4. Wstrzykiwanie adapterów Web...');
    if (fs.existsSync(INJECTOR_PATH)) {
        execSync(`node "${INJECTOR_PATH}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    }

    console.log('\n5. Czyszczenie plików tymczasowych...');
    cleanTemp();

    console.log('\n✅ Synchronizacja BBTP zakończona sukcesem!');
} catch (e) {
    console.error('Wystąpił błąd podczas synchronizacji:', e);
    cleanTemp();
    process.exit(1);
}
