/**
 * E2E Test: Admin Finance Modules
 * Tests Petty Cash, Purchases, Reconciliation, P&L pages
 */
import { test, expect } from '@playwright/test';

test.describe('Admin Finance Modules', () => {
  test('should load petty cash page', async ({ page }) => {
    await page.goto('/admin/caja-chica');
    await expect(page.locator('text=Caja Chica')).toBeVisible({ timeout: 10000 });
  });

  test('should load purchases page', async ({ page }) => {
    await page.goto('/admin/compras');
    await expect(page.locator('text=Compras')).toBeVisible({ timeout: 10000 });
  });

  test('should load reconciliation page', async ({ page }) => {
    await page.goto('/admin/conciliacion');
    await expect(page.locator('text=Conciliación')).toBeVisible({ timeout: 10000 });
  });

  test('should load P&L page', async ({ page }) => {
    await page.goto('/admin/estado-resultados');
    await expect(page.locator('text=Estado de Resultados')).toBeVisible({ timeout: 10000 });
  });

  test('should load waiter ranking page', async ({ page }) => {
    await page.goto('/admin/ranking-meseros');
    await expect(page.locator('text=Ranking')).toBeVisible({ timeout: 10000 });
  });

  test('should load platforms page', async ({ page }) => {
    await page.goto('/admin/plataformas');
    await expect(page.locator('text=Plataformas')).toBeVisible({ timeout: 10000 });
  });
});
