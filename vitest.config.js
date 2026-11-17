const { defineConfig, configDefaults } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    exclude: [...configDefaults.exclude, 'tests/emulator/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/lib/**']
    }
  },
  esbuild: {
    loader: 'js'
  }
});