import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

// ==========================================================
// Testy E2E dla Electron Desktop App
// ==========================================================

let electronApp;
let page;

test.beforeAll(async () => {
  // Uruchom aplikację Electron
  electronApp = await electron.launch({
    args: [path.join(process.cwd(), 'main.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Pobierz pierwsze okno
  page = await electronApp.firstWindow();
  
  // Czekaj na załadowanie strony
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Zamknij aplikację po testach
  await electronApp.close();
});

test.describe('Electron App - Autoryzacja', () => {
  
  test('aplikacja uruchamia się poprawnie', async () => {
    // Sprawdź czy okno istnieje
    expect(page).toBeTruthy();
    
    // Sprawdź tytuł okna
    const title = await page.title();
    expect(title).toContain('Nous');
  });

  test('ekran logowania jest widoczny na starcie', async () => {
    // Sprawdź czy ekran logowania jest widoczny
    await expect(page.locator('#login-screen')).toBeVisible();
    
    // Sprawdź czy pola logowania istnieją
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('przyciski logowania są widoczne', async () => {
    await expect(page.locator('#btn-login')).toBeVisible();
    await expect(page.locator('#btn-register')).toBeVisible();
    await expect(page.locator('#btn-guest')).toBeVisible();
  });
});

test.describe('Electron App - Tryb Gość', () => {
  
  test('można zalogować się jako gość', async () => {
    // Kliknij przycisk gościa
    await page.click('#btn-guest');
    
    // Czekaj na dashboard
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Sprawdź czy użytkownik jest oznaczony jako gość
    await expect(page.locator('#user-email-display')).toContainText('Gość');
  });

  test('nawigacja sidebar działa', async () => {
    // Sprawdź czy sidebar jest widoczny
    await expect(page.locator('.sidebar')).toBeVisible();
    
    // Przejdź do historii
    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
    
    // Przejdź do ustawień
    await page.click('#nav-settings');
    await expect(page.locator('#settings-view')).toBeVisible();
  });

  test('można wylogować się', async () => {
    // Kliknij wyloguj
    await page.click('#btn-logout');
    
    // Sprawdź czy wróciliśmy do logowania
    await expect(page.locator('#login-screen')).toBeVisible();
  });
});