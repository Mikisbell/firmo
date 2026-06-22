// src/core/events/mark-processed.ts
// Primitiva de IDEMPOTENCIA del ingest: marca un evento como procesado de
// forma atómica y SIN poder envenenar la transacción del caller.
import { Prisma } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/structured-logger";

/**
 * Marca un evento como procesado dentro de la transacción `tx`.
 *
 * IDEMPOTENCIA SIN ENVENENAR LA TRANSACCIÓN.
 *
 * Implementación anterior: `processed_events.create` + `catch (P2002)`.
 * PROBLEMA GRAVE: en PostgreSQL, una violación de constraint aborta TODA la
 * transacción (estado 25P02). Atrapar el P2002 a nivel Prisma NO la
 * desenvenena: el siguiente statement del batch revienta con "current
 * transaction is aborted, commands ignored until end of transaction block" y
 * ESE error escapa como DB_ERROR 500. Como el outbox offline reintenta el
 * mismo batch (que contiene el evento duplicado) indefinidamente, el sync
 * quedaba en un loop infinito de 500. (Reproducido contra la DB: code 25P02.)
 *
 * Implementación actual: `INSERT ... ON CONFLICT (event_id) DO NOTHING`. No
 * levanta error ante duplicados, así que la transacción NUNCA se aborta. Las
 * filas afectadas (0) indican que el evento ya estaba procesado.
 *
 * @returns `{ isDuplicate: true }` si el evento ya había sido procesado.
 */
export async function markAsProcessed(
    tx: Prisma.TransactionClient,
    event: ParkEvent,
): Promise<{ isDuplicate: boolean }> {
    const inserted = await tx.$executeRaw`
        INSERT INTO processed_events (event_id, tenant_id, aggregate_id, event_type, processor)
        VALUES (
            ${event.event_id}::uuid,
            ${event.tenant_id}::uuid,
            ${event.aggregate_id ?? null}::uuid,
            ${event.event_type},
            ${'ingest-api'}
        )
        ON CONFLICT (event_id) DO NOTHING
    `;

    if (inserted === 0) {
        logger.info('Evento duplicado detectado, ya fue procesado', {
            eventId: event.event_id,
            tenantId: event.tenant_id,
            eventType: event.event_type,
            aggregateId: event.aggregate_id,
            processor: 'ingest-api',
        });
        return { isDuplicate: true };
    }

    return { isDuplicate: false };
}
