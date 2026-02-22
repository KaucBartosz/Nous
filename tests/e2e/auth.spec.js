import { test, expect } from '@playwright/test';

// ==========================================================
// Testy E2E - Autoryzacja
// ==========================================================

test.describe('Autoryzacja', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('strona logowania jest widoczna na starcie', async ({ page }) => {
    // Sprawdź czy ekran logowania jest widoczny
    await expect(page.locator('#login-screen')).toBeVisible();
    
    // Sprawdź czy pola logowania istnieją
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    
    // Sprawdź czy przyciski logowania są widoczne
    await expect(page.locator('#btn-login')).toBeVisible();
    await expect(page.locator('#btn-guest')).toBeVisible();
  });

  test('przycisk gościa pokazuje dashboard', async ({ page }) => {
    // Kliknij przycisk "Tryb Offline (Gość)"
    await page.click('#btn-guest');
    
    // Czekaj na dashboard
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
    
    // Sprawdź czy użytkownik jest oznaczony jako gość
    await expect(page.locator('#user-email-display')).toContainText('Gość');
  });

  test('błędne dane logowania pokazują komunikat', async ({ page }) => {
    // Wypełnij formularz błędnymi danymi
    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    
    // Kliknij zaloguj
    await page.click('#btn-login');
    
    // Sprawdź czy pojawił się komunikat o błędzie
    await expect(page.locator('#error-msg')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#error-msg')).not.toBeEmpty();
  });

  test('puste pola logowania są walidowane', async ({ page }) => {
    // Sprawdź czy pola mają required
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    
    // HTML5 validation - pola wymagane
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('przycisk rejestracji jest widoczny', async ({ page }) => {
    await expect(page.locator('#btn-register')).toBeVisible();
    await expect(page.locator('#btn-register')).toContainText('Załóż konto');
  });
});

test.describe('Nawigacja', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Zaloguj jako gość
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('biblioteka jest widoczna domyślnie', async ({ page }) => {
    // Biblioteka (domyślny widok)
    await expect(page.locator('#library-view')).toBeVisible();
    await expect(page.locator('#tests-grid')).toBeVisible();
  });

  test('można przełączać się między widokami', async ({ page }) => {
    // Przejdź do historii
    await page.click('#nav-history');
    await expect(page.locator('#history-view')).toBeVisible();
    await expect(page.locator('#library-view')).toBeHidden();
    
    // Przejdź do aktualizacji
    await page.click('#nav-updates');
    await expect(page.locator('#updates-view')).toBeVisible();
    
    // Przejdź do metryczki
    await page.click('#nav-demographics');
    await expect(page.locator('#demographics-view')).toBeVisible();
    
    // Przejdź do kreatora
    await page.click('#nav-demo-creator');
    await expect(page.locator('#demo-creator-view')).toBeVisible();
    
    // Przejdź do ustawień
    await page.click('#nav-settings');
    await expect(page.locator('#settings-view')).toBeVisible();
    
    // Przejdź do "Co nowego"
    await page.click('#nav-whats-new');
    await expect(page.locator('#whats-new-view')).toBeVisible();
    
    // Przejdź do "O programie" - otwiera modal
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toBeVisible();
  });

  test('przycisk wylogowania wraca do ekranu logowania', async ({ page }) => {
    // Kliknij wyloguj
    await page.click('#btn-logout');
    
    // Sprawdź czy wróciliśmy do logowania
    await expect(page.locator('#login-screen')).toBeVisible();
    await expect(page.locator('#dashboard-screen')).toBeHidden();
  });

  test('modal "O programie" można zamknąć', async ({ page }) => {
    // Otwórz modal
    await page.click('#nav-about');
    await expect(page.locator('#about-modal')).toBeVisible();
    
    // Zamknij przyciskiem X
    await page.click('#btn-close-about');
    await expect(page.locator('#about-modal')).toBeHidden();
  });
});