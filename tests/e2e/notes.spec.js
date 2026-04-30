import { test, expect } from '@playwright/test';

// ==========================================================
// Testy E2E - Zarządzanie Notatkami (CRUD)
// ==========================================================

test.describe('Zarządzanie Notatkami', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-guest');
    await expect(page.locator('#dashboard-screen')).toBeVisible({ timeout: 10000 });
  });

  test('można dodać nową notatkę', async ({ page }) => {
    await expect(page.locator('#btn-add-note')).toBeVisible();

    await page.fill('#note-title', 'Testowa notatka');
    await page.fill('#note-content', 'To jest treść testowej notatki.');
    await page.click('#btn-save-note');

    await expect(page.locator('.note-item')).toContainText('Testowa notatka');
  });

  test('można odczytać listę notatek', async ({ page }) => {
    await page.fill('#note-title', 'Notatka 1');
    await page.fill('#note-content', 'Treść pierwszej notatki.');
    await page.click('#btn-save-note');

    await page.fill('#note-title', 'Notatka 2');
    await page.fill('#note-content', 'Treść drugiej notatki.');
    await page.click('#btn-save-note');

    const noteCount = await page.locator('.note-item').count();
    expect(noteCount).toBe(2);
  });

  test('można edytować istniejącą notatkę', async ({ page }) => {
    await page.fill('#note-title', 'Do edycji');
    await page.fill('#note-content', 'Treść do zmiany.');
    await page.click('#btn-save-note');

    const editButton = page.locator('.note-item button[aria-label="Edytuj"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    await page.fill('#note-title', 'Zmieniona notatka');
    await page.fill('#note-content', 'Nowa treść po edycji.');
    await page.click('#btn-save-note');

    const noteText = await page.locator('.note-item').textContent();
    expect(noteText).toContain('Zmieniona notatka');
  });

  test('można usunąć notatkę', async ({ page }) => {
    await page.fill('#note-title', 'Do usuwania');
    await page.fill('#note-content', 'Treść do usunięcia.');
    await page.click('#btn-save-note');

    const deleteButton = page.locator('.note-item button[aria-label="Usuń"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(page.locator('.note-item')).not.toContainText('Do usuwania');
  });

  test('można filtrować notatki po tytule', async ({ page }) => {
    await page.fill('#note-title', 'A');
    await page.click('#btn-save-note');

    await page.fill('#note-title', 'B');
    await page.click('#btn-save-note');

    await page.fill('#note-title', 'C');
    await page.click('#btn-save-note');

    const noteCount = await page.locator('.note-item').count();
    expect(noteCount).toBe(3);

    await page.fill('#search-notes', 'A');
    await page.click('#btn-search-notes');

    const filteredCount = await page.locator('.note-item').count();
    expect(filteredCount).toBe(1);
  });

  test('można sortować notatki po dacie', async ({ page }) => {
    await page.fill('#note-title', 'Stara');
    await page.click('#btn-save-note');

    await page.fill('#note-title', 'Nowa');
    await page.click('#btn-save-note');

    const sortByDateButton = page.locator('.sort-btn[data-sort="date"]');
    await expect(sortByDateButton).toBeVisible();
    await sortByDateButton.click();

    const firstNoteTitle = await page.locator('.note-item').first().textContent();
    expect(firstNoteTitle).toContain('Nowa');
  });

  test('można przeglądać notatki w trybie pełnego ekranu', async ({ page }) => {
    await page.fill('#note-title', 'Pełny ekran');
    await page.click('#btn-save-note');

    const fullscreenButton = page.locator('.note-item button[aria-label="Pełny ekran"]');
    await expect(fullscreenButton).toBeVisible();
    await fullscreenButton.click();

    await expect(page.locator('body')).toHaveClass('fullscreen');
  });

  test('można eksportować notatki jako plik', async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      await page.fill('#note-title', `Notatka ${i}`);
      await page.click('#btn-save-note');
    }

    const exportButton = page.locator('#btn-export-notes');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    await expect(page.locator('.file-dialog')).toBeVisible({ timeout: 5000 });
  });

  test('można importować notatki z pliku', async ({ page }) => {
    const importButton = page.locator('#btn-import-notes');
    await expect(importButton).toBeVisible();
    await importButton.click();

    await expect(page.locator('.file-dialog')).toBeVisible({ timeout: 5000 });
  });

  test('można usuwać wszystkie notatki', async ({ page }) => {
    for (let i = 1; i <= 3; i++) {
      await page.fill('#note-title', `Notatka ${i}`);
      await page.click('#btn-save-note');
    }

    const deleteAllButton = page.locator('#btn-delete-all-notes');
    await expect(deleteAllButton).toBeVisible();
    await deleteAllButton.click();

    await expect(page.locator('.note-item')).not.toBeVisible();
  });

  test('można edytować metadane notatki', async ({ page }) => {
    await page.fill('#note-title', 'Z tagami');
    await page.click('#btn-save-note');

    const editButton = page.locator('.note-item button[aria-label="Edytuj"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    const tagsInput = page.locator('#note-tags');
    await expect(tagsInput).toBeVisible();
    await tagsInput.fill('tag1,tag2');

    await page.click('#btn-save-note');

    const noteText = await page.locator('.note-item').textContent();
    expect(noteText).toContain('tag1');
  });

  test('można wyszukiwać notatki po treści', async ({ page }) => {
    await page.fill('#note-title', 'A');
    await page.fill('#note-content', 'Wyszukaj to słowo');
    await page.click('#btn-save-note');

    await page.fill('#note-title', 'B');
    await page.fill('#note-content', 'Różna treść');
    await page.click('#btn-save-note');

    await page.fill('#search-notes', 'Wyszukaj');
    await page.click('#btn-search-notes');

    const filteredCount = await page.locator('.note-item').count();
    expect(filteredCount).toBe(1);
  });

  test('można przeglądać notatki w trybie ciemnym', async ({ page }) => {
    const darkModeButton = page.locator('#btn-dark-mode');
    await expect(darkModeButton).toBeVisible();
    await darkModeButton.click();

    await expect(page.locator('body')).toHaveClass('dark-mode');
  });

  test('można przeglądać notatki w trybie jasnym', async ({ page }) => {
    const lightModeButton = page.locator('#btn-light-mode');
    await expect(lightModeButton).toBeVisible();
    await lightModeButton.click();

    await expect(page.locator('body')).toHaveClass('light-mode');
  });

  test('można usuwać notatkę po kliknięciu przycisku X', async ({ page }) => {
    await page.fill('#note-title', 'Do usuwania X');
    await page.click('#btn-save-note');

    const closeButton = page.locator('.note-item button[aria-label="Zamknij"]');
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    await expect(page.locator('.note-item')).not.toContainText('Do usuwania X');
  });

  test('można kopiować notatkę', async ({ page }) => {
    await page.fill('#note-title', 'Do kopiowania');
    await page.click('#btn-save-note');

    const copyButton = page.locator('.note-item button[aria-label="Kopiuj"]');
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    await expect(page.locator('#success-msg')).toContainText('Zakończono');
  });

  test('można wklejać notatkę', async ({ page }) => {
    await page.fill('#note-title', 'Źródło');
    await page.click('#btn-save-note');

    const pasteButton = page.locator('.note-item button[aria-label="Wklej"]');
    await expect(pasteButton).toBeVisible();
    await pasteButton.click();

    await expect(page.locator('#success-msg')).toContainText('Zakończono');
  });

  test('można przeglądać notatki w trybie listy', async ({ page }) => {
    const listViewButton = page.locator('#btn-list-view');
    await expect(listViewButton).toBeVisible();
    await listViewButton.click();

    await expect(page.locator('.note-item')).toBeVisible();
  });

  test('można przeglądać notatki w trybie kafelka', async ({ page }) => {
    const cardViewButton = page.locator('#btn-card-view');
    await expect(cardViewButton).toBeVisible();
    await cardViewButton.click();

    await expect(page.locator('.note-item')).toBeVisible();
  });

  test('można edytować przyciski w panelu bocznym', async ({ page }) => {
    const editSidebarButton = page.locator('#btn-edit-sidebar');
    await expect(editSidebarButton).toBeVisible();
    await editSidebarButton.click();

    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
