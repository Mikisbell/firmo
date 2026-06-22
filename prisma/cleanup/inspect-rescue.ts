/**
 * READ-ONLY: busca optimizaciones del experimento que valga la pena RESCATAR
 * antes de limpiar (indices, columnas con uso real).
 * Uso: bun --env-file=.env prisma/cleanup/inspect-rescue.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const checks: Array<[string, string]> = [
    // Indices que toquen columnas del experimento
    ['indices_experimento', `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE indexdef ILIKE '%global_sequence%' OR indexdef ILIKE '%last_processed_sequence%'`],
    // ¿La columna global_sequence tiene datos reales (no todo NULL/0)?
    ['global_sequence_uso', `SELECT count(*) AS total, count(global_sequence) AS con_valor, min(global_sequence) AS min, max(global_sequence) AS max FROM events`],
    // Indices recientes en tablas calientes (para ver si agregaron algo util)
    ['indices_events', `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'events'`],
  ];
  for (const [label, sql] of checks) {
    try {
      const rows = await prisma.$queryRawUnsafe(sql);
      console.log(`\n[${label}]`);
      console.log(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
    } catch (e: any) {
      console.log(`[${label}] ERROR: ${e?.message ?? e}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error('FATAL', e?.message ?? e); process.exit(1); });
