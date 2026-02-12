/**
 * Out-of-Order Event Queue
 * 
 * Maneja eventos que llegan fuera de orden, encolándolos temporalmente
 * hasta que lleguen los eventos faltantes.
 * 
 * Casos de uso:
 * 1. ORDER_ITEM_ADDED llega antes que ORDER_CREATED
 * 2. Eventos con terminal_sequence no consecutivo
 * 3. Eventos con dependencias faltantes
 * 
 * Timeout: 60 segundos
 * Dead Letter Queue: Eventos expirados se mueven a tabla dead_letter_queue
 * Alerta: Cuando >10 eventos encolados para el mismo aggregate
 */

import { type ParkEvent } from '@/src/core/domain/events';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';

interface QueuedEvent {
  event: ParkEvent;
  enqueuedAt: Date;
  reason: string;
}

/**
 * Cola en memoria para eventos fuera de orden
 * Key: aggregate_id
 * Value: Array de eventos encolados
 */
class OutOfOrderQueue {
  private queue: Map<string, QueuedEvent[]> = new Map();
  private readonly TIMEOUT_MS = 60_000; // 60 segundos
  private readonly ALERT_THRESHOLD = 10; // Alerta si >10 eventos encolados

  /**
   * Encolar un evento que llegó fuera de orden
   */
  enqueue(event: ParkEvent, reason: string): void {
    const aggregateId = event.aggregate_id;
    
    if (!this.queue.has(aggregateId)) {
      this.queue.set(aggregateId, []);
    }
    
    const queuedEvents = this.queue.get(aggregateId)!;
    queuedEvents.push({
      event,
      enqueuedAt: new Date(),
      reason,
    });
    
    // Logging estructurado
    console.log(JSON.stringify({
      level: 'WARN',
      event: 'out_of_order.enqueued',
      message: `Event ${event.event_id} enqueued for aggregate ${aggregateId}`,
      context: {
        event_id: event.event_id,
        event_type: event.event_type,
        aggregate_id: aggregateId,
        tenant_id: event.tenant_id,
        reason,
        queue_size: queuedEvents.length,
      }
    }));
    
    // Alerta si >10 eventos encolados
    if (queuedEvents.length > this.ALERT_THRESHOLD) {
      console.log(JSON.stringify({
        level: 'ERROR',
        event: 'out_of_order.alert_threshold_exceeded',
        message: `More than ${this.ALERT_THRESHOLD} events queued for aggregate ${aggregateId}`,
        context: {
          aggregate_id: aggregateId,
          tenant_id: event.tenant_id,
          queue_size: queuedEvents.length,
          threshold: this.ALERT_THRESHOLD,
        }
      }));
    }
  }

  /**
   * Obtener eventos encolados para un aggregate
   */
  getQueuedEvents(aggregateId: string): QueuedEvent[] {
    return this.queue.get(aggregateId) || [];
  }

  /**
   * Procesar eventos encolados para un aggregate
   * Retorna los eventos que están listos para procesar
   */
  async processQueuedEvents(aggregateId: string): Promise<ParkEvent[]> {
    const queuedEvents = this.queue.get(aggregateId);
    if (!queuedEvents || queuedEvents.length === 0) {
      return [];
    }
    
    // Ordenar por terminal_sequence si está disponible
    const sortedEvents = queuedEvents
      .map(qe => qe.event)
      .sort((a, b) => {
        const seqA = (a as any).terminal_sequence || 0;
        const seqB = (b as any).terminal_sequence || 0;
        return seqA - seqB;
      });
    
    // Limpiar la cola para este aggregate
    this.queue.delete(aggregateId);
    
    console.log(JSON.stringify({
      level: 'INFO',
      event: 'out_of_order.processed',
      message: `Processing ${sortedEvents.length} queued events for aggregate ${aggregateId}`,
      context: {
        aggregate_id: aggregateId,
        event_count: sortedEvents.length,
      }
    }));
    
    return sortedEvents;
  }

  /**
   * Limpiar eventos expirados (>60 segundos)
   * Mover a dead_letter_queue
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date();
    const expiredEvents: Array<{ event: ParkEvent; reason: string; enqueuedAt: Date }> = [];
    
    // Buscar eventos expirados
    for (const [aggregateId, queuedEvents] of this.queue.entries()) {
      const stillValid: QueuedEvent[] = [];
      
      for (const qe of queuedEvents) {
        const ageMs = now.getTime() - qe.enqueuedAt.getTime();
        
        if (ageMs > this.TIMEOUT_MS) {
          // Expirado - mover a DLQ
          expiredEvents.push({
            event: qe.event,
            reason: qe.reason,
            enqueuedAt: qe.enqueuedAt,
          });
        } else {
          // Todavía válido
          stillValid.push(qe);
        }
      }
      
      // Actualizar cola
      if (stillValid.length === 0) {
        this.queue.delete(aggregateId);
      } else {
        this.queue.set(aggregateId, stillValid);
      }
    }
    
    // Mover eventos expirados a dead_letter_queue
    if (expiredEvents.length > 0) {
      try {
        await prisma.dead_letter_queue.createMany({
          data: expiredEvents.map(({ event, reason, enqueuedAt }) => ({
            id: uuidv4(),
            tenant_id: event.tenant_id,
            event_id: event.event_id,
            event_type: event.event_type,
            aggregate_id: event.aggregate_id,
            payload: event as any,
            reason,
            enqueued_at: enqueuedAt,
            expired_at: now,
          })),
        });
        
        console.log(JSON.stringify({
          level: 'WARN',
          event: 'out_of_order.expired',
          message: `Moved ${expiredEvents.length} expired events to dead_letter_queue`,
          context: {
            expired_count: expiredEvents.length,
            timeout_ms: this.TIMEOUT_MS,
          }
        }));
      } catch (e) {
        console.error('[OutOfOrderQueue] Error moving to DLQ:', e);
      }
    }
  }

  /**
   * Obtener estadísticas de la cola
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
 * Cleanup job - ejecutar cada 30 segundos
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startCleanupJob(): void {
  if (cleanupInterval) {
    return; // Ya está corriendo
  }
  
  cleanupInterval = setInterval(async () => {
    try {
      await outOfOrderQueue.cleanupExpired();
    } catch (e) {
      console.error('[OutOfOrderQueue] Cleanup job error:', e);
    }
  }, 30_000); // 30 segundos
  
  console.log('[OutOfOrderQueue] Cleanup job started (30s interval)');
}

export function stopCleanupJob(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[OutOfOrderQueue] Cleanup job stopped');
  }
}
