import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';
import os from 'os';
import { readFile, rm, stat, readdir } from 'fs/promises';

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

test.describe('Electron App - Eksport CSV (historyExport)', () => {
  // Seeduje jawny (nieszyfrowany) wynik gościa wprost do IndexedDB.
  // Stałe id = idempotentne między przebiegami (put nadpisuje).
  async function seedGuestResult() {
    await page.evaluate(() => new Promise((resolve, reject) => {
      const open = indexedDB.open('NousDB');
      open.onsuccess = () => {
        const db = open.result;
        const now = new Date().toISOString();
        const tx = db.transaction('results', 'readwrite');
        tx.objectStore('results').put({
          id: 'e2e-seed-csv-1',
          test_id: 'stroop',
          timestamp: now,
          created_at: now,
          subject_id: 'P1',
          researcher_uid: 'GUEST',
          wyniki: { score: 5 },
          sync_status: 'LOCAL',
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    }));
  }

  test('eksport CSV bieżącego widoku zapisuje plik z danymi', async () => {
    await loginAsGuest();
    await seedGuestResult();

    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
    // Seeded wiersz renderuje tabela (split 3/3 w żywej aplikacji)
    await expect(page.locator('#history-view td', { hasText: 'stroop' }).first())
      .toBeVisible({ timeout: 15000 });

    // Electron nie emituje eventu 'download' do Playwright — asercja na pliku.
    // (downloadFile() to czysty Blob + anchor, bez dialogu systemowego.)
    const downloadsDir = await electronApp.evaluate(({ app }) => app.getPath('downloads'))
      .catch(() => path.join(os.homedir(), 'Downloads'));
    const csvPath = path.join(downloadsDir, 'historia_wynikow.csv');
    await rm(csvPath, { force: true });

    await page.click('#btn-export-csv');
    await expect.poll(async () => {
      try {
        await stat(csvPath);
        return true;
      } catch {
        return false;
      }
    }, { timeout: 15000 }).toBe(true);

    const content = await readFile(csvPath, 'utf-8');
    // CSV macierzowy bieżącego widoku (nagłówek = unia kluczy)
    expect(content).toContain('Test ID');
    expect(content).toContain('stroop');
    expect(content).toContain('P1');
    await rm(csvPath, { force: true });
  });

  test('eksport ZIP zapisuje cicho do Downloads (bez okna systemowego)', async () => {
    await loginAsGuest();
    await seedGuestResult();

    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
    await expect(page.locator('#history-view td', { hasText: 'stroop' }).first())
      .toBeVisible({ timeout: 15000 });

    const downloadsDir = await electronApp.evaluate(({ app }) => app.getPath('downloads'))
      .catch(() => path.join(os.homedir(), 'Downloads'));
    const zipsBefore = new Set(
      (await readdir(downloadsDir)).filter((f) => f.endsWith('.zip')),
    );

    // handleDownloadAllLocal('GUEST') → bulkZip → cichy zapis, brak dialogu.
    await page.click('#btn-local-download-all');

    let newZip = null;
    await expect.poll(async () => {
      const after = (await readdir(downloadsDir)).filter((f) => f.endsWith('.zip'));
      newZip = after.find((f) => !zipsBefore.has(f) && f.startsWith('Wyniki_')) || null;
      return newZip;
    }, { timeout: 20000 }).not.toBeNull();

    const zipStat = await stat(path.join(downloadsDir, newZip));
    expect(zipStat.size).toBeGreaterThan(0);
    await rm(path.join(downloadsDir, newZip), { force: true });
  });
});
