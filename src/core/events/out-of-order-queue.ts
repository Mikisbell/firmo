/**
 * Out-of-Order Event Queue — Persistent
 *
 * Handles events that arrive before their dependencies (e.g., ORDER_ITEM_ADDED
 * before ORDER_CREATED). Events are persisted immediately to `pending_events`
 * table so they survive process restarts (Vercel cold starts, deploys, crashes).
 *
 * Flow:
 *  1. enqueue() → INSERT pending_events (persistent) + in-memory Map (fast lookup)
 *  2. processQueuedEvents() → DELETE pending_events + clear Map entry
 *  3. cleanupExpired() → expired events move to dead_letter_queue
 *  4. recover() → on startup, reload pending_events from DB into Map
 *
 * Timeout: 60 seconds
 * Dead Letter Queue: Expired events move to `dead_letter_queue` table
 * Alert: Logs warning when >10 events queued for same aggregate
 */

import { type ParkEvent } from '@/src/core/domain/events';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { deadLetterQueueService } from './dlq.service';

const log = createLogger('out-of-order-queue');

/**
 * Tipos de evento CRITICOS (plata / fiscal): perderlos en silencio es inaceptable.
 * Si uno de estos cae al dead_letter_queue, se alerta a nivel ERROR.
 */
const isCriticalEventType = (eventType: string): boolean =>
  /PAYMENT|INVOICE|REFUND|MARKED_PAID/.test(eventType);

interface QueuedEvent {
  event: ParkEvent;
  enqueuedAt: Date;
  reason: string;
}

/**
 * Persistent out-of-order queue.
 * In-memory Map is used as a fast cache; pending_events table is the source of truth.
 */
class OutOfOrderQueue {
  private queue: Map<string, QueuedEvent[]> = new Map();
  private readonly TIMEOUT_MS = 300_000; // 5 minutos (offline-first grace period)
  private readonly ALERT_THRESHOLD = 10;
  private recovered = false;

  /**
   * Enqueue an out-of-order event.
   * Persists to `pending_events` table immediately.
   */
  async enqueue(event: ParkEvent, reason: string): Promise<void> {
    const aggregateId = event.aggregate_id;
    const enqueuedAt = new Date();

    // 1. Persist to DB first (source of truth)
    try {
      await prisma.pending_events.create({
        data: {
          id: uuidv4(),
          tenant_id: event.tenant_id,
          event_id: event.event_id,
          aggregate_id: aggregateId,
          event_type: event.event_type,
          payload: event as any,
          reason,
          enqueued_at: enqueuedAt,
        },
      });
    } catch (e) {
      log.error('Error al persistir evento pendiente', e instanceof Error ? e : new Error(String(e)));
      // Fall through — still add to in-memory for this process lifetime
    }

    // 2. Add to in-memory cache for fast lookup
    if (!this.queue.has(aggregateId)) {
      this.queue.set(aggregateId, []);
    }

    const queuedEvents = this.queue.get(aggregateId)!;
    queuedEvents.push({ event, enqueuedAt, reason });

    log.warn('Evento encolado por estar fuera de orden', {
      event_id: event.event_id,
      event_type: event.event_type,
      aggregate_id: aggregateId,
      tenant_id: event.tenant_id,
      reason,
      queue_size: queuedEvents.length,
    });

    if (queuedEvents.length > this.ALERT_THRESHOLD) {
      log.warn('Umbral de alerta excedido', {
        aggregate_id: aggregateId,
        tenant_id: event.tenant_id,
        queue_size: queuedEvents.length,
        threshold: this.ALERT_THRESHOLD,
      });
    }
  }

  /**
   * Get queued events for an aggregate (read-only).
   */
  getQueuedEvents(aggregateId: string): QueuedEvent[] {
    return this.queue.get(aggregateId) || [];
  }

  /**
   * Process queued events when dependency arrives.
   * Deletes from DB and in-memory, returns events sorted by terminal_sequence.
   */
  async processQueuedEvents(aggregateId: string): Promise<ParkEvent[]> {
    const queuedEvents = this.queue.get(aggregateId);
    if (!queuedEvents || queuedEvents.length === 0) {
      // Check DB in case this process didn't have them in memory (cold start)
      return this.processFromDB(aggregateId);
    }

    // Sort by terminal_sequence
    const sortedEvents = queuedEvents
      .map(qe => qe.event)
      .sort((a, b) => {
        const seqA = (a as any).terminal_sequence || 0;
        const seqB = (b as any).terminal_sequence || 0;
        return seqA - seqB;
      });

    // Clear in-memory
    this.queue.delete(aggregateId);

    // Delete from DB
    try {
      await prisma.pending_events.deleteMany({
        where: { aggregate_id: aggregateId },
      });
    } catch (e) {
      log.error('Error al eliminar eventos pendientes de DB', e instanceof Error ? e : new Error(String(e)));
    }

    log.info('Eventos encolados procesados', {
      aggregate_id: aggregateId,
      event_count: sortedEvents.length,
    });

    return sortedEvents;
  }

  /**
   * Fallback: process directly from DB when in-memory is empty
   * (happens after cold start if recover() hasn't run yet).
   */
  private async processFromDB(aggregateId: string): Promise<ParkEvent[]> {
    try {
      const rows = await prisma.pending_events.findMany({
        where: { aggregate_id: aggregateId },
        orderBy: { enqueued_at: 'asc' },
      });

      if (rows.length === 0) return [];

      const events = rows
        .map(r => r.payload as unknown as ParkEvent)
        .sort((a, b) => {
          const seqA = (a as any).terminal_sequence || 0;
          const seqB = (b as any).terminal_sequence || 0;
          return seqA - seqB;
        });

      await prisma.pending_events.deleteMany({
        where: { aggregate_id: aggregateId },
      });

      log.info('Eventos pendientes recuperados de DB y procesados', {
        aggregate_id: aggregateId,
        event_count: events.length,
      });

      return events;
    } catch (e) {
      log.error('Error al recuperar eventos de DB', e instanceof Error ? e : new Error(String(e)));
      return [];
    }
  }

  /**
   * Cleanup expired events (>60s).
   * Moves them from pending_events to dead_letter_queue.
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.TIMEOUT_MS);

    // 1. Clean from DB (source of truth)
    try {
      const expired = await prisma.pending_events.findMany({
        where: { enqueued_at: { lt: cutoff } },
      });

      if (expired.length > 0) {
        // Move to DLQ
        await prisma.dead_letter_queue.createMany({
          data: expired.map(row => ({
            id: uuidv4(),
            tenant_id: row.tenant_id,
            event_id: row.event_id,
            event_type: row.event_type,
            aggregate_id: row.aggregate_id,
            payload: row.payload as any,
            reason: row.reason,
            enqueued_at: row.enqueued_at,
            expired_at: now,
          })),
        });

        // Delete from pending
        await prisma.pending_events.deleteMany({
          where: { enqueued_at: { lt: cutoff } },
        });

        // ALERTA: eventos perdidos al DLQ. Desglose por tipo + deteccion de criticos
        // (pagos/facturas) para no perder plata ni data fiscal en silencio.
        const breakdown: Record<string, number> = {};
        let criticalCount = 0;
        for (const row of expired) {
          breakdown[row.event_type] = (breakdown[row.event_type] ?? 0) + 1;
          if (isCriticalEventType(row.event_type)) criticalCount++;
          metrics.increment('dlq.event_expired', { event_type: row.event_type });
        }

        if (criticalCount > 0) {
          // Critico: surfacea a nivel ERROR (error-tracker) + metrica dedicada.
          metrics.increment('dlq.critical_event_lost', { count: String(criticalCount) });
          log.error(
            'ALERTA: eventos CRITICOS (pagos/facturas) movidos al dead_letter_queue sin resolver su dependencia',
            new Error('DLQ_CRITICAL_LOSS'),
            { critical_count: criticalCount, total_expired: expired.length, breakdown, timeout_ms: this.TIMEOUT_MS },
          );
        } else {
          log.warn('Eventos expirados movidos a DLQ', {
            expired_count: expired.length,
            breakdown,
            timeout_ms: this.TIMEOUT_MS,
          });
        }
      }
    } catch (e) {
      log.error('Error en limpieza de DB', e instanceof Error ? e : new Error(String(e)));
    }

    // 2. Sync in-memory to match
    for (const [aggregateId, queuedEvents] of this.queue.entries()) {
      const stillValid = queuedEvents.filter(
        qe => now.getTime() - qe.enqueuedAt.getTime() <= this.TIMEOUT_MS
      );

      if (stillValid.length === 0) {
        this.queue.delete(aggregateId);
      } else {
        this.queue.set(aggregateId, stillValid);
      }
    }
  }

  /**
   * Recover pending events from DB on startup.
   * Populates the in-memory Map from the persistent table.
   */
  async recover(): Promise<number> {
    if (this.recovered) return 0;

    try {
      const rows = await prisma.pending_events.findMany({
        orderBy: { enqueued_at: 'asc' },
      });

      for (const row of rows) {
        const aggregateId = row.aggregate_id;
        if (!this.queue.has(aggregateId)) {
          this.queue.set(aggregateId, []);
        }
        this.queue.get(aggregateId)!.push({
          event: row.payload as unknown as ParkEvent,
          enqueuedAt: row.enqueued_at,
          reason: row.reason,
        });
      }

      this.recovered = true;

      if (rows.length > 0) {
        log.info('Eventos pendientes recuperados de DB en startup', {
          recovered_count: rows.length,
          aggregates: this.queue.size,
        });
      }

      return rows.length;
    } catch (e) {
      log.error('Error al recuperar eventos pendientes', e instanceof Error ? e : new Error(String(e)));
      this.recovered = true;
      return 0;
    }
  }

  /**
   * Get queue statistics.
   */
  getStats(): { totalQueued: number; aggregatesWithQueue: number } {
    let totalQueued = 0;
    for (const queuedEvents of this.queue.values()) {
      totalQueued += queuedEvents.length;
    }

    return {
      totalQueued,
      aggregatesWithQueue: this.queue.size,
    };
  }
}

// Singleton instance
export const outOfOrderQueue = new OutOfOrderQueue();

/**
 * Cleanup job — runs every 30 seconds
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupJob(): void {
  if (cleanupInterval) {
    return;
  }

  // Recover pending events on first startup
  outOfOrderQueue.recover().catch(e => {
    log.error('Error en recovery de startup', e instanceof Error ? e : new Error(String(e)));
  });

  cleanupInterval = setInterval(async () => {
    try {
      await outOfOrderQueue.cleanupExpired();
      await deadLetterQueueService.drainDLQ(50);
    } catch (e) {
      log.error('Error en trabajo de limpieza', e instanceof Error ? e : new Error(String(e)));
    }
  }, 30_000);

  log.info('Trabajo de limpieza iniciado (intervalo 30s)');
}

export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    log.info('Trabajo de limpieza detenido');
  }
}
