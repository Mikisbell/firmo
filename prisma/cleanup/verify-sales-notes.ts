/**
 * PRUEBA REAL de Nota de Venta contra la DB cloud: aplica los handlers de
 * proyeccion y verifica los fail-proofs (unique por check, guardas de estado).
 * Uso: bun --env-file=.env prisma/cleanup/verify-sales-notes.ts
 * Limpia sus datos al final (deleteMany por tenant_id de prueba).
 */
import prisma from '@/src/core/db/prisma';
import {
  handleSalesNoteIssued,
  handleSalesNoteConverted,
  handleSalesNoteVoided,
} from '@/src/core/events/projections/sales-note-projections';
import { randomUUID } from 'node:crypto';

const TENANT = randomUUID();
const ORDER = randomUUID();
const CHECK = 'c1';
const NOTE1 = randomUUID();
const NOTE2 = randomUUID();
const INVOICE = randomUUID();

function ev(event_type: string, payload: Record<string, unknown>) {
  return {
    event_id: randomUUID(),
    tenant_id: TENANT,
    occurred_at: new Date().toISOString(),
    event_type,
    payload,
  } as any;
}

let pass = 0;
let fail = 0;
const check = (cond: boolean, label: string) => {
  if (cond) { pass++; console.log(`   ✅ ${label}`); }
  else { fail++; console.log(`   ❌ ${label}`); }
};

async function main() {
  console.log('>> Verificando tabla sales_notes en cloud...');
  const baseline = await prisma.sales_notes.count({ where: { tenant_id: TENANT } });
  check(baseline === 0, 'tabla existe y consulta funciona (count=0 para tenant nuevo)');

  // 1. ISSUED -> OPEN
  await handleSalesNoteIssued(prisma as any, ev('SALES_NOTE_ISSUED', {
    sales_note_id: NOTE1, order_id: ORDER, check_id: CHECK, serie: 'NVT001', numero: '00000001', total_cents: 2500,
  }));
  const n1 = await prisma.sales_notes.findUnique({ where: { id: NOTE1 } });
  check(n1?.status === 'OPEN' && n1?.total_cents === 2500, 'ISSUED crea nota OPEN con total en centavos');

  // 2. Fail-proof: segunda nota para el MISMO check no debe crear fila nueva (upsert idempotente)
  await handleSalesNoteIssued(prisma as any, ev('SALES_NOTE_ISSUED', {
    sales_note_id: NOTE2, order_id: ORDER, check_id: CHECK, serie: 'NVT001', numero: '00000002', total_cents: 9999,
  }));
  const countCheck = await prisma.sales_notes.count({ where: { tenant_id: TENANT, order_id: ORDER, check_id: CHECK } });
  check(countCheck === 1, 'una sola nota por check (no doble emision)');

  // 3. CONVERTED (OPEN -> CONVERTED)
  await handleSalesNoteConverted(prisma as any, ev('SALES_NOTE_CONVERTED', {
    sales_note_id: NOTE1, invoice_id: INVOICE, invoice_type: 'BOLETA',
  }));
  const n1c = await prisma.sales_notes.findUnique({ where: { id: NOTE1 } });
  check(n1c?.status === 'CONVERTED' && n1c?.invoice_id === INVOICE, 'CONVERTED enlaza el comprobante');

  // 4. Fail-proof: VOID sobre una CONVERTED no debe cambiarla
  await handleSalesNoteVoided(prisma as any, ev('SALES_NOTE_VOIDED', {
    sales_note_id: NOTE1, reason: 'INTENTO INVALIDO',
  }));
  const n1v = await prisma.sales_notes.findUnique({ where: { id: NOTE1 } });
  check(n1v?.status === 'CONVERTED' && !n1v?.void_reason, 'no se puede anular una nota CONVERTIDA');

  // 5. Nota nueva en otro check -> VOID OK
  const ORDER2 = randomUUID();
  const NOTE3 = randomUUID();
  await handleSalesNoteIssued(prisma as any, ev('SALES_NOTE_ISSUED', {
    sales_note_id: NOTE3, order_id: ORDER2, check_id: CHECK, serie: 'NVT001', numero: '00000003', total_cents: 1500,
  }));
  await handleSalesNoteVoided(prisma as any, ev('SALES_NOTE_VOIDED', {
    sales_note_id: NOTE3, reason: 'CLIENTE SE RETIRO',
  }));
  const n3 = await prisma.sales_notes.findUnique({ where: { id: NOTE3 } });
  check(n3?.status === 'VOIDED' && n3?.void_reason === 'CLIENTE SE RETIRO', 'VOID sobre OPEN funciona y guarda motivo');

  // 6. Fail-proof: CONVERT sobre una VOIDED no debe cambiarla
  await handleSalesNoteConverted(prisma as any, ev('SALES_NOTE_CONVERTED', {
    sales_note_id: NOTE3, invoice_id: randomUUID(), invoice_type: 'FACTURA',
  }));
  const n3c = await prisma.sales_notes.findUnique({ where: { id: NOTE3 } });
  check(n3c?.status === 'VOIDED', 'no se puede convertir una nota ANULADA');

  // Cleanup (NUNCA deleteMany({}))
  await prisma.sales_notes.deleteMany({ where: { tenant_id: TENANT } });
  const after = await prisma.sales_notes.count({ where: { tenant_id: TENANT } });
  check(after === 0, 'cleanup ok (datos de prueba eliminados)');

  console.log(`\n${fail === 0 ? '✅✅✅ TODO PASA' : '⚠️ HAY FALLAS'} — ${pass} ok, ${fail} fallas`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error('💥', e instanceof Error ? e.message : e);
  await prisma.sales_notes.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
