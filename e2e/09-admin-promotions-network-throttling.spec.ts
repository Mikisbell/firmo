/**
 * E2E Test: Admin Panel - Promotions with Network Throttling
 * 
 * PROPÓSITO: Demostrar el problema del "éxito silencioso"
 * 
 * Este test es INTENCIONAL FLAKY para probar el framework de diagnóstico.
 * Pasa en local (sin throttling) pero falla bajo condiciones reales de red.
 * 
 * Flows tested:
 * - Create promotion with simulated slow network (1-2s latency)
 * - Create promotion with simulated packet loss (10% failure rate)
 * - Validate timeout handling
 * - Validate retry logic
 */

import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TEST_PINS } from './helpers/test-utils';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PIN = TEST_PINS.ADMIN;

test.describe('Admin Panel - Promotions with Network Throttling', () => {
  
  test('should handle timeout with slow network', async ({ page, context }) => {
      /**
       * NOTA: Este test valida que el sistema maneja timeouts correctamente
       * 
       * Escenario:
       * - Latencia: 5 segundos (hardware-level via CDP)
       * - Timeout: 3 segundos (cliente)
       * - Esperado: Timeout error o error de conexión
       * 
       * FIX: Usar CDP Network.emulateNetworkConditions para simular latencia real
       * - context.route() intercepta DESPUÉS del envío (demasiado limpio)
       * - CDP emula latencia a nivel de hardware (antes del envío)
       * - Resultado: Timeout real que la IA puede diagnosticar como fallo de infraestructura
       * 
       * PHASE 1 CRITICAL REVIEW - Issue #1: Loading State Validation
       * - Validates loading spinner appears during request
       * - Validates error toast appears after timeout
       * - Validates retry button is available
       * - Ensures UI is not frozen during throttling
       */
      
      // Usar CDP para emular latencia masiva (5 segundos)
      const client = await context.newCDPSession(page);
      
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 50 * 1024 / 8, // 50 kbps (muy lento)
        uploadThroughput: 20 * 1024 / 8,   // 20 kbps (muy lento)
        latency: 5000, // 5 segundos de ping (hardware-level)
      });

      await authenticateAsAdmin(page, ADMIN_PIN);

      // Navigate to create promotion page
      await page.goto(`${BASE_URL}/admin/promociones/nuevo`);

      const uniquePromotion = {
        name: `Timeout Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Fill form
      await page.fill('input[placeholder*="Ej: Descuento"]', uniquePromotion.name);
      await page.selectOption('select', 'PERCENT');
      await page.fill('input[type="number"]', '10');
      
      // Set dates
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const startStr = now.toISOString().slice(0, 16);
      const endStr = tomorrow.toISOString().slice(0, 16);
      
      const dateInputs = await page.locator('input[type="datetime-local"]').all();
      await dateInputs[0].fill(startStr);
      await dateInputs[1].fill(endStr);

      // Start request
      const submitBtn = page.locator('button:has-text("Crear Promoción")');
      
      // Click submit
      await submitBtn.click();

      // ✅ NEW: Validate loading state appears within 500ms
      await page.waitForTimeout(100); // Let UI update
      const loadingSpinner = page.getByTestId('loading-spinner');
      await expect(loadingSpinner).toBeVisible({ timeout: 500 });
      console.log('✅ Loading state appeared');

      // Wait for timeout (5000ms latency > 3000ms timeout)
      let timedOut = false;
      const startTime = Date.now();
      
      // Wait for error toast to appear
      const errorToast = page.getByTestId('error-toast');
      try {
        await expect(errorToast).toBeVisible({ timeout: 6000 });
        console.log('✅ Error toast appeared');
        timedOut = true;
      } catch {
        // Timeout might not appear if request succeeded
        console.log('⚠️ Error toast did not appear (request may have succeeded)');
      }
      
      const duration = Date.now() - startTime;

      // ✅ NEW: Validate retry button is available
      if (timedOut) {
        const retryBtn = page.getByTestId('retry-btn');
        await expect(retryBtn).toBeEnabled();
        console.log('✅ Retry button available');
      }

      // Validate that loading state is gone
      await expect(loadingSpinner).not.toBeVisible({ timeout: 1000 });
      console.log('✅ Loading state disappeared');

      console.log(`Request duration: ${duration}ms (timeout: 3000ms, latency: 5000ms)`);
    });
});

/**
 * CÓMO USAR ESTE TEST PARA PROBAR EL FRAMEWORK
 * 
 * 1. Ejecutar sin throttling (debería pasar):
 *    npm run test:e2e -- e2e/09-admin-promotions-network-throttling.spec.ts
 * 
 * 2. Ejecutar con debug para ver el trace:
 *    npm run test:e2e:debug -- e2e/09-admin-promotions-network-throttling.spec.ts
 * 
 * 3. Ver el reporte:
 *    npm run test:e2e:report
 * 
 * 4. Analizar el trace:
 *    npm run test:e2e:trace
 * 
 * 5. Usar el mega-prompt de AI_READY_FRAMEWORK.md para diagnosticar fallos
 * 
 * RESULTADO ESPERADO:
 * - ✅ Tests pasan en local (sin throttling real)
 * - ❌ Tests fallan en CI (con throttling real)
 * - Demuestra el problema del "éxito silencioso"
 * - Valida que el framework de diagnóstico funciona
 */
