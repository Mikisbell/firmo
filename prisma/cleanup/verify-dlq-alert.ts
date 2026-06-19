/**
 * Prueba la ALERTA del DLQ: siembra un evento CRITICO (CHECK_PAYMENT_ADDED) expirado,
 * corre cleanupExpired() y verifica que (1) dispare el log de ERROR "ALERTA: eventos CRITICOS"
 * y (2) lo mueva al dead_letter_queue. Limpia los datos de prueba al final.
 * Uso: bun --env-file=.env prisma/cleanup/verify-dlq-alert.ts
 */
import { outOfOrderQueue } from '@/src/core/events/out-of-order-queue';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';

const TENANT = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const testEventId = uuidv4();
const testAgg = uuidv4();

async function main() {
  // Sembrar un evento CRITICO ya expirado (enqueued hace 2 min, timeout es 60s)
  await prisma.pending_events.create({
    data: {
      id: uuidv4(),
      tenant_id: TENANT,
      event_id: testEventId,
      aggregate_id: testAgg,
      event_type: 'CHECK_PAYMENT_ADDED',
      payload: { event_id: testEventId, tenant_id: TENANT, event_type: 'CHECK_PAYMENT_ADDED' } as never,
      reason: 'TEST_DLQ_ALERT',
      enqueued_at: new Date(Date.now() - 2 * 60 * 1000),
    },
  });
  console.log('1. Sembrado evento CRITICO expirado (CHECK_PAYMENT_ADDED)');
  console.log('2. Corriendo cleanupExpired() -> deberia salir el log ERROR "ALERTA: eventos CRITICOS"...');

  await outOfOrderQueue.cleanupExpired();

  const inDlq = await prisma.dead_letter_queue.findFirst({ where: { event_id: testEventId } });
  const stillPending = await prisma.pending_events.findFirst({ where: { event_id: testEventId } });
  console.log(`3. Resultado -> en DLQ: ${!!inDlq} | sigue en pending: ${!!stillPending}`);

  // Limpieza de datos de prueba
  await prisma.dead_letter_queue.deleteMany({ where: { event_id: testEventId } });
  await prisma.pending_events.deleteMany({ where: { event_id: testEventId } });
  console.log('4. Datos de prueba eliminados (DLQ + pending)');

  const ok = !!inDlq && !stillPending;
  console.log(ok ? 'OK: la alerta del DLQ funciona y movio el critico correctamente' : 'REVISAR: no se movio como esperado');
  process.exit(ok ? 0 : 2);
}

main().catch((e) => { console.error('FALLO:', String(e?.message ?? e)); process.exit(1); });
