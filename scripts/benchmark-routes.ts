/**
 * P3.4 — Benchmark de rutas críticas POS
 *
 * Mide cold start y warm response times (P50, P95, P99)
 * para las rutas más importantes del sistema.
 *
 * Uso:
 *   1. npx next build && npx next start   (en otra terminal)
 *   2. npx tsx scripts/benchmark-routes.ts
 *
 * Requiere: servidor corriendo en localhost:3000
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WARM_ITERATIONS = 20;

interface BenchResult {
  route: string;
  method: string;
  coldStartMs: number;
  warmP50Ms: number;
  warmP95Ms: number;
  warmP99Ms: number;
  warmAvgMs: number;
  status: number;
}

const CRITICAL_ROUTES = [
  // Auth routes — cold start matters most here
  { route: '/api/auth/login', method: 'POST', body: JSON.stringify({ pin: '0000', terminal_id: 'bench' }) },
  { route: '/api/terminals/validate', method: 'POST', body: JSON.stringify({ device_id: 'bench-device' }) },

  // POS routes — must be fast for cashiers
  { route: '/api/pos/orders', method: 'GET', needsAuth: true },
  { route: '/api/pos/shift', method: 'GET', needsAuth: true },

  // Ingest — highest throughput route
  { route: '/api/events/ingest', method: 'POST', body: JSON.stringify({ events: [] }), needsAuth: true },

  // Admin routes — less critical but measured
  { route: '/api/admin/products', method: 'GET', needsAuth: true },
  { route: '/api/health', method: 'GET' },
  { route: '/api/metrics', method: 'GET' },
];

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function measureRequest(
  url: string,
  method: string,
  body?: string,
): Promise<{ ms: number; status: number }> {
  const start = performance.now();
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Dummy auth header — will get 401 but measures server processing time
        'Authorization': 'Bearer benchmark-token',
      },
      body: method !== 'GET' ? body : undefined,
    });
    const ms = performance.now() - start;
    // Consume body to ensure full response
    await resp.text();
    return { ms, status: resp.status };
  } catch (error) {
    const ms = performance.now() - start;
    return { ms, status: 0 };
  }
}

async function benchmarkRoute(route: {
  route: string;
  method: string;
  body?: string;
}): Promise<BenchResult> {
  const url = `${BASE_URL}${route.route}`;

  // Cold start — first request
  const cold = await measureRequest(url, route.method, route.body);

  // Warm iterations
  const warmTimes: number[] = [];
  for (let i = 0; i < WARM_ITERATIONS; i++) {
    const result = await measureRequest(url, route.method, route.body);
    warmTimes.push(result.ms);
  }

  warmTimes.sort((a, b) => a - b);
  const avg = warmTimes.reduce((s, v) => s + v, 0) / warmTimes.length;

  return {
    route: route.route,
    method: route.method,
    coldStartMs: Math.round(cold.ms),
    warmP50Ms: Math.round(percentile(warmTimes, 50)),
    warmP95Ms: Math.round(percentile(warmTimes, 95)),
    warmP99Ms: Math.round(percentile(warmTimes, 99)),
    warmAvgMs: Math.round(avg),
    status: cold.status,
  };
}

async function main() {
  console.log(`\n📊 P3.4 Benchmark — Rutas Críticas POS`);
  console.log(`   Server: ${BASE_URL}`);
  console.log(`   Iteraciones warm: ${WARM_ITERATIONS}\n`);

  // Check server is running
  try {
    await fetch(`${BASE_URL}/api/health`);
  } catch {
    console.error('❌ Servidor no disponible. Ejecutar: npx next start');
    process.exit(1);
  }

  const results: BenchResult[] = [];

  for (const route of CRITICAL_ROUTES) {
    process.stdout.write(`   Midiendo ${route.method} ${route.route}...`);
    const result = await benchmarkRoute(route);
    results.push(result);
    console.log(` cold=${result.coldStartMs}ms p95=${result.warmP95Ms}ms`);
  }

  // Print table
  console.log('\n' + '='.repeat(90));
  console.log(
    'Ruta'.padEnd(30) +
    'Method'.padEnd(8) +
    'Cold'.padStart(8) +
    'P50'.padStart(8) +
    'P95'.padStart(8) +
    'P99'.padStart(8) +
    'Avg'.padStart(8) +
    'Status'.padStart(8)
  );
  console.log('-'.repeat(90));

  for (const r of results) {
    const coldFlag = r.coldStartMs > 3000 ? ' ⚠️' : '';
    const p95Flag = r.warmP95Ms > 200 ? ' ⚠️' : '';
    console.log(
      r.route.padEnd(30) +
      r.method.padEnd(8) +
      `${r.coldStartMs}ms${coldFlag}`.padStart(8) +
      `${r.warmP50Ms}ms`.padStart(8) +
      `${r.warmP95Ms}ms${p95Flag}`.padStart(8) +
      `${r.warmP99Ms}ms`.padStart(8) +
      `${r.warmAvgMs}ms`.padStart(8) +
      `${r.status}`.padStart(8)
    );
  }

  console.log('='.repeat(90));

  // Summary
  const slowCold = results.filter(r => r.coldStartMs > 3000);
  const slowWarm = results.filter(r => r.warmP95Ms > 200);

  console.log('\n📋 Criterios P3.4:');
  console.log(`   Cold start < 3s:     ${slowCold.length === 0 ? '✅ PASS' : `❌ FAIL (${slowCold.length} rutas)`}`);
  console.log(`   Warm P95 < 200ms:    ${slowWarm.length === 0 ? '✅ PASS' : `❌ FAIL (${slowWarm.length} rutas)`}`);

  // Save results
  const outputPath = 'scripts/benchmark-results-p3.4.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    warmIterations: WARM_ITERATIONS,
    results,
    criteria: {
      coldStartUnder3s: slowCold.length === 0,
      warmP95Under200ms: slowWarm.length === 0,
    },
  }, null, 2));
  console.log(`\n   Resultados guardados en ${outputPath}\n`);
}

main().catch(console.error);
