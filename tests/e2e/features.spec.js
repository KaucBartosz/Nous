import { test, expect } from '@playwright/test';

// ==========================================================
// Testy E2E - Funkcje dodatkowe (Co nowego, logowanie lokalne, modale, PIN)
// ==========================================================

test.describe('Logowanie lokalne', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('panel logowania lokalnego jest widoczny po kliknięciu', async ({ page }) => {
    await expect(page.locator('#btn-choose-local')).toBeVisible();
    await page.click('#btn-choose-local');

    await expect(page.locator('#login-local-panel')).toBeVisible();
    await expect(page.locator('#login-online-panel')).not.toBeVisible();
  });

  test('panel logowania online jest widoczny po kliknięciu', async ({ page }) => {
    await expect(page.locator('#btn-choose-online')).toBeVisible();
    await page.click('#btn-choose-online');

    await expect(page.locator('#login-online-panel')).toBeVisible();
    await expect(page.locator('#login-local-panel')).not.toBeVisible();
  });

  test('można wrócić z panelu lokalnego do wyboru', async ({ page }) => {
    await page.click('#btn-choose-local');
    await expect(page.locator('#login-local-panel')).toBeVisible();

    await page.click('#btn-back-local');
    await expect(page.locator('#login-local-panel')).toHaveClass(/hidden/);
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });

  test('można wrócić z panelu online do wyboru', async ({ page }) => {
    await page.click('#btn-choose-online');
    await expect(page.locator('#login-online-panel')).toBeVisible();

    await page.click('#btn-back-online');
    await expect(page.locator('#login-online-panel')).toHaveClass(/hidden/);
    await expect(page.locator('#login-choice-panel')).toBeVisible();
  });

  test('pola logowania lokalnego są widoczne', async ({ page }) => {
    await page.click('#btn-choose-local');

    await expect(page.locator('#local-username')).toBeVisible();
    await expect(page.locator('#local-password')).toBeVisible();
    await expect(page.locator('#btn-login-local')).toBeVisible();
    await expect(page.locator('#btn-register-local')).toBeVisible();
  });

  test('przycisk hasła lokalnego jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-toggle-local-password')).toBeVisible();
  });

  test('przycisk hasła online jest widoczny', async ({ page }) => {
    await page.click('#btn-choose-online');
    await expect(page.locator('#btn-toggle-password')).toBeVisible();
  });
});

test.describe('Co nowego?', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await page.click('#nav-whats-new');
    await expect(page.locator('#whats-new-view')).toBeVisible();
  });

  test('widok Co nowego jest widoczny', async ({ page }) => {
    await expect(page.locator('#whats-new-content')).toBeVisible();
  });

  test('nawigacja wersji jest widoczna', async ({ page }) => {
    await expect(page.locator('#btn-prev-release')).toBeVisible();
    await expect(page.locator('#btn-next-release')).toBeVisible();
    await expect(page.locator('#release-nav-index')).toBeVisible();
  });

  test('przycisk odświeżania jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-refresh-whats-new')).toBeVisible();
  });

  test('przycisk otwarcia GitHub jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-open-github')).toBeVisible();
    await expect(page.locator('#btn-open-github')).toContainText('Otwórz GitHub');
  });

  test('widok błędu ładowania istnieje', async ({ page }) => {
    await expect(page.locator('#whats-new-error')).toBeVisible();
  });
});

test.describe('Modal zmiany hasła', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('przycisk zmiany hasła jest widoczny dla użytkownika lokalnego', async ({ page }) => {
    // Przycisk jest hidden domyślnie dla gości, ale istnieje
    await expect(page.locator('#btn-change-local-password')).toBeVisible();
  });

  test('modal zmiany hasła ma poprawne pola', async ({ page }) => {
    await expect(page.locator('#cp-old-password')).toBeVisible();
    await expect(page.locator('#cp-new-password')).toBeVisible();
    await expect(page.locator('#cp-confirm-password')).toBeVisible();
  });

  test('modal zmiany hasła ma przyciski akcji', async ({ page }) => {
    await expect(page.locator('#btn-cancel-change-password')).toBeVisible();
    await expect(page.locator('#btn-submit-change-password')).toBeVisible();
  });

  test('modal zmiany hasła ma nagłówek', async ({ page }) => {
    await expect(page.locator('#change-password-modal h3')).toContainText('Zmień hasło');
  });

  test('modal zmiany hasła można zamknąć', async ({ page }) => {
    await expect(page.locator('#btn-close-change-password')).toBeVisible();
  });
});

test.describe('Modal wyników', () => {

  test('modal wyników istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#results-modal')).toBeVisible();
  });

  test('modal wyników ma przycisk zamknięcia', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-close-modal')).toBeVisible();
  });

  test('modal wyników ma przycisk odrzucenia', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-discard')).toBeVisible();
    await expect(page.locator('#btn-discard')).toContainText('Odrzuć');
  });

  test('modal wyników ma przycisk wysyłania do chmury', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-upload-cloud')).toBeVisible();
    await expect(page.locator('#btn-upload-cloud')).toContainText('Wyślij do Chmury');
  });

  test('modal wyników ma sekcję trybu treningowego', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#training-results-content')).toBeVisible();
  });

  test('modal wyników ma sekcję normalnych wyników', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#normal-results-content')).toBeVisible();
  });

  test('modal wyników ma podpowiedź o historii', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.results-hint')).toContainText('Historia Wyników');
  });
});

test.describe('Modal O programie', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('modal O programie zawiera logo', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#about-modal img')).toBeVisible();
  });

  test('modal O programie zawiera nazwę aplikacji', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toContainText('Nous');
  });

  test('modal O programie zawiera informacje o autorze', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toContainText('Bartosz Kauc');
  });

  test('modal O programie zawiera przycisk strony projektu', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#btn-about-project')).toBeVisible();
    await expect(page.locator('#btn-about-project')).toContainText('Strona projektu');
  });

  test('modal O programie można zamknąć', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toBeVisible();

    await page.click('#btn-close-about');
    await expect(page.locator('#about-modal')).toHaveClass(/hidden/);
  });

  test('modal O programie można zamknąć przyciskiem w stopce', async ({ page }) => {
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toBeVisible();

    await page.click('#btn-about-close-footer');
    await expect(page.locator('#about-modal')).toHaveClass(/hidden/);
  });
});

test.describe('Modale PIN i szyfrowania', () => {

  test('modal ustawienia PIN istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pin-setup-modal')).toBeVisible();
  });

  test('modal ustawienia PIN ma pole ввода', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pin-setup-input')).toBeVisible();
    await expect(page.locator('#pin-setup-input')).toHaveAttribute('maxlength', '6');
  });

  test('modal ustawienia PIN ma przycisk zapisu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-save-pin')).toBeVisible();
    await expect(page.locator('#btn-save-pin')).toContainText('Zapisz PIN');
  });

  test('modal wprowadzania PIN istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pin-enter-modal')).toBeVisible();
  });

  test('modal wprowadzania PIN ma pole ввода', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pin-enter-input')).toBeVisible();
    await expect(page.locator('#pin-enter-input')).toHaveAttribute('maxlength', '6');
  });

  test('modal wprowadzania PIN ma przycisk odblokowania', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-submit-pin')).toBeVisible();
    await expect(page.locator('#btn-submit-pin')).toContainText('Odblokuj');
  });

  test('modal wprowadzania PIN ma link zapomniałem PIN', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#link-forgot-pin')).toBeVisible();
    await expect(page.locator('#link-forgot-pin')).toContainText('Zapomniałem PIN-u');
  });

  test('modal odzyskiwania PIN istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#pin-recovery-modal')).toBeVisible();
  });

  test('modal odzyskiwania PIN ma pole kodu ratunkowego', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#recovery-code-input')).toBeVisible();
  });

  test('modal odzyskiwania PIN ma pole nowego PIN', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#new-pin-input')).toBeVisible();
    await expect(page.locator('#new-pin-input')).toHaveAttribute('maxlength', '6');
  });

  test('modal odzyskiwania PIN ma przycisk odzyskiwania', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-submit-recovery')).toBeVisible();
    await expect(page.locator('#btn-submit-recovery')).toContainText('Odzyskaj Klucz');
  });

  test('modal kodu odzyskiwania istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#recovery-key-modal')).toBeVisible();
  });

  test('modal kodu odzyskiwania ma wyświetlacz kodu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#recovery-key-display')).toBeVisible();
  });

  test('modal kodu odzyskiwania ma przycisk potwierdzenia', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-understood-recovery')).toBeVisible();
    await expect(page.locator('#btn-understood-recovery')).toContainText('Skopiowałem');
  });
});

test.describe('Custom Dialog Modal', () => {

  test('modal custom dialog istnieje w DOM', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#custom-dialog-modal')).toBeVisible();
  });

  test('modal custom dialog ma tytuł', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#custom-dialog-title')).toBeVisible();
  });

  test('modal custom dialog ma ikonę', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#custom-dialog-icon')).toBeVisible();
  });

  test('modal custom dialog ma treść komunikatu', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#custom-dialog-message')).toBeVisible();
  });

  test('modal custom dialog ma stopkę z przyciskami', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#custom-dialog-footer')).toBeVisible();
  });

  test('modal custom dialog można zamknąć', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-close-custom-dialog')).toBeVisible();
  });
});

test.describe('Tryb treningowy i HPM', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('przełącznik trybu treningowego działa', async ({ page }) => {
    await expect(page.locator('#toggle-training-mode')).toBeVisible();

    await page.check('#toggle-training-mode');
    await expect(page.locator('#toggle-training-mode')).toBeChecked();

    await page.uncheck('#toggle-training-mode');
    await expect(page.locator('#toggle-training-mode')).not.toBeChecked();
  });

  test('przełącznik HPM działa', async ({ page }) => {
    await expect(page.locator('#toggle-hpm')).toBeVisible();

    await page.check('#toggle-hpm');
    await expect(page.locator('#toggle-hpm')).toBeChecked();

    await page.uncheck('#toggle-hpm');
    await expect(page.locator('#toggle-hpm')).not.toBeChecked();
  });

  test('ikony informacyjne trybów są widoczne', async ({ page }) => {
    await expect(page.locator('#training-info-icon')).toBeVisible();
    await expect(page.locator('#hpm-info-icon')).toBeVisible();
  });
});

test.describe('Synchronizacja', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('przełącznik synchronizacji jest widoczny', async ({ page }) => {
    await expect(page.locator('#toggle-sync')).toBeVisible();
  });

  test('etykieta statusu synchronizacji jest widoczna', async ({ page }) => {
    await expect(page.locator('#sync-status-label')).toBeVisible();
    await expect(page.locator('#sync-status-label')).toContainText('SYNC');
  });
});

test.describe('Widoki biblioteki', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('można przełączać widok na siatkę', async ({ page }) => {
    await expect(page.locator('#view-grid')).toBeVisible();
    await page.click('#view-grid');
    await expect(page.locator('#view-grid')).toHaveClass(/active/);
  });

  test('można przełączać widok na listę', async ({ page }) => {
    await expect(page.locator('#view-list')).toBeVisible();
    await page.click('#view-list');
    await expect(page.locator('#view-list')).toHaveClass(/active/);
  });

  test('można przełączać widok na tabelę', async ({ page }) => {
    await expect(page.locator('#view-table')).toBeVisible();
    await page.click('#view-table');
    await expect(page.locator('#view-table')).toHaveClass(/active/);
  });

  test('można przełączać widok na kompaktowy', async ({ page }) => {
    await expect(page.locator('#view-compact')).toBeVisible();
    await page.click('#view-compact');
    await expect(page.locator('#view-compact')).toHaveClass(/active/);
  });

  test('wyszukiwarka biblioteki jest widoczna', async ({ page }) => {
    await expect(page.locator('#library-search')).toBeVisible();
    await expect(page.locator('#library-search')).toHaveAttribute('placeholder', /Szukaj testu/);
  });

  test('można wyszukiwać testy', async ({ page }) => {
    const searchInput = page.locator('#library-search');
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
  });

  test('toggle testów lokalnych jest widoczny', async ({ page }) => {
    await expect(page.locator('#show-local-tests-toggle')).toBeVisible();
  });

  test('ścieżka testów lokalnych jest widoczna', async ({ page }) => {
    await expect(page.locator('#local-tests-path')).toBeVisible();
  });
});

test.describe('Kartoteka Badanych', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await page.click('#nav-demographics');
    await expect(page.locator('#demographics-view')).toBeVisible();
  });

  test('lista badanych jest widoczna', async ({ page }) => {
    await expect(page.locator('#participants-list')).toBeVisible();
  });

  test('wyszukiwarka badanych jest widoczna', async ({ page }) => {
    await expect(page.locator('#participants-search')).toBeVisible();
  });

  test('panel badanych ma nagłówek', async ({ page }) => {
    await expect(page.locator('.participants-panel-title')).toContainText('Kartoteka Badanych');
  });

  test('przycisk zapisu do kartoteki jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-save-to-registry')).toBeVisible();
    await expect(page.locator('#btn-save-to-registry')).toContainText('Zapisz do Kartoteki');
  });

  test('pusty stan kartoteki jest widoczny', async ({ page }) => {
    await expect(page.locator('.participants-empty')).toContainText('Brak zapisanych badanych');
  });
});

test.describe('Historia - dodatkowe funkcje', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
  });

  test('checkbox zaznaczania wszystkich jest widoczny', async ({ page }) => {
    await expect(page.locator('#selectAllHistory')).toBeVisible();
  });

  test('selektor formatu pobierania jest widoczny', async ({ page }) => {
    const jsonRadio = page.locator('input[name="dl-format"][value="json"]');
    const csvRadio = page.locator('input[name="dl-format"][value="csv"]');

    await expect(jsonRadio).toBeVisible();
    await expect(csvRadio).toBeVisible();
  });

  test('radio CSV jest domyślnie zaznaczone', async ({ page }) => {
    await expect(page.locator('input[name="dl-format"][value="csv"]')).toBeChecked();
  });

  test('przycisk pobierania gości jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-guest-download-all')).toBeVisible();
  });

  test('przycisk importowania wyników gości jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-guest-import-all')).toBeVisible();
  });

  test('przycisk pobierania lokalnych wyników jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-local-download-all')).toBeVisible();
  });
});

test.describe('Aktualizacje - dodatkowe funkcje', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await page.click('#nav-updates');
    await expect(page.locator('#updates-view')).toBeVisible();
  });

  test('nagłówki tabeli aktualizacji są poprawne', async ({ page }) => {
    const headers = page.locator('#updates-table thead th');
    await expect(headers.nth(0)).toContainText('Nazwa Testu');
    await expect(headers.nth(1)).toContainText('Wersja Lokalna');
    await expect(headers.nth(2)).toContainText('Wersja w Chmurze');
    await expect(headers.nth(3)).toContainText('Status');
    await expect(headers.nth(4)).toContainText('Akcja');
  });

  test('status aktualizacji aplikacji jest widoczny', async ({ page }) => {
    await expect(page.locator('#app-update-status')).toBeVisible();
  });

  test('pasek postępu aktualizacji istnieje', async ({ page }) => {
    await expect(page.locator('#app-update-bar')).toBeVisible();
  });

  test('przycisk pobierania aktualizacji istnieje', async ({ page }) => {
    await expect(page.locator('#btn-download-app-update')).toBeVisible();
  });

  test('przycisk instalowania aktualizacji istnieje', async ({ page }) => {
    await expect(page.locator('#btn-install-app-update')).toBeVisible();
  });
});

test.describe('Ustawienia - dodatkowe funkcje', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await page.click('#nav-settings');
    await expect(page.locator('#settings-view')).toBeVisible();
  });

  test('pole nazwy nowego motywu jest widoczne', async ({ page }) => {
    await expect(page.locator('#new-theme-name')).toBeVisible();
  });

  test('przycisk zapisu motywu jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-save-custom-theme')).toBeVisible();
  });

  test('przycisk usuwania motywu jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-delete-theme')).toBeVisible();
  });

  test('select zapisanych motywów jest widoczny', async ({ page }) => {
    await expect(page.locator('#saved-themes-select')).toBeVisible();
  });

  test('color pickery hover są widoczne', async ({ page }) => {
    await expect(page.locator('#primary-hover-picker')).toBeVisible();
  });

  test('color pickery ikon są widoczne', async ({ page }) => {
    await expect(page.locator('#icon-color-picker')).toBeVisible();
    await expect(page.locator('#icon-active-picker')).toBeVisible();
  });

  test('color pickery tekstu są widoczne', async ({ page }) => {
    await expect(page.locator('#text-muted-picker')).toBeVisible();
    await expect(page.locator('#text-inactive-tab-picker')).toBeVisible();
    await expect(page.locator('#text-test-name-picker')).toBeVisible();
    await expect(page.locator('#text-test-description-picker')).toBeVisible();
    await expect(page.locator('#button-text-picker')).toBeVisible();
  });

  test('color picker tła sidebar jest widoczny', async ({ page }) => {
    await expect(page.locator('#bg-sidebar-picker')).toBeVisible();
  });

  test('color picker obramowań jest widoczny', async ({ page }) => {
    await expect(page.locator('#border-color-picker')).toBeVisible();
  });

  test('status ustawień istnieje', async ({ page }) => {
    await expect(page.locator('#settings-status')).toBeVisible();
  });
});

test.describe('Wylogowywanie', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('przycisk wylogowania ma poprawny tytuł', async ({ page }) => {
    await expect(page.locator('#btn-logout')).toHaveAttribute('title', 'Wyloguj');
  });

  test('przycisk wylogowania ma ikonę', async ({ page }) => {
    const icon = page.locator('#btn-logout .material-icons');
    await expect(icon).toHaveText('logout');
  });
});

test.describe('Status użytkownika', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('status użytkownika jest widoczny po logowaniu gościa', async ({ page }) => {
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('#user-email-display')).toBeVisible();
    await expect(page.locator('#user-status-display')).toBeVisible();
  });

  test('avatar użytkownika jest widoczny', async ({ page }) => {
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });

    await expect(page.locator('.avatar-circle')).toBeVisible();
  });
});

test.describe('Nawigacja - stany aktywne', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('biblioteka jest domyślnie aktywna', async ({ page }) => {
    await expect(page.locator('#nav-library')).toHaveClass(/active/);
  });

  test('aktywna nawigacja zmienia się po kliknięciu historia', async ({ page }) => {
    await page.click('#nav-history');
    await expect(page.locator('#nav-history')).toHaveClass(/active/);
    await expect(page.locator('#nav-library')).not.toHaveClass(/active/);
  });

  test('aktywna nawigacja zmienia się po kliknięciu ustawienia', async ({ page }) => {
    await page.click('#nav-settings');
    await expect(page.locator('#nav-settings')).toHaveClass(/active/);
    await expect(page.locator('#nav-library')).not.toHaveClass(/active/);
  });

  test('badge aktualizacji jest widoczny', async ({ page }) => {
    await expect(page.locator('#updates-badge')).toBeVisible();
  });
});
