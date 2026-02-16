/**
 * Script de Benchmark - Cache Optimization
 * 
 * Mide y compara el performance antes y después de las optimizaciones de caché:
 * - Tiempo de carga del dashboard
 * - Número de requests
 * - Tiempo de respuesta promedio
 * - Cache hit rate
 * 
 * Uso:
 *   npx tsx scripts/benchmark-cache.ts
 * 
 * @module scripts/benchmark-cache
 */

import { chromium, type Browser, type Page } from '@playwright/test';

interface BenchmarkResult {
  scenario: string;
  loadTime: number;
  requestCount: number;
  avgResponseTime: number;
  cacheHitRate: number;
  timestamp: string;
}

/**
 * Ejecutar benchmark de carga del dashboard
 */
async function benchmarkDashboardLoad(page: Page): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const requests: number[] = [];
  let requestCount = 0;
  let cacheHits = 0;

  // Interceptar requests
  page.on('request', (request) => {
    if (request.url().includes('/api/admin/')) {
      requestCount++;
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('/api/admin/')) {
      const timing = response.timing();
      if (timing) {
        requests.push(timing.responseEnd);
      }
      
      // Detectar cache hits (SWR usa stale-while-revalidate)
      const cacheControl = response.headers()['cache-control'];
      if (cacheControl && cacheControl.includes('max-age')) {
        cacheHits++;
      }
    }
  });

  // Navegar al dashboard
  await page.goto('http://localhost:3000/admin/dashboard');
  await page.waitForLoadState('networkidle');

  const loadTime = Date.now() - startTime;
  const avgResponseTime = requests.length > 0 
    ? requests.reduce((a, b) => a + b, 0) / requests.length 
    : 0;
  const cacheHitRate = requestCount > 0 
    ? (cacheHits / requestCount) * 100 
    : 0;

  return {
    scenario: 'Dashboard Load',
    loadTime,
    requestCount,
    avgResponseTime,
    cacheHitRate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ejecutar benchmark de navegación entre páginas
 */
async function benchmarkNavigation(page: Page): Promise<BenchmarkResult> {
  const startTime = Date.now();
  let requestCount = 0;
  let cacheHits = 0;

  page.on('request', (request) => {
    if (request.url().includes('/api/admin/')) {
      requestCount++;
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('/api/admin/')) {
      const cacheControl = response.headers()['cache-control'];
      if (cacheControl && cacheControl.includes('max-age')) {
        cacheHits++;
      }
    }
  });

  // Navegar entre páginas
  const pages = [
    '/admin/dashboard',
    '/admin/empleados',
    '/admin/productos',
    '/admin/estaciones',
  ];

  for (const pagePath of pages) {
    await page.goto(`http://localhost:3000${pagePath}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  }

  const loadTime = Date.now() - startTime;
  const cacheHitRate = requestCount > 0 
    ? (cacheHits / requestCount) * 100 
    : 0;

  return {
    scenario: 'Navigation',
    loadTime,
    requestCount,
    avgResponseTime: 0,
    cacheHitRate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ejecutar todos los benchmarks
 */
async function runBenchmarks() {
  console.log('🚀 Iniciando benchmarks de cache optimization...\n');

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Iniciar navegador
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Login
    await page.goto('http://localhost:3000/admin/login');
    await page.fill('[data-testid="pin-input"]', '1234');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('http://localhost:3000/admin/dashboard');

    // Ejecutar benchmarks
    console.log('📊 Benchmark 1: Dashboard Load');
    const dashboardResult = await benchmarkDashboardLoad(page);
    printResult(dashboardResult);

    console.log('\n📊 Benchmark 2: Navigation');
    const navigationResult = await benchmarkNavigation(page);
    printResult(navigationResult);

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log('📈 RESUMEN DE BENCHMARKS');
    console.log('='.repeat(60));
    console.log(`Dashboard Load Time: ${dashboardResult.loadTime}ms`);
    console.log(`Dashboard Requests: ${dashboardResult.requestCount}`);
    console.log(`Dashboard Cache Hit Rate: ${dashboardResult.cacheHitRate.toFixed(2)}%`);
    console.log(`Navigation Load Time: ${navigationResult.loadTime}ms`);
    console.log(`Navigation Requests: ${navigationResult.requestCount}`);
    console.log(`Navigation Cache Hit Rate: ${navigationResult.cacheHitRate.toFixed(2)}%`);
    console.log('='.repeat(60));

    // Guardar resultados
    const results = {
      dashboardLoad: dashboardResult,
      navigation: navigationResult,
      summary: {
        totalLoadTime: dashboardResult.loadTime + navigationResult.loadTime,
        totalRequests: dashboardResult.requestCount + navigationResult.requestCount,
        avgCacheHitRate: (dashboardResult.cacheHitRate + navigationResult.cacheHitRate) / 2,
      },
    };

    const fs = await import('fs/promises');
    await fs.writeFile(
      '.kiro/specs/react-cache-optimization/BENCHMARK_RESULTS.json',
      JSON.stringify(results, null, 2)
    );

    console.log('\n✅ Resultados guardados en BENCHMARK_RESULTS.json');

  } catch (error) {
    console.error('❌ Error ejecutando benchmarks:', error);
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

/**
 * Imprimir resultado de benchmark
 */
function printResult(result: BenchmarkResult) {
  console.log(`  Scenario: ${result.scenario}`);
  console.log(`  Load Time: ${result.loadTime}ms`);
  console.log(`  Request Count: ${result.requestCount}`);
  console.log(`  Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
  console.log(`  Cache Hit Rate: ${result.cacheHitRate.toFixed(2)}%`);
  console.log(`  Timestamp: ${result.timestamp}`);
}

// Ejecutar benchmarks
runBenchmarks();
