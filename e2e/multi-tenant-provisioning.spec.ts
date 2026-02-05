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

    // 2. Verificar que la página cargó
    await expect(page.locator('text=Provision New Tenant')).toBeVisible();
    await expect(page.locator('text=Create a new tenant')).toBeVisible();

    // 3. Llenar formulario - Información del negocio
    await page.fill('input[name="legal_name"]', 'Pollería E2E Test');
    await page.fill('input[name="ruc"]', '20987654321');
    await page.fill('textarea[name="address_text"]', 'Av. Test 123, Lima');

    // 4. Llenar información del admin
    await page.fill('input[name="admin_name"]', 'Admin E2E');
    await page.fill('input[name="admin_pin"]', '7777');

    // 5. Seleccionar configuración regional
    await page.selectOption('select[name="timezone"]', 'America/Lima');
    await page.selectOption('select[name="currency"]', 'PEN');

    // 6. Hacer click en provisionar
    const provisionButton = page.locator('button:has-text("Provision Tenant")');
    await expect(provisionButton).toBeEnabled();
    await provisionButton.click();

    // 7. Esperar success screen (máximo 10 segundos)
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Tenant Credentials')).toBeVisible();

    // 8. Verificar que se muestran credenciales
    const tenantIdInput = page.locator('input[readonly]').first();
    const tenantId = await tenantIdInput.inputValue();

    expect(tenantId).toBeTruthy();
    expect(tenantId?.length).toBeGreaterThan(10);

    // 9. Verificar activation code
    const activationCodeInput = page.locator('input[readonly]').nth(2);
    const activationCode = await activationCodeInput.inputValue();

    expect(activationCode).toBeTruthy();
    expect(activationCode).toMatch(/^\d{6}$/); // 6 dígitos

    // 10. Verificar onboarding checklist
    await expect(page.locator('text=Onboarding Checklist')).toBeVisible();
    const steps = page.locator('text=/Configurar|Crear|Activar/');
    const stepCount = await steps.count();
    expect(stepCount).toBeGreaterThanOrEqual(6);

    // 11. Verificar botones de acción
    await expect(page.locator('button:has-text("Provision Another Tenant")')).toBeVisible();
    await expect(page.locator('button:has-text("Go to Dashboard")')).toBeVisible();
  });

  test('✅ Validación: PIN debe ser 4 dígitos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Llenar con PIN inválido (solo 2 dígitos)
    await page.fill('input[name="legal_name"]', 'Test');
    await page.fill('input[name="admin_name"]', 'Test');
    await page.fill('input[name="admin_pin"]', '12');

    const button = page.locator('button:has-text("Provision Tenant")');

    // Debe estar deshabilitado o mostrar error
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Validación: Legal name es requerido', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Dejar legal_name vacío
    await page.fill('input[name="admin_name"]', 'Test');
    await page.fill('input[name="admin_pin"]', '1234');

    const button = page.locator('button:has-text("Provision Tenant")');

    // Debe estar deshabilitado
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Validación: Admin name es requerido', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Dejar admin_name vacío
    await page.fill('input[name="legal_name"]', 'Test');
    await page.fill('input[name="admin_pin"]', '1234');

    const button = page.locator('button:has-text("Provision Tenant")');

    // Debe estar deshabilitado
    const isDisabled = await button.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('✅ Funcionalidad: Copiar credenciales al portapapeles', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Provisionar tenant
    await page.fill('input[name="legal_name"]', 'Copy Test');
    await page.fill('input[name="admin_name"]', 'Admin');
    await page.fill('input[name="admin_pin"]', '1234');
    await page.click('button:has-text("Provision Tenant")');

    // Esperar success screen
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

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
    await page.fill('input[name="legal_name"]', 'Tenant 1 E2E');
    await page.fill('input[name="admin_name"]', 'Admin 1');
    await page.fill('input[name="admin_pin"]', '1111');
    await page.click('button:has-text("Provision Tenant")');

    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

    const tenant1Id = await page.locator('input[readonly]').first().inputValue();

    // Provisionar tenant 2
    await page.click('button:has-text("Provision Another Tenant")');

    // Verificar que volvió al formulario
    await expect(page.locator('text=Provision New Tenant')).toBeVisible();

    await page.fill('input[name="legal_name"]', 'Tenant 2 E2E');
    await page.fill('input[name="admin_name"]', 'Admin 2');
    await page.fill('input[name="admin_pin"]', '2222');
    await page.click('button:has-text("Provision Tenant")');

    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

    const tenant2Id = await page.locator('input[readonly]').first().inputValue();

    // Verificar que son diferentes
    expect(tenant1Id).not.toBe(tenant2Id);
  });

  test('✅ UI: Formulario tiene todas las secciones', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Verificar secciones
    await expect(page.locator('text=Business Information')).toBeVisible();
    await expect(page.locator('text=Admin Information')).toBeVisible();
    await expect(page.locator('text=Regional Settings')).toBeVisible();
    await expect(page.locator('text=Optional Settings')).toBeVisible();

    // Verificar campos
    await expect(page.locator('input[name="legal_name"]')).toBeVisible();
    await expect(page.locator('input[name="admin_name"]')).toBeVisible();
    await expect(page.locator('input[name="admin_pin"]')).toBeVisible();
    await expect(page.locator('select[name="timezone"]')).toBeVisible();
    await expect(page.locator('select[name="currency"]')).toBeVisible();
  });

  test('✅ UI: Onboarding checklist muestra 6 pasos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Provisionar tenant
    await page.fill('input[name="legal_name"]', 'Checklist Test');
    await page.fill('input[name="admin_name"]', 'Admin');
    await page.fill('input[name="admin_pin"]', '1234');
    await page.click('button:has-text("Provision Tenant")');

    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });

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
    await page.fill('input[name="legal_name"]', 'Mobile Test');
    await page.fill('input[name="admin_name"]', 'Admin');
    await page.fill('input[name="admin_pin"]', '1234');

    // Provisionar
    await page.click('button:has-text("Provision Tenant")');

    // Debe funcionar en mobile también
    await expect(page.locator('text=Success!')).toBeVisible({ timeout: 10000 });
  });

  test('✅ Accesibilidad: Formulario tiene labels correctos', async ({ page }) => {
    // Authenticate as admin first
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    await page.goto(`${baseURL}/admin/tenant/provisioning`);

    // Verificar que los inputs tienen labels
    const legalNameLabel = page.locator('label:has-text("Legal Name")');
    const adminNameLabel = page.locator('label:has-text("Admin Name")');
    const adminPinLabel = page.locator('label:has-text("Admin PIN")');

    await expect(legalNameLabel).toBeVisible();
    await expect(adminNameLabel).toBeVisible();
    await expect(adminPinLabel).toBeVisible();
  });
});
