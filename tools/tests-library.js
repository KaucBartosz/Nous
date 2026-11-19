// tools/tests-library.js — jedno miejsce reguły „gdzie są testy BBTP".
// build_web.js i suite E2E nie powinny mieć własnych kopii tej reguły.
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const BBTP_MARKER = path.join('NWstecz', 'nwstecz.js');

/** Build: BBTP_DIR → katalog obok repo → katalog w repo. null = brak testów. */
function resolveBuildLibrary() {
  const candidates = [
    process.env.BBTP_DIR,
    path.join(ROOT, '..', 'BBTP'),
    path.join(ROOT, 'BBTP'),
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, BBTP_MARKER))) || null;
}

/** E2E: jawny override albo fixture w repo — bez zależności od obcych katalogów. */
function resolveE2eLibrary(fixtureDir) {
  return process.env.NOUS_E2E_TESTS_DIR || fixtureDir;
}

module.exports = { ROOT, BBTP_MARKER, resolveBuildLibrary, resolveE2eLibrary };
