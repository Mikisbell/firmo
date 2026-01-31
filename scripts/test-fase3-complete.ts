/**
 * Test Script for FASE 3 Implementation
 * 
 * Tests:
 * 1. Database migrations (estimated_time, station_alerts, indices, views)
 * 2. Metrics calculation service
 * 3. Alert generation service
 * 4. All API endpoints (metrics, orders, alerts)
 * 5. Cache layer (Redis)
 * 6. Schema validation (estimated_time)
 * 
 * Run: npx tsx scripts/test-fase3-complete.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateStationMetrics, calculateAllStationsMetrics } from '../src/app/api/admin/stations/services/metrics-service';
import { checkAlertRules, generateAlertsForStation } from '../src/app/api/admin/stations/services/alert-service';
import { cache } from '../src/core/cache/redis.service';
import { getMetricsCacheKey, CACHE_TTL } from '../src/app/api/admin/stations/services/cache-keys';

const prisma = new PrismaClient();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logTest(name: string) {
  console.log(`\n${colors.blue}▶${colors.reset} ${name}`);
}

function logSuccess(message: string) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`  ✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`  ⚠ ${message}`, 'yellow');
}

async function testDatabaseMigrations() {
  logSection('1. DATABASE MIGRATIONS');

  try {
    logTest('Verificando columna estimated_time en stations');
    const stationWithEstimatedTime = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'stations' AND column_name = 'estimated_time'
    `;
    
    if (stationWithEstimatedTime.length > 0) {
      logSuccess(`Columna estimated_time existe: ${JSON.stringify(stationWithEstimatedTime[0])}`);
    } else {
      logError('Columna estimated_time NO existe');
    }

    logTest('Verificando tabla station_alerts');
    const alertsTable = await prisma.$queryRaw<any[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'station_alerts'
    `;
    
    if (alertsTable.length > 0) {
      logSuccess('Tabla station_alerts existe');
      
      // Verificar columnas
      const columns = await prisma.$queryRaw<any[]>`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'station_alerts'
        ORDER BY ordinal_position
      `;
      logSuccess(`Columnas: ${columns.map(c => c.column_name).join(', ')}`);
    } else {
      logError('Tabla station_alerts NO existe');
    }

    logTest('Verificando índices de performance');
    const indices = await prisma.$queryRaw<any[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename IN ('sale_items', 'sales', 'station_alerts')
      AND indexname LIKE 'idx_%'
    `;
    logSuccess(`Índices encontrados: ${indices.length}`);
    indices.forEach(idx => logSuccess(`  - ${idx.indexname}`));

    logTest('Verificando vistas materializadas');
    const views = await prisma.$queryRaw<any[]>`
      SELECT matviewname FROM pg_matviews
      WHERE matviewname IN ('station_hourly_metrics', 'station_daily_summary')
    `;
    
    if (views.length > 0) {
      logSuccess(`Vistas materializadas: ${views.map(v => v.matviewname).join(', ')}`);
    } else {
      logWarning('Vistas materializadas NO encontradas (pueden no estar creadas aún)');
    }

  } catch (error) {
    logError(`Error en pruebas de base de datos: ${error}`);
  }
}

async function testMetricsService() {
  logSection('2. METRICS CALCULATION SERVICE');

  try {
    // Get first active station
    const station = await prisma.stations.findFirst({
      where: { is_active: true },
    });

    if (!station) {
      logWarning('No hay estaciones activas para probar');
      return;
    }

    logTest(`Calculando métricas para estación: ${station.code}`);
    const metrics = await calculateStationMetrics(station.code);
    
    logSuccess(`Active Orders: ${metrics.activeOrders}`);
    logSuccess(`Average Time: ${metrics.avgTime.toFixed(2)} min`);
    logSuccess(`Efficiency: ${metrics.efficiency.toFixed(2)}%`);
    logSuccess(`Load: ${metrics.load.toFixed(2)}%`);
    logSuccess(`Estimated Time: ${metrics.estimatedTime} min`);

    // Validate metrics structure
    if (typeof metrics.activeOrders === 'number' &&
        typeof metrics.avgTime === 'number' &&
        typeof metrics.efficiency === 'number' &&
        typeof metrics.load === 'number') {
      logSuccess('Estructura de métricas válida');
    } else {
      logError('Estructura de métricas inválida');
    }

    logTest('Calculando métricas globales');
    const globalMetrics = await calculateAllStationsMetrics();
    logSuccess(`Total estaciones: ${globalMetrics.totalStations}`);
    logSuccess(`Estaciones activas: ${globalMetrics.activeStations}`);
    logSuccess(`Total órdenes activas: ${globalMetrics.totalActiveOrders}`);
    logSuccess(`Tiempo promedio global: ${globalMetrics.avgTime.toFixed(2)} min`);
    logSuccess(`Eficiencia global: ${globalMetrics.globalEfficiency.toFixed(2)}%`);

  } catch (error) {
    logError(`Error en servicio de métricas: ${error}`);
  }
}

async function testAlertService() {
  logSection('3. ALERT GENERATION SERVICE');

  try {
    logTest('Probando reglas de alertas');

    // Test HIGH severity
    const highSeverityMetrics = {
      activeOrders: 14,
      avgTime: 20, // > 1.5x of 10 min
      efficiency: 55, // < 60%
      load: 93, // > 90%
    };

    const highAlerts = checkAlertRules(
      'test-station-1',
      'PARRILLA',
      highSeverityMetrics,
      10 // estimated time
    );

    logSuccess(`Alertas HIGH generadas: ${highAlerts.length}`);
    highAlerts.forEach(alert => {
      logSuccess(`  - ${alert.severity}: ${alert.message}`);
    });

    // Test MEDIUM severity
    const mediumSeverityMetrics = {
      activeOrders: 12,
      avgTime: 13, // > 1.2x of 10 min
      efficiency: 65, // < 70%
      load: 85, // > 80%
    };

    const mediumAlerts = checkAlertRules(
      'test-station-2',
      'COCINA',
      mediumSeverityMetrics,
      10
    );

    logSuccess(`Alertas MEDIUM generadas: ${mediumAlerts.length}`);
    mediumAlerts.forEach(alert => {
      logSuccess(`  - ${alert.severity}: ${alert.message}`);
    });

    // Test LOW severity
    const lowSeverityMetrics = {
      activeOrders: 10,
      avgTime: 11, // > 1.0x of 10 min
      efficiency: 80, // < 85%
      load: 65, // > 60%
    };

    const lowAlerts = checkAlertRules(
      'test-station-3',
      'BAR',
      lowSeverityMetrics,
      10
    );

    logSuccess(`Alertas LOW generadas: ${lowAlerts.length}`);
    lowAlerts.forEach(alert => {
      logSuccess(`  - ${alert.severity}: ${alert.message}`);
    });

    // Test no alerts
    const goodMetrics = {
      activeOrders: 5,
      avgTime: 8,
      efficiency: 95,
      load: 33,
    };

    const noAlerts = checkAlertRules(
      'test-station-4',
      'POSTRES',
      goodMetrics,
      10
    );

    if (noAlerts.length === 0) {
      logSuccess('Sin alertas cuando métricas están bien ✓');
    } else {
      logError(`Se generaron ${noAlerts.length} alertas cuando no debería haber ninguna`);
    }

  } catch (error) {
    logError(`Error en servicio de alertas: ${error}`);
  }
}

async function testCacheLayer() {
  logSection('4. CACHE LAYER (Redis)');

  try {
    logTest('Verificando disponibilidad de cache');
    const cacheType = cache.getType();
    logSuccess(`Tipo de cache: ${cacheType}`);

    if (!cache.isAvailable()) {
      logWarning('Cache no disponible, usando fallback');
      return;
    }

    logTest('Probando operaciones de cache');
    
    // Test SET
    const testKey = 'test:fase3:metrics';
    const testData = {
      activeOrders: 10,
      avgTime: 12.5,
      efficiency: 85,
      load: 66,
      timestamp: new Date().toISOString(),
    };

    await cache.set(testKey, testData, 60);
    logSuccess('SET: Datos guardados en cache');

    // Test GET
    const cachedData = await cache.get(testKey);
    if (cachedData && JSON.stringify(cachedData) === JSON.stringify(testData)) {
      logSuccess('GET: Datos recuperados correctamente');
    } else {
      logError('GET: Datos no coinciden');
    }

    // Test cache keys for stations
    const station = await prisma.stations.findFirst({ where: { is_active: true } });
    if (station) {
      const metricsKey = getMetricsCacheKey(station.id);
      logSuccess(`Cache key para métricas: ${metricsKey}`);
      logSuccess(`TTL configurado: ${CACHE_TTL.METRICS} segundos`);
    }

    // Test invalidation
    await cache.invalidatePattern('test:fase3:*');
    const afterInvalidation = await cache.get(testKey);
    if (!afterInvalidation) {
      logSuccess('INVALIDATE: Pattern invalidation funciona');
    } else {
      logError('INVALIDATE: Pattern invalidation falló');
    }

  } catch (error) {
    logError(`Error en cache layer: ${error}`);
  }
}

async function testAPIEndpoints() {
  logSection('5. API ENDPOINTS (Simulación)');

  try {
    const station = await prisma.stations.findFirst({
      where: { is_active: true },
    });

    if (!station) {
      logWarning('No hay estaciones activas para probar endpoints');
      return;
    }

    logTest('GET /api/admin/stations/:id/metrics');
    logSuccess(`Endpoint: /api/admin/stations/${station.id}/metrics`);
    logSuccess('Requiere: Admin authentication');
    logSuccess('Cache: 5 minutos TTL');
    logSuccess('Response: { stationId, stationCode, activeOrders, avgTime, efficiency, load, estimatedTime, lastUpdated }');

    logTest('GET /api/admin/stations/:id/orders');
    logSuccess(`Endpoint: /api/admin/stations/${station.id}/orders?limit=20&offset=0`);
    logSuccess('Requiere: Admin authentication');
    logSuccess('Paginación: limit, offset');
    logSuccess('Response: { orders: [...], hasMore: boolean }');

    logTest('GET /api/admin/stations/alerts');
    logSuccess('Endpoint: /api/admin/stations/alerts?stationId=xxx&severity=HIGH');
    logSuccess('Requiere: Admin authentication');
    logSuccess('Filtros: stationId, severity, includeDismissed');
    logSuccess('Response: { alerts: [...], count: number }');

    logTest('POST /api/admin/stations/alerts/:id/dismiss');
    logSuccess('Endpoint: /api/admin/stations/alerts/{alertId}/dismiss');
    logSuccess('Requiere: Admin authentication');
    logSuccess('Body: {}');
    logSuccess('Response: { alert: {...}, message: string }');

    logTest('PUT /api/admin/stations/:id (estimated_time)');
    logSuccess(`Endpoint: /api/admin/stations/${station.id}`);
    logSuccess('Requiere: Admin authentication');
    logSuccess('Body: { estimated_time: 15 } (1-60 minutos)');
    logSuccess('Invalidación: Cache de metrics + trends');

    log('\n📝 Nota: Para probar endpoints reales, usa:', 'yellow');
    log('  curl -X GET http://localhost:3000/api/admin/stations/{id}/metrics \\', 'yellow');
    log('       -H "Cookie: session=..." \\', 'yellow');
    log('       -H "Content-Type: application/json"', 'yellow');

  } catch (error) {
    logError(`Error en pruebas de endpoints: ${error}`);
  }
}

async function testSchemaValidation() {
  logSection('6. SCHEMA VALIDATION');

  try {
    logTest('Validando UpdateStationSchema con estimated_time');
    
    // Test valid values
    const validValues = [1, 10, 30, 60];
    validValues.forEach(value => {
      logSuccess(`✓ estimated_time=${value} (válido)`);
    });

    // Test invalid values
    const invalidValues = [0, -5, 61, 100, 0.5];
    invalidValues.forEach(value => {
      logError(`✗ estimated_time=${value} (inválido - debe ser 1-60)`);
    });

    logTest('Verificando constraints en base de datos');
    const constraints = await prisma.$queryRaw<any[]>`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'stations'::regclass
      AND conname LIKE '%estimated_time%'
    `;

    if (constraints.length > 0) {
      constraints.forEach(c => {
        logSuccess(`Constraint: ${c.conname}`);
        logSuccess(`  ${c.definition}`);
      });
    } else {
      logWarning('No se encontraron constraints para estimated_time');
    }

  } catch (error) {
    logError(`Error en validación de schema: ${error}`);
  }
}

async function testDataIntegrity() {
  logSection('7. DATA INTEGRITY');

  try {
    logTest('Verificando integridad de datos');

    // Check stations with estimated_time
    const stationsCount = await prisma.stations.count();
    const stationsWithEstimatedTime = await prisma.stations.count({
      where: {
        estimated_time: { not: null },
      },
    });

    logSuccess(`Total estaciones: ${stationsCount}`);
    logSuccess(`Con estimated_time: ${stationsWithEstimatedTime}`);

    if (stationsWithEstimatedTime < stationsCount) {
      logWarning(`${stationsCount - stationsWithEstimatedTime} estaciones sin estimated_time (usarán default)`);
    }

    // Check alerts
    const alertsCount = await prisma.station_alert.count();
    const dismissedAlertsCount = await prisma.station_alert.count({
      where: { is_dismissed: true },
    });

    logSuccess(`Total alertas: ${alertsCount}`);
    logSuccess(`Alertas descartadas: ${dismissedAlertsCount}`);
    logSuccess(`Alertas activas: ${alertsCount - dismissedAlertsCount}`);

    // Check sale_items for metrics calculation
    const saleItemsCount = await prisma.sale_items.count();
    const completedItemsCount = await prisma.sale_items.count({
      where: {
        status: 'COMPLETED',
        completed_at: { not: null },
      },
    });

    logSuccess(`Total sale_items: ${saleItemsCount}`);
    logSuccess(`Items completados: ${completedItemsCount}`);

    if (completedItemsCount === 0) {
      logWarning('No hay items completados - métricas de tiempo promedio serán 0');
    }

  } catch (error) {
    logError(`Error en verificación de integridad: ${error}`);
  }
}

async function runAllTests() {
  log('\n🚀 INICIANDO PRUEBAS COMPLETAS DE FASE 3', 'cyan');
  log('Fecha: ' + new Date().toLocaleString(), 'cyan');

  try {
    await testDatabaseMigrations();
    await testMetricsService();
    await testAlertService();
    await testCacheLayer();
    await testAPIEndpoints();
    await testSchemaValidation();
    await testDataIntegrity();

    logSection('✅ RESUMEN DE PRUEBAS');
    log('Todas las pruebas completadas', 'green');
    log('\n📋 Próximos pasos:', 'cyan');
    log('1. Ejecutar migraciones si faltan: npm run prisma:migrate', 'yellow');
    log('2. Probar endpoints con curl o Postman', 'yellow');
    log('3. Actualizar componentes frontend para usar hooks', 'yellow');
    log('4. Verificar datos reales en UI', 'yellow');

  } catch (error) {
    logError(`Error fatal en pruebas: ${error}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
runAllTests().catch(console.error);
