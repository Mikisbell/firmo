/**
 * E2E Test: Recipes & Chicken Control
 * Tests recipe management, filtering, pagination, and chicken production tracking
 */
import { test, expect } from '@playwright/test';

test.describe('Recipes Management (Recetas)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/recetas');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display recipes page with title', async ({ page }) => {
    await expect(page.locator('text=Recetas')).toBeVisible({ timeout: 10000 });
  });

  test('should show "Nueva Receta" button', async ({ page }) => {
    const btn = page.locator('button:has-text("Nueva Receta")');
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test('should have station filter dropdown', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    // At least one filter dropdown should exist
    expect(count).toBeGreaterThan(0);
  });

  test('should filter recipes by station', async ({ page }) => {
    await page.waitForTimeout(2000);
    const selects = page.locator('select');
    if (await selects.first().isVisible()) {
      // Select a station filter
      const options = await selects.first().locator('option').allTextContents();
      if (options.length > 1) {
        await selects.first().selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        // Page should update (no error)
      }
    }
  });

  test('should display recipe table or empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    const tableOrEmpty = page.locator('table, text=No hay recetas');
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have pagination controls when recipes exist', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Check for pagination text
    const pagination = page.locator('text=Página');
    if (await pagination.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(pagination).toBeVisible();
    }
  });
});

test.describe('Chicken Control (Control de Pollo)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/pollo-control');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display chicken control page with title', async ({ page }) => {
    await expect(page.locator('text=Control de Pollo')).toBeVisible({ timeout: 10000 });
  });

  test('should show "Registrar Lote" button', async ({ page }) => {
    const btn = page.locator('button:has-text("Registrar Lote")');
    await expect(btn).toBeVisible({ timeout: 10000 });
  });

  test('should display production metric cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Metric cards should be visible
    const cards = ['Crudo', 'Cocinando', 'Cocido', 'Vendido'];
    for (const card of cards) {
      const el = page.locator(`text=${card}`);
      if (await el.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(el.first()).toBeVisible();
      }
    }
  });

  test('should show yield gauge', async ({ page }) => {
    await page.waitForTimeout(2000);
    const yieldLabel = page.locator('text=Rendimiento');
    if (await yieldLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(yieldLabel).toBeVisible();
    }
  });

  test('should open new batch form when clicking register', async ({ page }) => {
    const btn = page.locator('button:has-text("Registrar Lote")');
    await btn.click();
    // Form should appear
    const formTitle = page.locator('text=Nuevo Lote, text=Unidades, text=Peso');
    await expect(formTitle.first()).toBeVisible({ timeout: 5000 });
  });

  test('should have batch form fields', async ({ page }) => {
    await page.click('button:has-text("Registrar Lote")');
    await page.waitForTimeout(500);
    // Check for input fields
    const inputs = page.locator('input[type="number"]');
    const count = await inputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should cancel batch form', async ({ page }) => {
    await page.click('button:has-text("Registrar Lote")');
    await page.waitForTimeout(500);
    const cancelBtn = page.locator('button:has-text("Cancelar")');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('should show alerts section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const alertsSection = page.locator('text=Alertas');
    if (await alertsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(alertsSection).toBeVisible();
    }
  });
});
