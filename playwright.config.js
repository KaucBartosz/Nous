import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Electron - jeden worker
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Electron wymaga jednego workera
  reporter: 'html',
  timeout: 30000,
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Projekt dla Electron - testuje desktopową aplikację
    {
      name: 'electron',
      use: {
        // Playwright użyje Electrona jako "przeglądarki"
      },
    },
  ],
});