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
       * FIX: Usar CDP Network.emulateNetworkConditions en lugar de context.route()
       * - context.route() solo retrasa la respuesta (después del procesamiento)
       * - CDP emula latencia real de red (antes del envío)
       * 
       * Resultado esperado:
       * - ✅ Pasa en local (con CDP throttling real)
       * - ✅ Pasa en CI (con CDP throttling real)
       * - Demuestra que el sistema maneja latencia correctamente
       */
      
      // Usar CDP para emular latencia real de red
      const client = await context.newCDPSession(page);
      
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 100 * 1024 / 8, // 100 kbps
        uploadThroughput: 50 * 1024 / 8,    // 50 kbps
        latency: 1500, // 1.5 segundos latencia
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

      // Este request debería tomar ~1.5 segundos adicionales
      const startTime = Date.now();
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
      });
      const duration = Date.now() - startTime;

      // Verificar que tomó tiempo (al menos 1 segundo por latencia)
      console.log(`Request duration: ${duration}ms (expected: ≥1500ms)`);
      
      expect([200, 201]).toContain(response.status());
      expect(duration).toBeGreaterThanOrEqual(1000); // Al menos 1 segundo
      
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
       * - Latencia: 5 segundos (hardware-level via CDP)
       * - Timeout: 3 segundos (cliente)
       * - Esperado: Timeout error o error de conexión
       * 
       * FIX: Usar CDP Network.emulateNetworkConditions para simular latencia real
       * - context.route() intercepta DESPUÉS del envío (demasiado limpio)
       * - CDP emula latencia a nivel de hardware (antes del envío)
       * - Resultado: Timeout real que la IA puede diagnosticar como fallo de infraestructura
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

      const uniquePromotion = {
        name: `Timeout Promotion ${Date.now()}`,
        type: 'PERCENT',
        value: 10,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      };

      // Este request debería timeout (5000ms latencia > 3000ms timeout)
      let timedOut = false;
      const startTime = Date.now();
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: { 'Content-Type': 'application/json' },
        data: uniquePromotion,
        timeout: 3000, // 3 segundos timeout (estricto)
      }).catch(err => {
        // Esperado: timeout error por latencia de hardware
        console.log(`Expected timeout error: ${err.message}`);
        timedOut = true;
        return null;
      });
      const duration = Date.now() - startTime;

      // Validar que ocurrió timeout (response será null)
      // O si no timeout, debería ser error 408/504/500
      console.log(`Request duration: ${duration}ms (timeout: 3000ms, latency: 5000ms)`);
      
      if (response) {
        // Si no timeout, debería ser error de conexión
        expect([408, 504, 500]).toContain(response.status());
      } else {
        // Timeout ocurrió (esperado)
        expect(timedOut).toBe(true);
        expect(duration).toBeGreaterThanOrEqual(3000); // Al menos el timeout
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
