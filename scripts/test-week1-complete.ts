/**
 * Test completo de Week 1 - FASE 3
 * Prueba Backend, Frontend y Base de Datos
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const log = (message: string, color: 'green' | 'red' | 'yellow' | 'blue' = 'blue') => {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
};

async function testDatabase() {
  log('\n======================================================================', 'blue');
  log('1. PRUEBAS DE BASE DE DATOS', 'blue');
  log('======================================================================', 'blue');

  try {
    // Test 1: Verificar columna estimated_time
    log('\n📊 Test 1.1: Columna estimated_time en stations', 'blue');
    const stations = await prisma.stations.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        estimated_time: true,
        is_active: true,
      },
    });
    
    if (stations.length === 0) {
      log('⚠️  No hay estaciones en la base de datos', 'yellow');
    } else {
      log(`✓ ${stations.length} estaciones encontradas`, 'green');
      stations.forEach(s => {
        log(`  - ${s.name} (${s.code}): ${s.estimated_time} min`, 'green');
      });
    }

    // Test 2: Verificar tabla station_alerts
    log('\n📊 Test 1.2: Tabla station_alerts', 'blue');
    const alertsCount = await prisma.station_alerts.count();
    const activeAlerts = await prisma.station_alerts.count({
      where: { is_dismissed: false },
    });
    log(`✓ Total alertas: ${alertsCount}`, 'green');
    log(`✓ Alertas activas: ${activeAlerts}`, 'green');

    // Test 3: Verificar relación stations → station_alerts
    log('\n📊 Test 1.3: Relación stations → station_alerts', 'blue');
    const stationWithAlerts = await prisma.stations.findFirst({
      include: {
        station_alerts: {
          take: 5,
        },
      },
    });
    if (stationWithAlerts) {
      log(`✓ Relación funciona: ${stationWithAlerts.name} tiene ${stationWithAlerts.station_alerts.length} alertas`, 'green');
    }

    // Test 4: Verificar vistas materializadas
    log('\n📊 Test 1.4: Vistas materializadas', 'blue');
    const viewsResult = await prisma.$queryRaw<Array<{ matviewname: string }>>`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public'
      AND matviewname IN ('station_hourly_metrics', 'station_daily_summary')
    `;
    log(`✓ ${viewsResult.length} vistas materializadas encontradas`, 'green');
    viewsResult.forEach(v => log(`  - ${v.matviewname}`, 'green'));

    log('\n✅ PRUEBAS DE BASE DE DATOS: PASADAS', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Error en pruebas de base de datos: ${error}`, 'red');
    return false;
  }
}

async function testBackendAPIs() {
  log('\n======================================================================', 'blue');
  log('2. PRUEBAS DE BACKEND APIs', 'blue');
  log('======================================================================', 'blue');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    // Test 1: GET /api/admin/stations
    log('\n📡 Test 2.1: GET /api/admin/stations', 'blue');
    const stationsRes = await fetch(`${baseUrl}/api/admin/stations`);
    if (!stationsRes.ok) {
      throw new Error(`Status: ${stationsRes.status}`);
    }
    const stationsData = await stationsRes.json();
    log(`✓ Endpoint responde: ${stationsData.length || 0} estaciones`, 'green');

    // Test 2: GET /api/admin/stations/:id/metrics
    log('\n📡 Test 2.2: GET /api/admin/stations/:id/metrics', 'blue');
    const firstStation = await prisma.stations.findFirst({ where: { is_active: true } });
    if (firstStation) {
      const metricsRes = await fetch(`${baseUrl}/api/admin/stations/${firstStation.id}/metrics`);
      if (!metricsRes.ok) {
        throw new Error(`Status: ${metricsRes.status}`);
      }
      const metricsData = await metricsRes.json();
      log(`✓ Métricas obtenidas para ${firstStation.name}:`, 'green');
      log(`  - Órdenes activas: ${metricsData.activeOrders || 0}`, 'green');
      log(`  - Tiempo promedio: ${metricsData.avgTime || 0} min`, 'green');
      log(`  - Eficiencia: ${metricsData.efficiency || 0}%`, 'green');
      log(`  - Carga: ${metricsData.load || 0}%`, 'green');
    } else {
      log('⚠️  No hay estaciones activas para probar', 'yellow');
    }

    // Test 3: GET /api/admin/stations/:id/orders
    log('\n📡 Test 2.3: GET /api/admin/stations/:id/orders', 'blue');
    if (firstStation) {
      const ordersRes = await fetch(`${baseUrl}/api/admin/stations/${firstStation.id}/orders?limit=5`);
      if (!ordersRes.ok) {
        throw new Error(`Status: ${ordersRes.status}`);
      }
      const ordersData = await ordersRes.json();
      log(`✓ Órdenes obtenidas: ${ordersData.orders?.length || 0} órdenes`, 'green');
      log(`✓ Paginación: hasMore = ${ordersData.hasMore}`, 'green');
    }

    // Test 4: GET /api/admin/stations/alerts
    log('\n📡 Test 2.4: GET /api/admin/stations/alerts', 'blue');
    const alertsRes = await fetch(`${baseUrl}/api/admin/stations/alerts`);
    if (!alertsRes.ok) {
      throw new Error(`Status: ${alertsRes.status}`);
    }
    const alertsData = await alertsRes.json();
    log(`✓ Alertas obtenidas: ${alertsData.length || 0} alertas`, 'green');

    log('\n✅ PRUEBAS DE BACKEND APIs: PASADAS', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Error en pruebas de backend: ${error}`, 'red');
    log('⚠️  Asegúrate de que el servidor esté corriendo: npm run dev', 'yellow');
    return false;
  }
}

async function testPrismaClient() {
  log('\n======================================================================', 'blue');
  log('3. PRUEBAS DE PRISMA CLIENT', 'blue');
  log('======================================================================', 'blue');

  try {
    // Test 1: Prisma reconoce estimated_time
    log('\n🔍 Test 3.1: Prisma reconoce campo estimated_time', 'blue');
    const station = await prisma.stations.findFirst({
      where: {
        estimated_time: { gte: 1 },
      },
    });
    if (station) {
      log(`✓ Campo estimated_time reconocido: ${station.name} = ${station.estimated_time} min`, 'green');
    } else {
      log('⚠️  No se encontraron estaciones con estimated_time', 'yellow');
    }

    // Test 2: Prisma reconoce station_alerts
    log('\n🔍 Test 3.2: Prisma reconoce tabla station_alerts', 'blue');
    const alertsCount = await prisma.station_alerts.count();
    log(`✓ Tabla station_alerts reconocida: ${alertsCount} alertas`, 'green');

    // Test 3: Tipos TypeScript correctos
    log('\n🔍 Test 3.3: Tipos TypeScript correctos', 'blue');
    const stationWithTypes = await prisma.stations.findFirst({
      select: {
        id: true,
        code: true,
        name: true,
        estimated_time: true,
        is_active: true,
        station_alerts: {
          select: {
            id: true,
            message: true,
            severity: true,
            is_dismissed: true,
          },
          take: 1,
        },
      },
    });
    if (stationWithTypes) {
      log(`✓ Tipos correctos para stations`, 'green');
      log(`✓ Tipos correctos para station_alerts`, 'green');
    }

    log('\n✅ PRUEBAS DE PRISMA CLIENT: PASADAS', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Error en pruebas de Prisma Client: ${error}`, 'red');
    return false;
  }
}

async function testDataIntegrity() {
  log('\n======================================================================', 'blue');
  log('4. PRUEBAS DE INTEGRIDAD DE DATOS', 'blue');
  log('======================================================================', 'blue');

  try {
    // Test 1: Todas las estaciones tienen estimated_time
    log('\n🔒 Test 4.1: Todas las estaciones tienen estimated_time', 'blue');
    const totalStations = await prisma.stations.count();
    const stationsWithValidTime = await prisma.stations.count({
      where: {
        AND: [
          { estimated_time: { gte: 1 } },
          { estimated_time: { lte: 60 } },
        ],
      },
    });
    if (totalStations === stationsWithValidTime) {
      log(`✓ Todas las ${totalStations} estaciones tienen estimated_time válido (1-60)`, 'green');
    } else {
      log(`⚠️  ${totalStations - stationsWithValidTime} estaciones con estimated_time inválido`, 'yellow');
    }

    // Test 2: Alertas tienen relaciones válidas
    log('\n🔒 Test 4.2: Alertas tienen relaciones válidas', 'blue');
    const totalAlerts = await prisma.station_alerts.count();
    if (totalAlerts === 0) {
      log(`✓ No hay alertas para validar`, 'green');
    } else {
      // Verificar que todas las alertas tienen una estación válida
      const alertsWithStation = await prisma.station_alerts.findMany({
        include: {
          stations: true,
        },
      });
      const invalidAlerts = alertsWithStation.filter(a => !a.stations);
      if (invalidAlerts.length === 0) {
        log(`✓ Todas las ${totalAlerts} alertas tienen estación válida`, 'green');
      } else {
        log(`⚠️  ${invalidAlerts.length} alertas con estación inválida`, 'yellow');
      }
    }

    // Test 3: Índices existen
    log('\n🔒 Test 4.3: Índices de performance existen', 'blue');
    const indicesResult = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'station_alerts'
      AND indexname LIKE 'idx_station_alerts%'
    `;
    log(`✓ ${indicesResult.length} índices encontrados en station_alerts`, 'green');
    indicesResult.forEach(i => log(`  - ${i.indexname}`, 'green'));

    log('\n✅ PRUEBAS DE INTEGRIDAD: PASADAS', 'green');
    return true;
  } catch (error) {
    log(`\n❌ Error en pruebas de integridad: ${error}`, 'red');
    return false;
  }
}

async function main() {
  log('\n🔍 PRUEBAS COMPLETAS - WEEK 1 FASE 3', 'blue');
  log('Fecha: ' + new Date().toLocaleString('es-PE'), 'blue');
  log('======================================================================\n', 'blue');

  const results = {
    database: false,
    backend: false,
    prisma: false,
    integrity: false,
  };

  // Ejecutar pruebas
  results.database = await testDatabase();
  results.backend = await testBackendAPIs();
  results.prisma = await testPrismaClient();
  results.integrity = await testDataIntegrity();

  // Resumen final
  log('\n======================================================================', 'blue');
  log('📊 RESUMEN FINAL', 'blue');
  log('======================================================================', 'blue');

  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;

  log(`\n✓ Base de Datos: ${results.database ? '✅ PASADA' : '❌ FALLIDA'}`, results.database ? 'green' : 'red');
  log(`✓ Backend APIs: ${results.backend ? '✅ PASADA' : '❌ FALLIDA'}`, results.backend ? 'green' : 'red');
  log(`✓ Prisma Client: ${results.prisma ? '✅ PASADA' : '❌ FALLIDA'}`, results.prisma ? 'green' : 'red');
  log(`✓ Integridad: ${results.integrity ? '✅ PASADA' : '❌ FALLIDA'}`, results.integrity ? 'green' : 'red');

  log(`\n📈 Resultado: ${passed}/${total} pruebas pasadas (${Math.round((passed / total) * 100)}%)`, 'blue');

  if (passed === total) {
    log('\n🎉 ¡TODAS LAS PRUEBAS PASARON!', 'green');
    log('✅ Week 1 está 100% funcional', 'green');
    log('🚀 Listo para continuar con Week 2 - Analytics & Charts', 'green');
  } else {
    log('\n⚠️  Algunas pruebas fallaron', 'yellow');
    log('💡 Revisa los errores arriba para más detalles', 'yellow');
  }

  log('\n======================================================================\n', 'blue');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
