/**
 * Test Script for FASE 3 - Database & Schema Validation
 * 
 * Tests database migrations and schema changes only
 * 
 * Run: npx tsx scripts/test-fase3-database.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  log(title, 'cyan');
  console.log('='.repeat(70));
}

async function main() {
  log('\n🔍 PRUEBAS DE BASE DE DATOS - FASE 3', 'cyan');
  log('Fecha: ' + new Date().toLocaleString(), 'cyan');

  try {
    // 1. Test estimated_time column
    logSection('1. COLUMNA estimated_time EN STATIONS');
    
    const estimatedTimeColumn = await prisma.$queryRaw<any[]>`
      SELECT 
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stations' 
      AND column_name = 'estimated_time'
    `;

    if (estimatedTimeColumn.length > 0) {
      const col = estimatedTimeColumn[0];
      log(`✓ Columna existe`, 'green');
      log(`  - Tipo: ${col.data_type}`, 'green');
      log(`  - Default: ${col.column_default}`, 'green');
      log(`  - Nullable: ${col.is_nullable}`, 'green');
    } else {
      log(`✗ Columna estimated_time NO existe`, 'red');
      log(`  Ejecuta: psql -d park_pos -f prisma/migrations/20260122_add_estimated_time/migration.sql`, 'yellow');
    }

    // Check constraints
    const constraints = await prisma.$queryRaw<any[]>`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'stations'::regclass
      AND conname LIKE '%estimated%'
    `;

    if (constraints.length > 0) {
      log(`✓ Constraints encontrados: ${constraints.length}`, 'green');
      constraints.forEach(c => {
        log(`  - ${c.conname}: ${c.definition}`, 'green');
      });
    }

    // 2. Test station_alerts table
    logSection('2. TABLA station_alerts');

    const alertsTable = await prisma.$queryRaw<any[]>`
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_name = 'station_alerts'
    `;

    if (alertsTable.length > 0) {
      log(`✓ Tabla station_alerts existe`, 'green');

      const columns = await prisma.$queryRaw<any[]>`
        SELECT 
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = 'station_alerts'
        ORDER BY ordinal_position
      `;

      log(`  Columnas (${columns.length}):`, 'green');
      columns.forEach(c => {
        log(`    - ${c.column_name} (${c.data_type}) ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`, 'green');
      });

      // Check foreign keys
      const fkeys = await prisma.$queryRaw<any[]>`
        SELECT
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'station_alerts'::regclass
        AND contype = 'f'
      `;

      if (fkeys.length > 0) {
        log(`  Foreign Keys (${fkeys.length}):`, 'green');
        fkeys.forEach(fk => {
          log(`    - ${fk.conname}`, 'green');
        });
      }

    } else {
      log(`✗ Tabla station_alerts NO existe`, 'red');
      log(`  Ejecuta: psql -d park_pos -f prisma/migrations/20260122_create_station_alerts/migration.sql`, 'yellow');
    }

    // 3. Test performance indices
    logSection('3. ÍNDICES DE PERFORMANCE');

    const indices = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('sale_items', 'sales', 'station_alerts')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;

    if (indices.length > 0) {
      log(`✓ Índices encontrados: ${indices.length}`, 'green');
      
      const byTable: Record<string, any[]> = {};
      indices.forEach(idx => {
        if (!byTable[idx.tablename]) byTable[idx.tablename] = [];
        byTable[idx.tablename].push(idx);
      });

      Object.entries(byTable).forEach(([table, idxs]) => {
        log(`  ${table} (${idxs.length} índices):`, 'green');
        idxs.forEach(idx => {
          log(`    - ${idx.indexname}`, 'green');
        });
      });
    } else {
      log(`⚠ No se encontraron índices idx_*`, 'yellow');
      log(`  Ejecuta: psql -d park_pos -f prisma/migrations/20260122_add_metrics_indices/migration.sql`, 'yellow');
    }

    // 4. Test materialized views
    logSection('4. VISTAS MATERIALIZADAS');

    const views = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        matviewname,
        hasindexes,
        ispopulated
      FROM pg_matviews
      WHERE matviewname IN ('station_hourly_metrics', 'station_daily_summary')
    `;

    if (views.length > 0) {
      log(`✓ Vistas materializadas encontradas: ${views.length}`, 'green');
      views.forEach(v => {
        log(`  - ${v.matviewname}`, 'green');
        log(`    Populated: ${v.ispopulated ? 'Sí' : 'No'}`, v.ispopulated ? 'green' : 'yellow');
        log(`    Has Indexes: ${v.hasindexes ? 'Sí' : 'No'}`, 'green');
      });

      if (views.some(v => !v.ispopulated)) {
        log(`\n  ⚠ Algunas vistas no están pobladas. Ejecuta:`, 'yellow');
        log(`    REFRESH MATERIALIZED VIEW station_hourly_metrics;`, 'yellow');
        log(`    REFRESH MATERIALIZED VIEW station_daily_summary;`, 'yellow');
      }
    } else {
      log(`⚠ Vistas materializadas NO encontradas`, 'yellow');
      log(`  Ejecuta: psql -d park_pos -f prisma/migrations/20260122_create_materialized_views/migration.sql`, 'yellow');
    }

    // 5. Data integrity checks
    logSection('5. INTEGRIDAD DE DATOS');

    // Use raw SQL to avoid Prisma client cache issues
    const stationsResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM stations
    `;
    const activeStationsResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM stations WHERE is_active = true
    `;
    const stationsWithEstimatedTimeResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM stations WHERE estimated_time IS NOT NULL
    `;

    const stationsCount = Number(stationsResult[0].count);
    const activeStations = Number(activeStationsResult[0].count);
    const stationsWithEstimatedTime = Number(stationsWithEstimatedTimeResult[0].count);

    log(`✓ Total estaciones: ${stationsCount}`, 'green');
    log(`✓ Estaciones activas: ${activeStations}`, 'green');
    log(`✓ Con estimated_time: ${stationsWithEstimatedTime}`, 'green');

    if (stationsWithEstimatedTime < stationsCount) {
      log(`  ⚠ ${stationsCount - stationsWithEstimatedTime} estaciones sin estimated_time (usarán default)`, 'yellow');
    }

    // Check alerts using raw SQL
    try {
      const alertsResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM station_alerts
      `;
      const activeAlertsResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM station_alerts WHERE is_dismissed = false
      `;

      const alertsCount = Number(alertsResult[0].count);
      const activeAlerts = Number(activeAlertsResult[0].count);

      log(`✓ Total alertas: ${alertsCount}`, 'green');
      log(`✓ Alertas activas: ${activeAlerts}`, 'green');
    } catch (e) {
      log(`⚠ No se pudo consultar station_alerts (tabla puede no existir)`, 'yellow');
    }

    // Check orders for metrics (sale_items is stored as JSON in orders.items)
    try {
      const ordersCount = await prisma.orders.count();
      const ordersWithItems = await prisma.orders.count({
        where: {
          items: { not: '[]' },
        },
      });

      log(`✓ Total órdenes: ${ordersCount}`, 'green');
      log(`✓ Órdenes con items: ${ordersWithItems}`, 'green');
    } catch (e) {
      log(`⚠ No se pudo consultar orders`, 'yellow');
    }

    if (false) {
      log(`  ⚠ No hay items completados - métricas de tiempo promedio serán 0`, 'yellow');
    }

    // 6. Sample data
    logSection('6. DATOS DE EJEMPLO');

    const sampleStation = await prisma.stations.findFirst({
      where: { is_active: true },
      select: {
        id: true,
        code: true,
        name: true,
        estimated_time: true,
        is_active: true,
      },
    });

    if (sampleStation) {
      log(`✓ Estación de ejemplo:`, 'green');
      log(`  ID: ${sampleStation.id}`, 'green');
      log(`  Code: ${sampleStation.code}`, 'green');
      log(`  Name: ${sampleStation.name}`, 'green');
      log(`  Estimated Time: ${sampleStation.estimated_time} min`, 'green');
      log(`  Active: ${sampleStation.is_active}`, 'green');
    }

    // Summary
    logSection('✅ RESUMEN');
    log('Pruebas de base de datos completadas', 'green');
    log('\n📋 Estado de migraciones:', 'cyan');
    log(`  ${estimatedTimeColumn.length > 0 ? '✓' : '✗'} estimated_time column`, estimatedTimeColumn.length > 0 ? 'green' : 'red');
    log(`  ${alertsTable.length > 0 ? '✓' : '✗'} station_alerts table`, alertsTable.length > 0 ? 'green' : 'red');
    log(`  ${indices.length > 0 ? '✓' : '✗'} Performance indices`, indices.length > 0 ? 'green' : 'red');
    log(`  ${views.length > 0 ? '✓' : '✗'} Materialized views`, views.length > 0 ? 'green' : 'red');

    log('\n🚀 Próximos pasos:', 'cyan');
    log('1. Si faltan migraciones, ejecutarlas manualmente', 'yellow');
    log('2. Probar endpoints API con curl o Postman', 'yellow');
    log('3. Actualizar componentes frontend', 'yellow');

  } catch (error) {
    log(`\n❌ Error: ${error}`, 'red');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
