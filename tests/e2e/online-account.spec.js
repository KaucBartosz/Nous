const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { mkdtemp } = require('fs/promises');
const { rmSync } = require('fs');

// ==========================================================
// Testy logowania do Konta Online na koncie o statusie PENDING.
// Dane logowania: zmienne NOUS_ONLINE_EMAIL / NOUS_ONLINE_PASSWORD,
// albo lokalny plik tests/e2e/online-account.local.json (gitignore'owany).
// Konto MUSI mieć status PENDING — dzięki temu testy nie mogą wysłać
// danych do chmury nawet przy błędzie w kodzie.
// ==========================================================

function localCredentials() {
  try {
    const file = path.join(__dirname, 'online-account.local.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.warn('[online-e2e] nie udało się odczytać lokalnych danych:', e.message);
  }
  return {};
}

const LOCAL = localCredentials();
const EMAIL = process.env.NOUS_ONLINE_EMAIL || LOCAL.email;
const PASSWORD = process.env.NOUS_ONLINE_PASSWORD || LOCAL.password;
const hasCredentials = Boolean(EMAIL && PASSWORD);

let electronApp;
let page;
let userDataDir;

test.skip(!hasCredentials, 'Brak danych konta PENDING (env lub online-account.local.json)');
test.setTimeout(60000);

test.beforeAll(async () => {
  if (!hasCredentials) return;
  userDataDir = await mkdtemp(path.join(os.tmpdir(), 'nous-online-e2e-'));
  electronApp = await electron.launch({
    args: [`--user-data-dir=${userDataDir}`, path.join(process.cwd(), 'main.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Stabilny język komunikatów (i18n zapisuje wybór w localStorage).
  await electronApp.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
      "localStorage.setItem('nous-language', 'pl')",
    ),
  );
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#login-choice-panel')).toBeVisible({ timeout: 15000 });
});

test.afterAll(async () => {
  if (electronApp) await electronApp.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

// Firebase trzyma sesję w profilu — przed każdym testem wyloguj, jeśli trzeba.
test.beforeEach(async () => {
  if (!hasCredentials) return;
  await page.waitForLoadState('domcontentloaded');
  const dashboard = page.locator('#dashboard-screen:not(.hidden)');
  const choice = page.locator('#login-choice-panel:not(.hidden)');
  await expect(dashboard.or(choice)).toBeVisible({ timeout: 15000 });
  if (await dashboard.isVisible()) {
    await page.click('#btn-logout');
    await page.waitForLoadState('domcontentloaded');
    await expect(choice).toBeVisible({ timeout: 15000 });
  }
});

async function loginOnline() {
  await expect(page.locator('#login-choice-panel')).toBeVisible({ timeout: 15000 });
  await page.click('#btn-choose-online');
  await expect(page.locator('#login-online-panel')).toBeVisible();
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('#btn-login');
  await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 30000 });
}

test.describe('Konto Online — status PENDING', () => {
  test('logowanie PENDING: badge i brak synchronizacji', async () => {
    await loginOnline();

    await expect(page.locator('#user-status-display')).toHaveText('Oczekujący');
    await expect(page.locator('#user-status-display')).toHaveAttribute('data-status', 'PENDING');
    await expect(page.locator('#sync-toggle-container')).toBeHidden();

    // enforceSyncPolicy zapisuje 'false' tylko wtedy, gdy autoSync był wcześniej
    // włączony — na świeżym profilu wartość jest po prostu nieustawiona.
    const autoSync = await page.evaluate(() => localStorage.getItem('autoSync'));
    expect(autoSync === null || autoSync === 'false').toBe(true);
  });

  test('wylogowanie i ponowne logowanie nie zostaje w ekranie logowania', async () => {
    await loginOnline();

    await page.click('#btn-logout');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#login-choice-panel')).toBeVisible({ timeout: 15000 });

    // Ponowny signIn po wylogowaniu musi znów uruchomić aplikację.
    await loginOnline();
    await expect(page.locator('#user-status-display')).toHaveText('Oczekujący');
  });
});
