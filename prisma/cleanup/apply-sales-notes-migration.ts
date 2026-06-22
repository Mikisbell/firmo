/**
 * Aplica la migracion sales_notes via el adaptador pg del singleton (la misma
 * conexion que ya funciona en la app). Idempotente: CREATE ... IF NOT EXISTS.
 * Uso: bun --env-file=.env prisma/cleanup/apply-sales-notes-migration.ts
 */
import prisma from '@/src/core/db/prisma';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sales_notes (
    id           UUID NOT NULL,
    tenant_id    UUID NOT NULL,
    order_id     UUID NOT NULL,
    check_id     TEXT NOT NULL,
    serie        TEXT NOT NULL,
    numero       TEXT NOT NULL,
    total_cents  INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'OPEN',
    invoice_id   UUID,
    invoice_type TEXT,
    void_reason  TEXT,
    converted_at TIMESTAMPTZ(6),
    voided_at    TIMESTAMPTZ(6),
    created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT sales_notes_pkey PRIMARY KEY (id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sales_notes_tenant_order_check_key ON sales_notes(tenant_id, order_id, check_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sales_notes_tenant_serie_numero_key ON sales_notes(tenant_id, serie, numero)`,
  `CREATE INDEX IF NOT EXISTS sales_notes_tenant_created_idx ON sales_notes(tenant_id, created_at DESC)`,
];

async function main() {
  console.log('>> Aplicando migracion sales_notes a la cloud...');
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log('   ✅ ', sql.split('\n')[0].slice(0, 60).trim());
  }
  const count = await prisma.sales_notes.count();
  console.log(`\n✅ Tabla sales_notes lista (filas actuales: ${count})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('💥', e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
