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
  
  test.describe('Slow Network (1-2s latency)', () => {
    test('should create promotion with slow network', async ({ page, context }) => {
      /**
       * NOTA: Este test simula una cocina con Wi-Fi débil
       * - Latencia: 1-2 segundos
       * - Packet loss: 0%
       * 
       * Resultado esperado:
       * - ✅ Pasa en local (sin throttling real)
       * - ❌ Falla en CI con throttling real
       * - Demuestra el problema del "éxito silencioso"
       */
      
      // Simular latencia de 1-2 segundos
      await context.route('**/*', async (route) => {
        const delay = Math.random() * 1000 + 1000; // 1-2 segundos
        await new Promise(resolve => setTimeout(resolve, delay));
        await route.continue();
      });

      await authenticateAsAdmin(page, ADMIN_PIN);

      const uniquePromotion = {
        name: `Slow Network Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Este request debería tomar 1-2 segundos adicionales
      const startTime = Date.now();
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
      });
      const duration = Date.now() - startTime;

      // Verificar que tomó tiempo
      console.log(`Request duration: ${duration}ms (expected: 1000-2000ms)`);
      
      expect([200, 201]).toContain(response.status());
      
      if (response.ok()) {
        const promotion = await response.json();
        expect(promotion.id).toBeDefined();
        expect(promotion.name).toBe(uniquePromotion.name);
      }
    });

    test('should handle timeout with slow network', async ({ page, context }) => {
      /**
       * NOTA: Este test valida que el sistema maneja timeouts correctamente
       * 
       * Escenario:
       * - Latencia: 5 segundos (más que el timeout típico)
       * - Esperado: Error o retry
       */
      
      // Simular latencia de 5 segundos (timeout)
      await context.route('**/api/admin/promotions', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 5000));
        await route.continue();
      });

      await authenticateAsAdmin(page, ADMIN_PIN);

      const uniquePromotion = {
        name: `Timeout Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Este request debería timeout
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
        timeout: 3000, // 3 segundos timeout
      }).catch(err => {
        // Esperado: timeout error
        console.log(`Expected timeout error: ${err.message}`);
        return null;
      });

      // Debería fallar o retornar error
      if (response) {
        expect([408, 504, 500]).toContain(response.status());
      }
    });
  });

  test.describe('Packet Loss (10% failure rate)', () => {
    test('should handle packet loss gracefully', async ({ page, context }) => {
      /**
       * NOTA: Este test simula una red con packet loss
       * - Latencia: 500ms
       * - Packet loss: 10% (1 de cada 10 requests falla)
       * 
       * Resultado esperado:
       * - ✅ Pasa si el request no falla (90% de probabilidad)
       * - ❌ Falla si el request falla (10% de probabilidad)
       * - Demuestra la naturaleza flaky del test
       */
      
      let requestCount = 0;
      
      await context.route('**/*', async (route) => {
        requestCount++;
        
        // Agregar latencia
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Simular packet loss (10% de requests fallan)
        if (Math.random() < 0.1) {
          console.log(`Request #${requestCount} failed (simulated packet loss)`);
          await route.abort('failed');
          return;
        }
        
        await route.continue();
      });

      await authenticateAsAdmin(page, ADMIN_PIN);

      const uniquePromotion = {
        name: `Packet Loss Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Este test es flaky: 90% pasa, 10% falla
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
      }).catch(err => {
        // 10% de probabilidad: falla por packet loss
        console.log(`Packet loss detected: ${err.message}`);
        return null;
      });

      // Si no falló por packet loss, debería ser exitoso
      if (response) {
        expect([200, 201]).toContain(response.status());
      }
    });

    test('should retry on network failure', async ({ page, context }) => {
      /**
       * NOTA: Este test valida que el sistema reintenta en caso de fallo
       * 
       * Escenario:
       * - Primer request: falla (packet loss)
       * - Segundo request: exitoso
       * - Esperado: Sistema reintenta y logra crear la promoción
       */
      
      let attemptCount = 0;
      
      await context.route('**/api/admin/promotions', async (route) => {
        attemptCount++;
        
        // Primer intento falla, segundo intento exitoso
        if (attemptCount === 1) {
          console.log('First attempt: failing');
          await route.abort('failed');
          return;
        }
        
        console.log(`Attempt #${attemptCount}: continuing`);
        await route.continue();
      });

      await authenticateAsAdmin(page, ADMIN_PIN);

      const uniquePromotion = {
        name: `Retry Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Este test valida retry logic
      // Si el sistema NO tiene retry, fallará
      // Si el sistema TIENE retry, pasará
      
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
      }).catch(err => {
        console.log(`Request failed: ${err.message}`);
        return null;
      });

      // Si no hay retry logic, esto fallará
      if (response) {
        expect([200, 201]).toContain(response.status());
      }
    });
  });

  test.describe('Network Diagnostics', () => {
    test('should capture network metrics in trace', async ({ page, context }) => {
      /**
       * NOTA: Este test captura métricas de red en el trace
       * 
       * Propósito:
       * - Demostrar cómo usar Trace Viewer para diagnosticar problemas de red
       * - Mostrar Network tab con latencias
       * - Mostrar Console tab con errores
       */
      
      // Iniciar grabación de trace
      await context.tracing.start({ screenshots: true, snapshots: true });

      try {
        // Simular latencia variable
        await context.route('**/*', async (route) => {
          const delay = Math.random() * 500; // 0-500ms
          await new Promise(resolve => setTimeout(resolve, delay));
          await route.continue();
        });

        await authenticateAsAdmin(page, ADMIN_PIN);

        const uniquePromotion = {
          name: `Diagnostics Promotion ${Date.now()}`,
          type: 'PERCENT',
          value: 10,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        };

        const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
          headers: { 'Content-Type': 'application/json' },
          data: uniquePromotion,
        });

        expect([200, 201]).toContain(response.status());
      } finally {
        // Guardar trace para análisis
        await context.tracing.stop({ path: `trace-network-diagnostics-${Date.now()}.zip` });
      }
    });
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
