// Diagnóstico TEMPORAL: uso real de índices (pg_stat_user_indexes).
// Read-only. Correr: node --env-file=.env scripts/_diag-indices.mjs
// idx_scan = cuántas veces Postgres usó ese índice desde el último reset de stats.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rows = await prisma.$queryRaw`
  SELECT
    relname        AS tabla,
    indexrelname   AS indice,
    idx_scan       AS scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS tamano
  FROM pg_stat_user_indexes
  WHERE relname IN ('order_item_projections','events','processed_events','orders','event_outbox')
  ORDER BY relname, idx_scan ASC;
`;

const pretty = rows.map((r) => ({
  tabla: r.tabla,
  indice: r.indice,
  scans: Number(r.scans),
  tamano: r.tamano,
}));

console.table(pretty);

// Resaltar candidatos a revisión (idx_scan = 0)
const muertos = pretty.filter((r) => r.scans === 0 && !r.indice.includes('pkey'));
if (muertos.length) {
  console.log('\n⚠️  Índices con 0 scans en ESTA DB (revisar, no dropear a ciegas):');
  for (const m of muertos) console.log(`   ${m.tabla}.${m.indice}  (${m.tamano})`);
} else {
  console.log('\n✅ Todos los índices de las tablas calientes registran uso (>0 scans).');
}

// Definiciones exactas — confirmar si hay duplicados reales
const defs = await prisma.$queryRaw`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE tablename = 'order_item_projections'
  ORDER BY indexname;
`;
console.log('\n=== DEFINICIONES (order_item_projections) ===');
for (const d of defs) console.log(`• ${d.indexname}\n    ${d.indexdef.replace(/.*USING /, 'USING ')}`);

// Distribución / cardinalidad — ¿los índices tendrían sentido aún con tráfico?
const dist = await prisma.$queryRaw`
  SELECT
    COUNT(*)::int                                          AS total_filas,
    COUNT(DISTINCT station)::int                           AS stations_distintas,
    COUNT(DISTINCT table_number)::int                      AS mesas_distintas,
    COUNT(*) FILTER (WHERE station IS NULL)::int           AS station_null,
    COUNT(*) FILTER (WHERE table_number IS NULL)::int      AS table_number_null,
    COUNT(DISTINCT status)::int                            AS status_distintos
  FROM order_item_projections;
`;
console.log('\n=== DISTRIBUCIÓN de datos en order_item_projections ===');
console.table(dist.map((r) => ({ ...r })));

await prisma.$disconnect();
