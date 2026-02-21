/**
 * E2E Test: Admin HR Module
 * Tests the RRHH admin panel workflow
 */
import { test, expect } from '@playwright/test';

test.describe('Admin HR Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin HR page (auth handled by middleware in CI)
    await page.goto('/admin/hr');
  });

  test('should load HR dashboard', async ({ page }) => {
    await expect(page.locator('text=Recursos Humanos')).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to employee list', async ({ page }) => {
    await page.click('text=Empleados');
    await page.waitForURL('**/admin/hr/employees');
    await expect(page).toHaveURL(/\/admin\/hr\/employees/);
  });

  test('should navigate to attendance', async ({ page }) => {
    await page.click('text=Asistencia');
    await page.waitForURL('**/admin/hr/attendance');
    await expect(page).toHaveURL(/\/admin\/hr\/attendance/);
  });

  test('should navigate to payroll', async ({ page }) => {
    await page.click('text=Nómina');
    await page.waitForURL('**/admin/hr/payroll');
    await expect(page).toHaveURL(/\/admin\/hr\/payroll/);
  });

  test('should navigate to schedules', async ({ page }) => {
    await page.click('text=Horarios');
    await page.waitForURL('**/admin/hr/schedules');
    await expect(page).toHaveURL(/\/admin\/hr\/schedules/);
  });
});
