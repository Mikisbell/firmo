/**
 * E2E Test: Recipes & Chicken Control
 * Tests recipe management and chicken production tracking
 */
import { test, expect } from '@playwright/test';

test.describe('Recipes & Chicken Control', () => {
  test('should load recipes page', async ({ page }) => {
    await page.goto('/admin/recetas');
    await expect(page.locator('text=Recetas')).toBeVisible({ timeout: 10000 });
  });

  test('should load chicken control page', async ({ page }) => {
    await page.goto('/admin/pollo-control');
    await expect(page.locator('text=Control')).toBeVisible({ timeout: 10000 });
  });
});
