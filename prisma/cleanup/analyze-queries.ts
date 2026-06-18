/**
 * READ-ONLY: analisis senior de performance. NO modifica nada.
 *   - pg_stat_statements: queries mas caras (si la extension existe)
 *   - auditoria de indices en tablas calientes
 *   - tablas multi-tenant sin indice por tenant_id (smell)
 * Uso: bun --env-file=.env prisma/cleanup/analyze-queries.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function q(label: string, sql: string) {
  try {
    const rows = await prisma.$queryRawUnsafe(sql);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
  } catch (e: any) {
    console.log(`\n=== ${label} === ERROR: ${(e?.message ?? e).slice(0, 200)}`);
  }
}

async function main() {
  await q('pg_stat_statements instalado?', `SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'`);

  // Top queries por tiempo total (normalizadas; sin literales sensibles)
  await q('TOP 15 queries por tiempo total', `
    SELECT calls, round(total_exec_time::numeric, 1) AS total_ms,
           round(mean_exec_time::numeric, 2) AS mean_ms, rows,
           left(query, 130) AS query
    FROM pg_stat_statements
    WHERE query NOT ILIKE '%pg_stat_statements%' AND query NOT ILIKE '%information_schema%'
    ORDER BY total_exec_time DESC LIMIT 15`);

  // Conteo de indices por tabla de negocio
  await q('Indices por tabla caliente', `
    SELECT tablename, count(*) AS idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('events','orders','payments','invoices','checks','order_item_projections','shifts','employees','tables')
    GROUP BY tablename ORDER BY tablename`);

  // Tablas con columna tenant_id pero SIN indice que la lidere (smell multi-tenant)
  await q('Tablas con tenant_id SIN indice liderado por tenant_id', `
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.column_name = 'tenant_id'
      AND NOT EXISTS (
        SELECT 1 FROM pg_indexes i
        WHERE i.schemaname = 'public' AND i.tablename = c.table_name
          AND i.indexdef ILIKE '%(tenant_id%'
      )
    ORDER BY c.table_name LIMIT 40`);

  // Tamano aproximado de tablas calientes (para priorizar)
  await q('Tablas mas grandes (top 12)', `
    SELECT relname AS tabla, n_live_tup AS filas_aprox
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC LIMIT 12`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error('FATAL', e?.message ?? e); process.exit(1); });
