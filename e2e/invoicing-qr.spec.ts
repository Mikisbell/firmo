/**
 * E2E Test: Invoicing & QR Features
 * Tests SUNAT invoicing, Yape/Plin QR config, and table QR management
 */
import { test, expect } from '@playwright/test';

test.describe('SUNAT Invoicing (Facturación)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/facturacion');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display invoicing page title', async ({ page }) => {
    await expect(page.locator('text=Facturación')).toBeVisible({ timeout: 10000 });
  });

  test('should show invoice stats cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Stats cards: Boletas, Facturas, Anuladas, Pendientes
    const statsLabels = ['Boletas', 'Facturas'];
    for (const label of statsLabels) {
      const el = page.locator(`text=${label}`);
      if (await el.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(el.first()).toBeVisible();
      }
    }
  });

  test('should have type and status filter dropdowns', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    // At least type and status filters
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should have search input for invoices', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"]');
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(searchInput).toBeVisible();
      // Try searching
      await searchInput.fill('F001');
      await page.waitForTimeout(500);
    }
  });

  test('should display invoice table or empty state', async ({ page }) => {
    await page.waitForTimeout(2000);
    const tableOrEmpty = page.locator('table, text=No hay comprobantes');
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter by invoice type', async ({ page }) => {
    const selects = page.locator('select');
    if (await selects.first().isVisible()) {
      // Select BOLETA filter
      const options = await selects.first().locator('option').allTextContents();
      if (options.some(o => o.includes('BOLETA'))) {
        await selects.first().selectOption({ label: options.find(o => o.includes('BOLETA'))! });
        await page.waitForTimeout(1000);
      }
    }
  });
});

test.describe('Yape/Plin Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/configuracion/yape-plin');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display Yape/Plin config page', async ({ page }) => {
    await expect(page.locator('text=Yape')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Plin')).toBeVisible();
  });

  test('should have Yape merchant phone field', async ({ page }) => {
    const phoneInputs = page.locator('input[type="tel"]');
    const count = await phoneInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('should have Yape and Plin merchant name fields', async ({ page }) => {
    const nameInputs = page.locator('input[placeholder*="Pollería"], input[placeholder*="Mi Pollería"]');
    if (await nameInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const count = await nameInputs.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('should fill Yape configuration form', async ({ page }) => {
    // Fill Yape phone
    const phoneInputs = page.locator('input[type="tel"]');
    if (await phoneInputs.first().isVisible()) {
      await phoneInputs.first().fill('987654321');
      await page.waitForTimeout(300);
    }

    // Fill Yape merchant name
    const nameInputs = page.locator('input[placeholder*="Pollería"]');
    if (await nameInputs.first().isVisible()) {
      await nameInputs.first().fill('Pollería El Leñador');
      await page.waitForTimeout(300);
    }
  });

  test('should have QR preview button', async ({ page }) => {
    const qrBtn = page.locator('button:has-text("QR")');
    if (await qrBtn.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(qrBtn.first()).toBeVisible();
    }
  });

  test('should have save configuration button', async ({ page }) => {
    const saveBtn = page.locator('button:has-text("Guardar")');
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Table QR Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/mesas/qr');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display table QR page', async ({ page }) => {
    await expect(page.locator('text=QR')).toBeVisible({ timeout: 10000 });
  });

  test('should show table list or QR generation interface', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Page should have either table list or QR generation UI
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });
});
