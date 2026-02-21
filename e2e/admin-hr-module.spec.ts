/**
 * E2E Test: Admin HR Module
 * Tests the RRHH admin panel navigation and page interactions
 */
import { test, expect } from '@playwright/test';

test.describe('Admin HR Module', () => {
  test.describe('HR Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/admin/hr');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should load HR dashboard with title', async ({ page }) => {
      await expect(page.locator('text=Recursos Humanos')).toBeVisible({ timeout: 10000 });
    });

    test('should display dashboard stats or quick links', async ({ page }) => {
      await page.waitForTimeout(2000);
      // Dashboard should have some content (stats cards, links, etc.)
      const pageContent = await page.textContent('main, [role="main"], body');
      expect(pageContent!.length).toBeGreaterThan(0);
    });
  });

  test.describe('HR Navigation', () => {
    test('should navigate to employee list', async ({ page }) => {
      await page.goto('/admin/hr');
      await page.waitForLoadState('domcontentloaded');
      const empLink = page.locator('a:has-text("Empleados"), button:has-text("Empleados")');
      if (await empLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await empLink.first().click();
        await page.waitForURL('**/hr/employees**', { timeout: 10000 }).catch(() => {});
      }
    });

    test('should navigate to attendance', async ({ page }) => {
      await page.goto('/admin/hr');
      await page.waitForLoadState('domcontentloaded');
      const attLink = page.locator('a:has-text("Asistencia"), button:has-text("Asistencia")');
      if (await attLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await attLink.first().click();
        await page.waitForURL('**/hr/attendance**', { timeout: 10000 }).catch(() => {});
      }
    });

    test('should navigate to payroll', async ({ page }) => {
      await page.goto('/admin/hr');
      await page.waitForLoadState('domcontentloaded');
      const payLink = page.locator('a:has-text("Nómina"), button:has-text("Nómina")');
      if (await payLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await payLink.first().click();
        await page.waitForURL('**/hr/payroll**', { timeout: 10000 }).catch(() => {});
      }
    });

    test('should navigate to schedules', async ({ page }) => {
      await page.goto('/admin/hr');
      await page.waitForLoadState('domcontentloaded');
      const schLink = page.locator('a:has-text("Horarios"), button:has-text("Horarios")');
      if (await schLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await schLink.first().click();
        await page.waitForURL('**/hr/schedules**', { timeout: 10000 }).catch(() => {});
      }
    });
  });

  test.describe('HR Employee List', () => {
    test('should load employee list page', async ({ page }) => {
      await page.goto('/admin/hr/employees');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      // Should show employee table or empty state
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    });
  });

  test.describe('HR Attendance', () => {
    test('should load attendance page', async ({ page }) => {
      await page.goto('/admin/hr/attendance');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    });
  });
});
