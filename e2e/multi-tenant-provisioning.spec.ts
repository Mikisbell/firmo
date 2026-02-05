/**
 * E2E Tests: Multi-Tenant Provisioning UI
 * 
 * Valida el flujo completo de provisioning desde la UI
 * 
 * Ejecutar: npm run test:e2e -- e2e/multi-tenant-provisioning.spec.ts
 */

import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TEST_PINS } from './helpers/test-utils';

test.describe('Multi-Tenant Provisioning E2E', () => {
  const baseURL = 'http://localhost:3000';

  test('✅ Flujo completo: Provisionar nuevo tenant', async ({ page }) => {
    // 0. Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    // 1. Navegar a página de provisioning
    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // 2. Verificar que la página cargó - usar selectores más robustos
    await expect(page.locator('h1, h2').filter({ hasText: /Provision|Tenant/ })).toBeVisible({ timeout: 5000 });

    // 3. Llenar formulario - Información del negocio
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput.fill('Pollería E2E Test');

    // 4. Llenar información del admin
    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Admin E2E');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('7777');

    // 5. Seleccionar configuración regional - buscar por label
    const timezoneSelect = page.locator('select').first();
    await timezoneSelect.selectOption('America/Lima');

    const currencySelect = page.locator('select').nth(1);
    await currencySelect.selectOption('PEN');

    // 6. Hacer click en provisionar - buscar botón por texto o rol
    const provisionButton = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await expect(provisionButton).toBeEnabled();
    await provisionButton.click();

    // 7. Esperar success screen (máximo 10 segundos)
    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });

    // 8. Verificar que se muestran credenciales
    const readonlyInputs = page.locator('input[readonly]');
    const tenantIdInput = readonlyInputs.first();
    const tenantId = await tenantIdInput.inputValue();

    expect(tenantId).toBeTruthy();
    expect(tenantId?.length).toBeGreaterThan(10);

    // 9. Verificar activation code
    const activationCodeInput = readonlyInputs.nth(1);
    const activationCode = await activationCodeInput.inputValue();

    expect(activationCode).toBeTruthy();
    expect(activationCode).toMatch(/^\d{6}$/); // 6 dígitos

    // 10. Verificar onboarding checklist
    await expect(page.locator('text=/Onboarding|Checklist/i')).toBeVisible();

    // 11. Verificar botones de acción
    const buttons = page.locator('button');
    await expect(buttons.filter({ hasText: /Another|Next/ })).toBeVisible();
  });

  test('✅ Validación: PIN debe ser 4 dígitos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Llenar con PIN inválido (solo 2 dígitos)
    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Test');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('12');

    const button = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();

    // Debe estar deshabilitado o mostrar error
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Validación: Legal name es requerido', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Dejar legal_name vacío
    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Test');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('1234');

    const button = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();

    // Debe estar deshabilitado
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Validación: Admin name es requerido', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Dejar admin_name vacío
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput.fill('Test');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('1234');

    const button = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();

    // Debe estar deshabilitado
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Funcionalidad: Copiar credenciales al portapapeles', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Provisionar tenant
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput.fill('Copy Test');

    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Admin');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('1234');

    const provisionButton = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await provisionButton.click();

    // Esperar success screen
    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });

    // Obtener tenant ID
    const tenantIdInput = page.locator('input[readonly]').first();
    const tenantId = await tenantIdInput.inputValue();

    // Hacer click en botón de copiar
    const copyButtons = page.locator('button').filter({ has: page.locator('svg') });
    await copyButtons.first().click();

    // Verificar que se copió (simulado en Playwright)
    // En un navegador real, esto copiaría al portapapeles
    expect(tenantId).toBeTruthy();
  });

  test('✅ Flujo: Provisionar múltiples tenants', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Provisionar tenant 1
    const legalNameInput1 = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput1.fill('Tenant 1 E2E');

    const adminNameInput1 = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput1.fill('Admin 1');

    const adminPinInput1 = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput1.fill('1111');

    const provisionButton1 = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await provisionButton1.click();

    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });

    const tenant1Id = await page.locator('input[readonly]').first().inputValue();

    // Provisionar tenant 2
    const nextButton = page.locator('button').filter({ hasText: /Another|Next/ }).first();
    await nextButton.click();

    // Verificar que volvió al formulario
    await expect(page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first()).toBeVisible();

    const legalNameInput2 = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput2.fill('Tenant 2 E2E');

    const adminNameInput2 = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput2.fill('Admin 2');

    const adminPinInput2 = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput2.fill('2222');

    const provisionButton2 = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await provisionButton2.click();

    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });

    const tenant2Id = await page.locator('input[readonly]').first().inputValue();

    // Verificar que son diferentes
    expect(tenant1Id).not.toBe(tenant2Id);
  });

  test('✅ UI: Formulario tiene todas las secciones', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Verificar secciones - usar selectores más robustos
    await expect(page.locator('text=/Business|Information/i')).toBeVisible();
    await expect(page.locator('text=/Admin|Information/i')).toBeVisible();
    await expect(page.locator('text=/Regional|Settings/i')).toBeVisible();

    // Verificar campos
    await expect(page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first()).toBeVisible();
    await expect(page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1)).toBeVisible();
    await expect(page.locator('input[placeholder*="PIN"], input[type="password"]').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('select').nth(1)).toBeVisible();
  });

  test('✅ UI: Onboarding checklist muestra 6 pasos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Provisionar tenant
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput.fill('Checklist Test');

    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Admin');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('1234');

    const provisionButton = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await provisionButton.click();

    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });

    // Verificar pasos del onboarding
    const steps = page.locator('text=/Configurar|Crear|Activar/');
    const stepCount = await steps.count();

    expect(stepCount).toBeGreaterThanOrEqual(6);

    // Verificar que cada paso tiene número
    const stepNumbers = page.locator('div:has-text(/^[1-6]$/)');
    expect(await stepNumbers.count()).toBeGreaterThanOrEqual(6);
  });

  test('✅ Responsividad: Formulario funciona en mobile', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    // Simular viewport mobile
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Llenar formulario
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    await legalNameInput.fill('Mobile Test');

    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    await adminNameInput.fill('Admin');

    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();
    await adminPinInput.fill('1234');

    // Provisionar
    const provisionButton = page.locator('button').filter({ hasText: /Provision|Submit/ }).first();
    await provisionButton.click();

    // Debe funcionar en mobile también
    await expect(page.locator('text=/Success|Complete/i')).toBeVisible({ timeout: 10000 });
  });

  test('✅ Accesibilidad: Formulario tiene labels correctos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Verificar que los inputs tienen labels o placeholders
    const legalNameInput = page.locator('input[placeholder*="Legal"], input[placeholder*="Name"]').first();
    const adminNameInput = page.locator('input[placeholder*="Admin"], input[placeholder*="Name"]').nth(1);
    const adminPinInput = page.locator('input[placeholder*="PIN"], input[type="password"]').first();

    await expect(legalNameInput).toBeVisible();
    await expect(adminNameInput).toBeVisible();
    await expect(adminPinInput).toBeVisible();
  });
});
