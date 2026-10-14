import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

// ==========================================================
// Testy E2E dla Electron Desktop App (2-panelowe logowanie:
// wybór -> sub-panel online / sub-panel lokalny)
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

// --- Helpery: każdy test sam ustawia stan początkowy ---

async function gotoLoginChoice() {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#login-choice-panel')).toBeVisible({ timeout: 10000 });
}

async function loginAsGuest() {
  await gotoLoginChoice();
  await page.click('#btn-choose-local');
  await expect(page.locator('#login-local-panel')).toBeVisible();
  await page.click('#btn-guest');
  await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
}

// Rejestracja konta lokalnego (unikalny login) + auto-login na dashboard.
async function registerLocalAccount(username, password) {
  await gotoLoginChoice();
  await page.click('#btn-choose-local');
  await expect(page.locator('#login-local-panel')).toBeVisible();
  await page.fill('#local-username', username);
  await page.fill('#local-password', password);
  await page.click('#btn-register-local');
  await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#user-email-display')).toContainText(username);
}

async function loginLocalAccount(username, password) {
  await gotoLoginChoice();
  await page.click('#btn-choose-local');
  await expect(page.locator('#login-local-panel')).toBeVisible();
  await page.fill('#local-username', username);
  await page.fill('#local-password', password);
  await page.click('#btn-login-local');
  await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
}

test.describe('Electron App - Autoryzacja', () => {

  test('aplikacja uruchamia się poprawnie', async () => {
    // Sprawdź czy okno istnieje
    expect(page).toBeTruthy();

    // Sprawdź tytuł okna
    const title = await page.title();
    expect(title).toContain('Nous');
  });

  test('ekran wyboru logowania jest widoczny na starcie', async () => {
    await gotoLoginChoice();

    // Oba kafle wyboru
    await expect(page.locator('#btn-choose-online')).toBeVisible();
    await expect(page.locator('#btn-choose-local')).toBeVisible();
  });

  test('panel logowania online otwiera się z kafla', async () => {
    await gotoLoginChoice();
    await page.click('#btn-choose-online');

    // Pola i przyciski panelu online
    await expect(page.locator('#login-online-panel')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#btn-login')).toBeVisible();
    await expect(page.locator('#btn-register')).toBeVisible();

    // Powrót do wyboru
    await page.click('#btn-back-online');
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });

  test('panel logowania lokalnego otwiera się z kafla', async () => {
    await gotoLoginChoice();
    await page.click('#btn-choose-local');

    // Pola i przyciski panelu lokalnego
    await expect(page.locator('#login-local-panel')).toBeVisible();
    await expect(page.locator('#local-username')).toBeVisible();
    await expect(page.locator('#local-password')).toBeVisible();
    await expect(page.locator('#btn-login-local')).toBeVisible();
    await expect(page.locator('#btn-register-local')).toBeVisible();
    await expect(page.locator('#btn-guest')).toBeVisible();

    // Powrót do wyboru
    await page.click('#btn-back-local');
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });
});

test.describe('Electron App - Tryb Gość', () => {

  test('można zalogować się jako gość', async () => {
    await loginAsGuest();

    // Sprawdź czy użytkownik jest oznaczony jako gość
    await expect(page.locator('#user-email-display')).toContainText('Gość');
  });

  test('nawigacja sidebar działa', async () => {
    await loginAsGuest();

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
    await loginAsGuest();

    // Kliknij wyloguj
    await page.click('#btn-logout');

    // Sprawdź czy wróciliśmy do ekranu wyboru logowania
    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });
});

test.describe('Electron App - Widoki Gość (CatalogView)', () => {

  test('biblioteka renderuje siatkę (karty albo panel offline)', async () => {
    await loginAsGuest();
    await expect(page.locator('#library-view')).toBeVisible();
    // loadTestsList jest asynchroniczne (Firestore EFI backfill) — czekaj na treść
    await page.waitForFunction(
      () => document.getElementById('tests-grid')?.childElementCount > 0,
      { timeout: 20000 },
    );
  });

  test('widoki aktualizacji i metryczki otwierają się', async () => {
    await loginAsGuest();

    await page.click('#nav-updates');
    await expect(page.locator('#updates-view')).toBeVisible();

    await page.click('#nav-demographics');
    await expect(page.locator('#demographics-view')).toBeVisible();
  });
});

test.describe('Electron App - Konto lokalne i zmiana hasła (passwordModal + Session)', () => {
  const username = `e2e${Date.now().toString().slice(-6)}`;
  const password = 'start1234';
  const newPassword = 'nowe5678';

  test('rejestracja konta lokalnego loguje automatycznie', async () => {
    await registerLocalAccount(username, password);
    // Przycisk zmiany hasła widoczny tylko dla LOCAL
    await expect(page.locator('#btn-change-local-password')).toBeVisible();
  });

  test('modal zmiany hasła: mismatch blokuje, poprawne hasło zapisuje', async () => {
    await loginLocalAccount(username, password);

    await page.click('#btn-change-local-password');
    await expect(page.locator('#change-password-modal')).toBeVisible();

    // 1. Niezgodne hasła → błąd w formularzu, serwis nie wołany (modal zostaje)
    await page.fill('#cp-old-password', password);
    await page.fill('#cp-new-password', 'aaa111');
    await page.fill('#cp-confirm-password', 'bbb222');
    await page.click('#btn-submit-change-password');
    await expect(page.locator('#cp-error')).toContainText('Nowe hasła nie są zgodne');
    await expect(page.locator('#change-password-modal')).toBeVisible();

    // 2. Zgodne hasła → sukces (Dialog) i zamknięcie modala
    await page.fill('#cp-new-password', newPassword);
    await page.fill('#cp-confirm-password', newPassword);
    await page.click('#btn-submit-change-password');
    await expect(page.locator('#custom-dialog-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#custom-dialog-title')).toContainText('Sukces');
    await page.locator('#custom-dialog-modal button:has-text("OK")').click();
    await expect(page.locator('#change-password-modal')).toBeHidden();
  });

  test('nowe hasło działa przy kolejnym logowaniu', async () => {
    // Wyloguj z sesji po zmianie hasła
    await loginLocalAccount(username, newPassword);
    await expect(page.locator('#user-email-display')).toContainText(username);
    await page.click('#btn-logout');
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });
});
