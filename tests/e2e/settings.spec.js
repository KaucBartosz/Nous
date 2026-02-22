import { test, expect } from '@playwright/test';

// ==========================================================
// Testy E2E - Ustawienia
// ==========================================================

test.describe('Ustawienia', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Zaloguj jako gość
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Przejdź do ustawień
    await page.click('#nav-settings');
    await expect(page.locator('#settings-view')).toBeVisible();
  });

  test('można przełączyć motyw na ciemny', async ({ page }) => {
    // Kliknij radio button dla motywu ciemnego
    await page.check('input[name="theme"][value="dark"]');
    
    // Sprawdź czy radio jest zaznaczony
    await expect(page.locator('input[name="theme"][value="dark"]')).toBeChecked();
  });

  test('można przełączyć motyw na jasny', async ({ page }) => {
    // Kliknij radio button dla motywu jasnego
    await page.check('input[name="theme"][value="light"]');
    
    // Sprawdź czy radio jest zaznaczony
    await expect(page.locator('input[name="theme"][value="light"]')).toBeChecked();
  });

  test('można przełączyć motyw na własny', async ({ page }) => {
    // Kliknij radio button dla motywu własnego
    await page.check('input[name="theme"][value="custom"]');
    
    // Sprawdź czy radio jest zaznaczony
    await expect(page.locator('input[name="theme"][value="custom"]')).toBeChecked();
    
    // Sprawdź czy sekcja zarządzania motywami jest widoczna
    await expect(page.locator('#custom-theme-management')).toBeVisible();
  });

  test('przycisk zapisz ustawienia jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-save-settings')).toBeVisible();
    await expect(page.locator('#btn-save-settings')).toContainText('Zapisz Ustawienia');
  });

  test('przycisk reset ustawień jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-reset-settings')).toBeVisible();
    await expect(page.locator('#btn-reset-settings')).toContainText('Przywróć Domyślne');
  });

  test('color pickery są widoczne w sekcji ustawień', async ({ page }) => {
    // Sprawdź czy color pickery istnieją
    await expect(page.locator('#primary-color-picker')).toBeVisible();
    await expect(page.locator('#bg-dark-picker')).toBeVisible();
    await expect(page.locator('#text-main-picker')).toBeVisible();
  });

  test('sekcja podglądu elementów jest widoczna', async ({ page }) => {
    // Sprawdź czy podgląd przycisków istnieje
    const previewSection = page.locator('.settings-preview');
    await expect(previewSection).toBeVisible();
    
    // Sprawdź czy przykładowe przyciski są widoczne
    await expect(previewSection.locator('.btn.primary')).toBeVisible();
    await expect(previewSection.locator('.btn.secondary')).toBeVisible();
    await expect(previewSection.locator('.btn.outline')).toBeVisible();
  });
});

test.describe('Biblioteka testów', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('biblioteka pokazuje grid testów', async ({ page }) => {
    // Sprawdź czy kontener testów istnieje
    await expect(page.locator('#tests-grid')).toBeVisible();
  });

  test('można wyszukać test', async ({ page }) => {
    // Wpisz w wyszukiwarkę
    const searchInput = page.locator('#library-search');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('reakcja');
    
    // Sprawdź czy wartość została wpisana
    await expect(searchInput).toHaveValue('reakcja');
  });

  test('przełączniki widoku są widoczne', async ({ page }) => {
    // Sprawdź czy przyciski przełączania widoku istnieją
    await expect(page.locator('#view-grid')).toBeVisible();
    await expect(page.locator('#view-list')).toBeVisible();
    await expect(page.locator('#view-table')).toBeVisible();
    await expect(page.locator('#view-compact')).toBeVisible();
  });

  test('przełącznik trybu treningowego jest widoczny', async ({ page }) => {
    await expect(page.locator('#toggle-training-mode')).toBeVisible();
  });

  test('przełącznik trybu HPM jest widoczny', async ({ page }) => {
    await expect(page.locator('#toggle-hpm')).toBeVisible();
  });
});

test.describe('Historia wyników', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Przejdź do historii
    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
  });

  test('tabela historii jest widoczna', async ({ page }) => {
    await expect(page.locator('#history-table')).toBeVisible();
  });

  test('przycisk eksportu CSV jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-export-csv')).toBeVisible();
  });

  test('nagłówki tabeli historii są poprawne', async ({ page }) => {
    const headers = page.locator('#history-table thead th');
    await expect(headers.nth(0)).toContainText('Data');
    await expect(headers.nth(1)).toContainText('Test');
    await expect(headers.nth(2)).toContainText('ID Badanego');
    await expect(headers.nth(3)).toContainText('Wynik');
    await expect(headers.nth(4)).toContainText('Status');
    await expect(headers.nth(5)).toContainText('Akcje');
  });
});

test.describe('Aktualizacje', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Przejdź do aktualizacji
    await page.click('#nav-updates');
    await expect(page.locator('#updates-view')).toBeVisible();
  });

  test('sekcja aktualizacji programu jest widoczna', async ({ page }) => {
    await expect(page.locator('.app-update-container')).toBeVisible();
    await expect(page.locator('#app-current-version')).toBeVisible();
  });

  test('przycisk sprawdzania aktualizacji jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-check-app-update')).toBeVisible();
  });

  test('tabela stanu testów jest widoczna', async ({ page }) => {
    await expect(page.locator('#updates-table')).toBeVisible();
  });

  test('pole wyszukiwania w aktualizacjach jest widoczne', async ({ page }) => {
    await expect(page.locator('#updates-search')).toBeVisible();
  });
});

test.describe('Metryczka', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Przejdź do metryczki
    await page.click('#nav-demographics');
    await expect(page.locator('#demographics-view')).toBeVisible();
  });

  test('formularz metryczki jest widoczny', async ({ page }) => {
    await expect(page.locator('#dynamic-demo-form')).toBeVisible();
  });

  test('przycisk zapisz dane sesji jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-save-demo')).toBeVisible();
  });

  test('przycisk wyczyść jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-clear-demo')).toBeVisible();
  });

  test('selektor szablonów metryczki jest widoczny', async ({ page }) => {
    await expect(page.locator('#demo-template-select')).toBeVisible();
  });
});

test.describe('Kreator metryczek', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Przejdź do kreatora
    await page.click('#nav-demo-creator');
    await expect(page.locator('#demo-creator-view')).toBeVisible();
  });

  test('pole nazwy szablonu jest widoczne', async ({ page }) => {
    await expect(page.locator('#creator-template-name')).toBeVisible();
  });

  test('przycisk dodaj pole jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-add-field')).toBeVisible();
  });

  test('przycisk zapisz szablon jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-save-template')).toBeVisible();
  });

  test('przycisk importu szablonu jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-import-template')).toBeVisible();
  });

  test('lista istniejących szablonów jest widoczna', async ({ page }) => {
    await expect(page.locator('#existing-templates-list')).toBeVisible();
  });
});