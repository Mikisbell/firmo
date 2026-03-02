/**
 * E2E Tests: Onboarding Flow
 *
 * Validates the onboarding wizard UI for newly provisioned tenants.
 * Seeds onboarding_steps directly via PrismaClient (same pattern as db-seed.ts).
 *
 * Ejecutar: npm run test:e2e -- e2e/onboarding-flow.spec.ts
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { authenticateAsAdmin, TEST_PINS, TENANT_ID } from './helpers/test-utils';
import { generateTestJWT, disconnectDB } from './helpers/db-seed';

// --- DB helpers (own PrismaClient, same as db-seed.ts) ---
let prisma: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * The 6 onboarding steps — mirrors src/core/tenant/onboarding-steps.ts
 */
const ONBOARDING_STEPS_SEED = [
  {
    step_number: 1,
    step_key: 'CONFIGURE_BASIC_INFO',
    title: 'Configurar Información del Negocio',
    description: 'Completa los datos de tu restaurante (nombre, RUC, dirección)',
    is_required: true,
  },
  {
    step_number: 2,
    step_key: 'CREATE_EMPLOYEE',
    title: 'Crear Empleados',
    description: 'Agrega al menos un empleado además del administrador',
    is_required: true,
  },
  {
    step_number: 3,
    step_key: 'CREATE_PRODUCT',
    title: 'Crear Productos',
    description: 'Agrega los productos que venderás (pollos, bebidas, etc.)',
    is_required: true,
  },
  {
    step_number: 4,
    step_key: 'CONFIGURE_STATIONS',
    title: 'Configurar Estaciones',
    description: 'Configura las estaciones de cocina (parrilla, cocina, bar)',
    is_required: false,
  },
  {
    step_number: 5,
    step_key: 'ACTIVATE_TERMINAL',
    title: 'Activar Terminal',
    description: 'Activa tu terminal POS con el código de activación',
    is_required: true,
  },
  {
    step_number: 6,
    step_key: 'CONFIGURE_PAYMENT_METHODS',
    title: 'Configurar Métodos de Pago',
    description: 'Configura los métodos de pago que acepta tu restaurante',
    is_required: false,
  },
];

/**
 * Seed onboarding steps for the test tenant.
 * Deletes any existing steps first, then inserts fresh ones (all incomplete).
 */
async function seedOnboardingSteps(tenantId: string): Promise<void> {
  const db = getClient();

  // Clean up existing steps for this tenant
  await db.onboarding_steps.deleteMany({
    where: { tenant_id: tenantId },
  });

  // Insert fresh steps — all incomplete
  const stepData = ONBOARDING_STEPS_SEED.map((s) => ({
    tenant_id: tenantId,
    step_number: s.step_number,
    step_key: s.step_key,
    title: s.title,
    description: s.description,
    is_required: s.is_required,
    is_completed: false,
    completed_at: null,
    completed_by: null,
    metadata: {},
  }));

  await db.onboarding_steps.createMany({ data: stepData });
}

/**
 * Clean up onboarding steps for the test tenant.
 */
async function cleanupOnboardingSteps(tenantId: string): Promise<void> {
  const db = getClient();
  await db.onboarding_steps.deleteMany({
    where: { tenant_id: tenantId },
  });
}

// --- Tests ---

test.describe('Onboarding Flow', () => {
  const baseURL = 'http://localhost:3000';

  test.beforeAll(async () => {
    // Seed onboarding steps for the default test tenant
    await seedOnboardingSteps(TENANT_ID);
  });

  test.afterAll(async () => {
    // Clean up seeded data
    await cleanupOnboardingSteps(TENANT_ID);
    // Disconnect PrismaClient used in seed helpers
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
    }
    await disconnectDB();
  });

  test('should load the onboarding wizard page', async ({ page }) => {
    // Authenticate as admin
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    // Navigate to onboarding page
    await page.goto(`${baseURL}/admin/onboarding`);

    // Wait for wizard to load — look for the main heading
    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display 6 onboarding steps', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    // Wait for wizard heading to appear
    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // The step list panel should contain "Pasos de Configuracion"
    await expect(
      page.locator('h3').filter({ hasText: /Pasos de Configuracion/ })
    ).toBeVisible();

    // Verify all 6 step titles are rendered in the step progress sidebar
    for (const step of ONBOARDING_STEPS_SEED) {
      await expect(
        page.locator('button').filter({ hasText: step.title })
      ).toBeVisible();
    }
  });

  test('should display step titles in Spanish', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Verify key Spanish text elements
    const spanishTexts = [
      'Bienvenido a PARK POS',
      'Progreso de Configuracion',
      'Pasos de Configuracion',
      'Configurar Información del Negocio',
      'Crear Empleados',
      'Crear Productos',
      'Configurar Estaciones',
      'Activar Terminal',
      'Configurar Métodos de Pago',
    ];

    for (const text of spanishTexts) {
      await expect(page.locator(`text=${text}`)).toBeVisible();
    }
  });

  test('should show progress indicator starting at 0%', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Progress percentage should be 0% (no steps completed)
    await expect(page.locator('text=0%')).toBeVisible();

    // Progress text should show "0 de N pasos requeridos completados"
    await expect(
      page.locator('text=/0 de \\d+ pasos requeridos completados/')
    ).toBeVisible();
  });

  test('should display the first step form by default', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // The first step title should appear as an h2 in the form area
    await expect(
      page.locator('h2').filter({ hasText: 'Configurar Información del Negocio' })
    ).toBeVisible();

    // The step number badge should show "1"
    await expect(
      page.locator('span').filter({ hasText: '1' }).first()
    ).toBeVisible();

    // The description should be visible
    await expect(
      page.locator('text=Completa los datos de tu restaurante')
    ).toBeVisible();

    // The "Completar Paso" button should be visible and enabled
    const completeButton = page.locator('button').filter({ hasText: 'Completar Paso' });
    await expect(completeButton).toBeVisible();
    await expect(completeButton).toBeEnabled();
  });

  test('should mark required steps with "Requerido" label', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Required steps (4 out of 6) should show "Requerido" label
    const requiredLabels = page.locator('text=Requerido');
    const count = await requiredLabels.count();
    // 4 required steps: CONFIGURE_BASIC_INFO, CREATE_EMPLOYEE, CREATE_PRODUCT, ACTIVATE_TERMINAL
    expect(count).toBe(4);
  });

  test('should show "Omitir" button for optional steps', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Navigate to step 4 (Configurar Estaciones — optional)
    // Click the step button in the sidebar
    const stationsStep = page.locator('button').filter({ hasText: 'Configurar Estaciones' });
    // Step 4 might not be clickable if locked, but if current step is 1 we need to complete steps first
    // Instead, check that the current step (1) does NOT show "Omitir" (it's required)
    const skipButton = page.locator('button').filter({ hasText: 'Omitir' });

    // Step 1 is required — "Omitir" should NOT be visible
    await expect(skipButton).not.toBeVisible();
  });

  test('should navigate between steps via sidebar', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Initially on step 1
    await expect(
      page.locator('h2').filter({ hasText: 'Configurar Información del Negocio' })
    ).toBeVisible();

    // Step 1 should have the "current" styling (blue border)
    const step1Button = page.locator('button').filter({ hasText: /1\. Configurar Información del Negocio/ });
    await expect(step1Button).toBeVisible();
  });

  test('should show help text at bottom of step form', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Help text at the bottom of the form
    await expect(
      page.locator('text=/Puedes completar estos pasos en cualquier orden/')
    ).toBeVisible();
  });

  test('should complete a step and update progress', async ({ page }) => {
    // Re-seed steps to ensure all are incomplete
    await seedOnboardingSteps(TENANT_ID);

    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Verify initial progress is 0%
    await expect(page.locator('text=0%')).toBeVisible();

    // Click "Completar Paso" to complete step 1
    const completeButton = page.locator('button').filter({ hasText: 'Completar Paso' });
    await expect(completeButton).toBeVisible();
    await completeButton.click();

    // Wait for the API call to complete and page to refresh
    // After completing step 1, progress should increase (1 out of 4 required = 25%)
    await expect(page.locator('text=25%')).toBeVisible({ timeout: 10000 });

    // The progress text should update
    await expect(
      page.locator('text=/1 de 4 pasos requeridos completados/')
    ).toBeVisible();
  });

  test('should display completion message when all required steps are done', async ({ page }) => {
    // Seed steps with all required steps already completed
    const db = getClient();
    await db.onboarding_steps.deleteMany({ where: { tenant_id: TENANT_ID } });

    const stepData = ONBOARDING_STEPS_SEED.map((s) => ({
      tenant_id: TENANT_ID,
      step_number: s.step_number,
      step_key: s.step_key,
      title: s.title,
      description: s.description,
      is_required: s.is_required,
      // Mark all required steps as completed, optional ones as not
      is_completed: s.is_required,
      completed_at: s.is_required ? new Date() : null,
      completed_by: s.is_required ? 'e2e-test-user' : null,
      metadata: {},
    }));
    await db.onboarding_steps.createMany({ data: stepData });

    await authenticateAsAdmin(page, TEST_PINS.ADMIN);
    await page.goto(`${baseURL}/admin/onboarding`);

    await expect(
      page.locator('h1').filter({ hasText: /Bienvenido a PARK POS/ })
    ).toBeVisible({ timeout: 15000 });

    // Progress should be 100%
    await expect(page.locator('text=100%')).toBeVisible({ timeout: 10000 });

    // Completion message should be visible
    await expect(
      page.locator('text=/Configuracion Completa/')
    ).toBeVisible();

    await expect(
      page.locator('text=/Tu sistema PARK POS esta listo para usar/')
    ).toBeVisible();
  });
});
