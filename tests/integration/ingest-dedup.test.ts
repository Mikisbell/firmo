/**
 * Regresión del bug de SYNC EN LOOP (DB_ERROR 500 retryable infinito).
 *
 * Causa raíz: la dedup del ingest hacía `processed_events.create` + `catch(P2002)`.
 * En PostgreSQL una violación de constraint aborta TODA la transacción (25P02);
 * atrapar el P2002 a nivel Prisma NO la desenvenena, así que el siguiente
 * statement del batch reventaba con "current transaction is aborted" -> 500.
 * El outbox offline reintentaba el mismo batch (con el evento duplicado) para
 * siempre. Fix: `INSERT ... ON CONFLICT (event_id) DO NOTHING` (no levanta error).
 *
 * Este test corre contra la DB real (a diferencia del unit de ingest-api que
 * mockea Prisma y por eso NO podía reproducir el abort 25P02). Limpia por
 * tenant_id de prueba (NUNCA deleteMany({})).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '@/src/core/db/prisma';
import { markAsProcessed } from '@/src/core/events/mark-processed';

const TENANT = randomUUID();

function ev(eventId: string) {
  return {
    event_id: eventId,
    tenant_id: TENANT,
    aggregate_id: randomUUID(),
    event_type: 'ORDER_CREATED',
    occurred_at: new Date().toISOString(),
    terminal_id: 'T-DEDUP',
    actor_id: randomUUID(),
    payload: {},
  } as never;
}

describe('Ingest dedup — idempotencia sin envenenar la transacción', () => {
  beforeAll(async () => {
    await prisma.tenants.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Tenant Dedup' },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.processed_events.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.tenants.deleteMany({ where: { id: TENANT } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('un evento duplicado en el batch NO aborta la transacción (no 25P02)', async () => {
    const dupId = randomUUID();
    const freshId = randomUUID();

    // Reproduce el patrón del ingest: varios eventos en UNA transacción, donde
    // el primero ya fue procesado (duplicado). Si el dedup envenenara la tx, el
    // procesamiento del segundo evento reventaría con 25P02.
    const result = await prisma.$transaction(async (tx) => {
      // El "duplicado" ya existe en processed_events (procesado en un batch previo).
      const first = await markAsProcessed(tx, ev(dupId));   // inserta -> no duplicado
      const second = await markAsProcessed(tx, ev(dupId));  // MISMO id -> duplicado (ON CONFLICT)

      // CLAVE: el siguiente statement debe ejecutarse. Con el bug viejo, la tx
      // estaba abortada y esto tiraba "current transaction is aborted" (25P02).
      const third = await markAsProcessed(tx, ev(freshId)); // evento nuevo -> debe pasar

      return { first, second, third };
    });

    expect(result.first.isDuplicate).toBe(false);
    expect(result.second.isDuplicate).toBe(true);
    expect(result.third.isDuplicate).toBe(false); // la tx sobrevivió al duplicado
  });
});
