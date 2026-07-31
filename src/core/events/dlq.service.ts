import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('dlq.service');

export class DeadLetterQueueService {
  /**
   * Lee eventos del DLQ y los re-encola en pending_events para que
   * el outOfOrderQueue intente procesarlos de nuevo si sus dependencias
   * ya fueron resueltas.
   */
  async drainDLQ(limit = 100): Promise<number> {
    try {
      const events = await prisma.dead_letter_queue.findMany({
        take: limit,
        orderBy: { enqueued_at: 'asc' },
      });

      if (events.length === 0) return 0;

      let count = 0;
      for (const event of events) {
        const newEvent = {
          id: uuidv4(),
          tenant_id: event.tenant_id,
          event_id: event.event_id,
          event_type: event.event_type,
          aggregate_id: event.aggregate_id,
          payload: event.payload as any,
          reason: `Reintentado desde DLQ: ${event.reason}`,
          enqueued_at: new Date(),
        };

        // Transacción para garantizar que no duplicamos en caso de fallo
        await prisma.$transaction([
          prisma.pending_events.create({ data: newEvent }),
          prisma.dead_letter_queue.delete({ where: { id: event.id } })
        ]);
        
        count++;
      }

      logger.info(`Procesados ${count} eventos de la DLQ`);
      return count;
    } catch (error) {
      logger.error('Error procesando eventos de la DLQ', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}

export const deadLetterQueueService = new DeadLetterQueueService();
