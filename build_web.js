// build_web.js — generuje wersję przeglądarkową do docs/app.
//
// Zasada: docs/app to WYŁĄCZNIE artefakt. Jedyne źródło prawdy to src/,
// index.html, style.css i web/. Wszystko, co webowe w index.html, powstaje
// w transformacji poniżej — dzięki temu kolejny build nie nadpisze ręcznych
// poprawek w docs/app (to był główny powód rozjazdu wersji).
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DEST = path.join(ROOT, "docs", "app");
const WEB_SRC = path.join(ROOT, "web");

// Pliki przenoszone 1:1 z korzenia repozytorium.
const STATIC_FILES = ["style.css", "fonts.css", "logo.webp", "logo-touch.png"];
// Katalogi przenoszone 1:1.
const STATIC_DIRS = ["assets"];
// Pliki webowe utrzymywane ręcznie (poza src/).
const WEB_FILES = ["web-adapter.js", "boot-guard.js", "test-lang.js"];

// ─── I/O ─────────────────────────────────────────────────────────────────────

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

/** Usuwa pliki po rozszerzeniu — source mapy z BBTP ważyły ~85 MB. */
function stripByExtension(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removed += stripByExtension(target, ext);
    } else if (entry.name.endsWith(ext)) {
      fs.rmSync(target, { force: true });
      removed += 1;
    }
  }
  return removed;
}

// ─── Transformacja HTML ──────────────────────────────────────────────────────

/** Podmiana, która głośno pada, zamiast po cichu wygenerować zepsuty plik. */
function patch(html, from, to, label) {
  if (!html.includes(from)) {
    throw new Error(
      `build_web: nie znaleziono fragmentu "${label}" w index.html. ` +
        `Zmienił się szkielet — zaktualizuj transformację w build_web.js.`,
    );
  }
  return html.replace(from, to);
}

/**
 * Szkielet webowy:
 * - `data-platform="web"` — hak dla CSS/JS bez zaglądania w user-agent,
 * - ekran logowania ukryty od pierwszej klatki (koniec "flashu"),
 * - dashboard widoczny od razu (szkielet zamiast pustki),
 * - boot-guard jako zwykły skrypt (moduł może nigdy nie wystartować).
 */
function toWebShell(html) {
  let out = patch(html, '<html lang="pl">', '<html lang="pl" data-platform="web">', "html");

  out = patch(
    out,
    '<div id="login-screen" class="full-screen-center">',
    '<div id="login-screen" class="full-screen-center hidden" aria-hidden="true">',
    "login-screen",
  );

  out = patch(
    out,
    '<div id="dashboard-screen" class="app-layout hidden">',
    '<div id="dashboard-screen" class="app-layout">',
    "dashboard-screen",
  );

  out = patch(
    out,
    '<button id="nav-updates" class="nav-item">',
    '<button id="nav-updates" class="nav-item hidden" aria-hidden="true">',
    "nav-updates",
  );

  out = patch(
    out,
    "</body>",
    '        <script src="boot-guard.js"></script>\n    </body>',
    "body-end",
  );

  return out;
}

// ─── Build ───────────────────────────────────────────────────────────────────

function buildWeb() {
  console.log("Budowanie wersji przeglądarkowej (WebApp)...");
  fs.mkdirSync(DEST, { recursive: true });

  // 1. Czyścimy artefakty kodu — bez tego stare moduły (np. history.js
  //    sprzed podziału) zostają w docs/app i wygrywają z nowymi.
  rmrf(path.join(DEST, "src"));
  rmrf(path.join(DEST, "assets"));

  // 2. Szkielet + styl + grafika
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  fs.writeFileSync(path.join(DEST, "index.html"), toWebShell(html), "utf8");

  for (const file of STATIC_FILES) {
    const from = path.join(ROOT, file);
    if (!fs.existsSync(from)) {
      throw new Error(`build_web: brak pliku ${file} (uruchom najpierw konwersję logo).`);
    }
    fs.copyFileSync(from, path.join(DEST, file));
  }
  for (const dir of STATIC_DIRS) {
    const from = path.join(ROOT, dir);
    if (fs.existsSync(from)) copyDir(from, path.join(DEST, dir));
  }

  // 3. Kod aplikacji (jedyne źródło prawdy)
  copyDir(path.join(ROOT, "src"), path.join(DEST, "src"));

  // 4. Pliki webowe utrzymywane ręcznie
  for (const file of WEB_FILES) {
    fs.copyFileSync(path.join(WEB_SRC, file), path.join(DEST, file));
  }

  // 5. Porządki w artefakcie
  rmrf(path.join(DEST, "inject-adapter.js")); // skrypt Node — nie ma czego szukać na serwerze
  rmrf(path.join(DEST, "logo.png")); // zastąpiony przez logo.webp + logo-touch.png
  const maps = stripByExtension(DEST, ".map");
  const leftovers = ["web-adapter.js"].filter(
    (f) => !fs.existsSync(path.join(DEST, f)),
  );
  if (leftovers.length) {
    throw new Error(`build_web: brak artefaktów: ${leftovers.join(", ")}`);
  }

  // 6. Testy BBTP: źródło to katalog BBTP (lokalnie lub obok repozytorium).
  //    Kopiujemy tylko pliki eksperymentu — index.html i lib zostają w docs/app,
  //    bo wersja webowa ma własny index.html z web-adapter.js. Potem wstrzykujemy
  //    test-lang.js (język testu w Web: wybór Nous z localStorage).
  const bbtp = resolveBbtpSource();
  const testsDest = path.join(DEST, "tests");
  fs.mkdirSync(testsDest, { recursive: true });
  const synced = bbtp ? syncBbtpTests(bbtp, testsDest) : 0;
  injectTestLanguage(testsDest);
  const registryPath = path.join(DEST, "tests-registry.json");
  if (!fs.existsSync(registryPath)) {
    fs.writeFileSync(registryPath, "[]\n", "utf8");
    console.warn("  ! tests-registry.json był pusty — utworzono pusty rejestr.");
  }

  const sizeMb = dirSize(DEST) / (1024 * 1024);
  console.log(`✅ Gotowe: docs/app (${sizeMb.toFixed(2)} MB, usunięto ${maps} source map)`);
  if (synced) {
    console.log(`   Testy: zsynchronizowano ${synced} plików z ${bbtp}`);
  } else {
    console.log("   Testy: bez zmian (nie znaleziono katalogu BBTP).");
  }
}

/** Katalog BBTP z testami: zmienna BBTP_DIR, lokalna ścieżka lub sąsiad repo. */
function resolveBbtpSource() {
  const candidates = [
    process.env.BBTP_DIR,
    "C:\\Users\\HARDPC\\Desktop\\BBTP",
    path.join(ROOT, "..", "BBTP"),
    path.join(ROOT, "BBTP"),
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, "NWstecz", "nwstecz.js"))) || null;
}

/**
 * Kopiuje pliki eksperymentu z BBTP do docs/app/tests. Test we Web to folder,
 * którego index.html importuje jeden plik eksperymentu; dokładamy jego moduły
 * i18n (i18n.js, dialog-i18n.js, strings.js), bo testy je importują.
 * Zwraca liczbę skopiowanych plików.
 */
function syncBbtpTests(bbtpDir, testsDest) {
  let count = 0;
  for (const entry of fs.readdirSync(testsDest, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const srcDir = path.join(bbtpDir, entry.name);
    const indexPath = path.join(testsDest, entry.name, "index.html");
    if (!fs.existsSync(indexPath) || !fs.existsSync(srcDir)) continue;

    const html = fs.readFileSync(indexPath, "utf8");
    const entryScript = html.match(/<script[^>]+src="\.\/([^"/]+\.js)"[^>]*type="module"/);
    if (!entryScript) continue;

    const files = [entryScript[1], "i18n.js", "dialog-i18n.js", "strings.js"];
    for (const file of files) {
      const from = path.join(srcDir, file);
      if (!fs.existsSync(from)) continue;
      fs.copyFileSync(from, path.join(testsDest, entry.name, file));
      count += 1;
    }
  }
  return count;
}

/**
 * Wstrzykuje test-lang.js do każdego testu w docs/app/tests — bezpośrednio po
 * web-adapter.js. Ścieżka jest liczona tak samo jak ścieżka adaptera, więc
 * działa niezależnie od głębokości folderu testu. Idempotentne.
 */
function injectTestLanguage(testsDir) {
  if (!fs.existsSync(testsDir)) return;

  for (const entry of fs.readdirSync(testsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const indexPath = path.join(testsDir, entry.name, "index.html");
    if (!fs.existsSync(indexPath)) continue;

    let html = fs.readFileSync(indexPath, "utf8");
    if (html.includes("test-lang.js")) continue;

    const adapter = html.match(/<script[^>]+src="([^"]*web-adapter\.js)"[^>]*><\/script>/);
    if (!adapter) continue; // test bez adaptera nie raportuje wyników — nic nie robimy

    const langSrc = adapter[1].replace(/web-adapter\.js$/, "test-lang.js");
    html = html.replace(adapter[0], `${adapter[0]}\n    <script src="${langSrc}"></script>`);
    fs.writeFileSync(indexPath, html, "utf8");
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(target) : fs.statSync(target).size;
  }
  return total;
}

buildWeb();
