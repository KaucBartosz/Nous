const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
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