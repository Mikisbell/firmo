/**
 * E2E Test: Invoicing & QR Features
 * Tests SUNAT invoicing, Yape/Plin QR, and table QR
 */
import { test, expect } from '@playwright/test';

test.describe('Invoicing & QR Features', () => {
  test('should load invoicing admin page', async ({ page }) => {
    await page.goto('/admin/facturacion');
    await expect(page.locator('text=Facturación')).toBeVisible({ timeout: 10000 });
  });

  test('should load Yape/Plin config page', async ({ page }) => {
    await page.goto('/admin/configuracion/yape-plin');
    await expect(page.locator('text=Yape')).toBeVisible({ timeout: 10000 });
  });

  test('should load table QR page', async ({ page }) => {
    await page.goto('/admin/mesas/qr');
    await expect(page.locator('text=QR')).toBeVisible({ timeout: 10000 });
  });
});
