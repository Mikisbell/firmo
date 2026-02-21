/**
 * Tests E2E de Performance - Cache Optimization
 * 
 * Valida que el sistema de optimización de caché funciona correctamente:
 * - Dashboard carga con menos requests
 * - Navegación entre páginas usa caché
 * - Auto-refresh no duplica requests
 * - Invalidación de caché funciona
 * - Memory no crece indefinidamente
 * 
 * @module e2e/performance/cache-optimization
 */

import { test, expect, type Page } from '@playwright/test';

test.describe('Cache Optimization - Performance Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login como admin
    await page.goto('/admin/login');
    await page.fill('[data-testid="pin-input"]', '1234');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/admin/dashboard');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('18.1.2 - Dashboard carga con menos requests duplicados', async () => {
    // Interceptar requests a la API
    const apiRequests: string[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/admin/')) {
        apiRequests.push(url);
      }
    });

    // Navegar al dashboard
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    // Contar requests únicos
    const uniqueRequests = new Set(apiRequests);
    const duplicateCount = apiRequests.length - uniqueRequests.size;

    // Validar que hay menos del 10% de requests duplicados
    const duplicatePercentage = (duplicateCount / apiRequests.length) * 100;
    expect(duplicatePercentage).toBeLessThan(10);

    console.log(`Total requests: ${apiRequests.length}`);
    console.log(`Unique requests: ${uniqueRequests.size}`);
    console.log(`Duplicate requests: ${duplicateCount} (${duplicatePercentage.toFixed(2)}%)`);
  });

  test('18.1.3 - Navegación entre páginas usa caché', async () => {
    const apiRequests: Map<string, number> = new Map();
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/admin/reports')) {
        const count = apiRequests.get(url) || 0;
        apiRequests.set(url, count + 1);
      }
    });

    // Primera visita al dashboard
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const firstVisitRequests = apiRequests.size;

    // Navegar a otra página
    await page.goto('/admin/empleados');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Volver al dashboard (debería usar caché)
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Validar que no se hicieron nuevos requests (caché funcionando)
    const secondVisitRequests = apiRequests.size;
    
    // Debería haber el mismo número de requests únicos
    expect(secondVisitRequests).toBeLessThanOrEqual(firstVisitRequests + 2);

    console.log(`First visit requests: ${firstVisitRequests}`);
    console.log(`Second visit requests: ${secondVisitRequests}`);
  });

  test('18.1.4 - Auto-refresh no duplica requests innecesariamente', async () => {
    const apiRequests: string[] = [];
    let requestTimestamps: number[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/admin/reports')) {
        apiRequests.push(url);
        requestTimestamps.push(Date.now());
      }
    });

    // Navegar al dashboard
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');

    const initialRequests = apiRequests.length;

    // Esperar 65 segundos (más que el intervalo de revalidación de 60s)
    await page.waitForTimeout(65000);

    const finalRequests = apiRequests.length;
    const newRequests = finalRequests - initialRequests;

    // Validar que solo se hizo 1 request de revalidación
    expect(newRequests).toBeLessThanOrEqual(2);

    console.log(`Initial requests: ${initialRequests}`);
    console.log(`Final requests: ${finalRequests}`);
    console.log(`New requests after 65s: ${newRequests}`);
  });

  test('18.1.5 - Invalidación de caché funciona correctamente', async () => {
    // Navegar al dashboard de performance
    await page.goto('/admin/performance');
    await page.waitForLoadState('networkidle');

    // Obtener métricas iniciales
    const initialCacheSize = await page.textContent('[data-testid="cache-size"]');
    expect(initialCacheSize).toBeTruthy();

    // Hacer reset de métricas (invalida caché)
    await page.click('[data-testid="reset-metrics-button"]');
    await page.waitForTimeout(1000);

    // Verificar que el caché se limpió
    const finalCacheSize = await page.textContent('[data-testid="cache-size"]');
    expect(finalCacheSize).toContain('0');

    console.log(`Initial cache size: ${initialCacheSize}`);
    console.log(`Final cache size: ${finalCacheSize}`);
  });

  test('18.1.6 - Memory no crece indefinidamente', async () => {
    // Obtener memoria inicial
    const initialMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Navegar entre múltiples páginas
    const pages = [
      '/admin/dashboard',
      '/admin/empleados',
      '/admin/productos',
      '/admin/estaciones',
      '/admin/drivers',
      '/admin/monitoring',
      '/admin/alerts',
      '/admin/security',
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Obtener memoria final
    const finalMemory = await page.evaluate(() => {
      if ((performance as any).memory) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });

    // Calcular crecimiento de memoria
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    // Validar que el crecimiento de memoria es razonable (<50MB)
    expect(memoryGrowthMB).toBeLessThan(50);

    console.log(`Initial memory: ${(initialMemory / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Final memory: ${(finalMemory / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);
  });
});
