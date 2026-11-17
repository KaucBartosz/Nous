const { defineConfig } = require('vitest/config');

// Osobna konfiguracja dla testów semantyki reguł na emulatorze Firestore.
// Nie używa tests/setup.js (XOR-mock), bo testy rozmawiają z prawdziwym
// emulatorem przez @firebase/rules-unit-testing w czystym środowisku node.
module.exports = defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    include: ['tests/emulator/**/*.test.js'],
    testTimeout: 30000
  },
  esbuild: {
    loader: 'js'
  }
});
