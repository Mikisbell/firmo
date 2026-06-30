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

// Definiciones exactas — tabla parametrizable: node diagnose-indices.mjs <tabla>
const TABLE = process.argv[2] || 'order_item_projections';
const defs = await prisma.$queryRawUnsafe(
  `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${TABLE}' ORDER BY indexname;`,
);
console.log(`\n=== DEFINICIONES (${TABLE}) ===`);
for (const d of defs) console.log(`• ${d.indexname}\n    ${d.indexdef.replace(/.*USING /, 'USING ')}`);

// Distribución / cardinalidad — ¿los índices tendrían sentido aún con tráfico?
const [stats] = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*)::int AS filas,
          pg_size_pretty(pg_total_relation_size('${TABLE}')) AS total,
          pg_size_pretty(pg_relation_size('${TABLE}'))       AS solo_tabla,
          pg_size_pretty(pg_indexes_size('${TABLE}'))        AS solo_indices
   FROM ${TABLE};`,
);
console.log(`\n=== TAMAÑO ${TABLE}: ${stats.filas} filas | total ${stats.total} (tabla ${stats.solo_tabla} + indices ${stats.solo_indices}) ===`);

await prisma.$disconnect();
