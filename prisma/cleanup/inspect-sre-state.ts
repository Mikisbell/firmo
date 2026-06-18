/**
 * READ-ONLY: inspecciona qué dejó el experimento SRE/Edge en la base de datos.
 * NO modifica nada. Solo SELECTs sobre catálogos del sistema.
 * Usa PrismaClient nativo (engine TCP) — lee DATABASE_URL del entorno.
 * Uso: bun --env-file=.env.production prisma/cleanup/inspect-sre-state.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE_URL visible:', !!process.env.DATABASE_URL);

  const checks: Array<[string, string]> = [
    ['1_migracion_sre', `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%sre_native%'`],
    ['2_trigger_webhook', `SELECT tgname FROM pg_trigger WHERE tgname = 'on_event_inserted'`],
    ['3_funciones_sre', `SELECT proname FROM pg_proc WHERE proname IN ('trigger_projector_webhook','sre_fast_tracker','sre_scavenger')`],
    ['4_columnas_basura', `SELECT table_name FROM information_schema.columns WHERE column_name = 'last_processed_sequence' ORDER BY table_name`],
    ['5_pg_cron_instalado', `SELECT extname FROM pg_extension WHERE extname = 'pg_cron'`],
    ['6_global_sequence_en_events', `SELECT column_name FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'global_sequence'`],
  ];

  for (const [label, sql] of checks) {
    try {
      const rows = await prisma.$queryRawUnsafe(sql);
      const out = JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      console.log(`[${label}] ${out}`);
    } catch (e: any) {
      console.log(`[${label}] ERROR: ${e?.message ?? e}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL', e?.message ?? e);
  process.exit(1);
});
