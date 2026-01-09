/**
 * Outbox Publisher Worker
 * 
 * Garantiza que todos los eventos se publiquen al EventBus.
 * Si la publicación falla durante el ingest, este worker reintenta.
 * 
 * Ejecutar: npx ts-node src/core/workers/outbox-publisher.ts
 */

import { PrismaClient } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";
import { logger } from "@/src/core/observability/logger";

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = 100; // Cada 100ms
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

let isRunning = false;

export async function processOutbox(): Promise<number> {
    // Obtener eventos pendientes de publicar
    const pending = await prisma.event_outbox.findMany({
        where: { 
            published: false,
            attempts: { lt: MAX_ATTEMPTS },
        },
        orderBy: { created_at: 'asc' },
        take: BATCH_SIZE,
    });

    if (pending.length === 0) {
        return 0;
    }

    let published = 0;

    for (const item of pending) {
        try {
            // Importar dinámicamente para evitar problemas de bundling
            const { eventBus } = await import("@/src/core/infra/event-bus");
            
            // Publicar al EventBus (SSE)
            eventBus.publish(item.tenant_id, item.payload as unknown as ParkEvent);

            // Marcar como publicado
            await prisma.event_outbox.update({
                where: { id: item.id },
                data: {
                    published: true,
                    published_at: new Date(),
                },
            });

            published++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('outbox.publish_error', `Error publishing event ${item.event_id}`, error instanceof Error ? error : undefined, { 
                event_id: item.event_id 
            });

            // Incrementar intentos y guardar error
            await prisma.event_outbox.update({
                where: { id: item.id },
                data: {
                    attempts: { increment: 1 },
                    last_error: errorMessage,
                },
            });
        }
    }

    return published;
}

export async function startOutboxPublisher(): Promise<void> {
    if (isRunning) {
        logger.debug('outbox.already_running', 'Already running');
        return;
    }

    isRunning = true;
    logger.info('outbox.started', 'OutboxPublisher Started');

    const poll = async () => {
        if (!isRunning) return;

        try {
            const count = await processOutbox();
            if (count > 0) {
                logger.info('outbox.published', `Published ${count} events`, { count });
            }
        } catch (error) {
            logger.error('outbox.poll_error', 'Poll error', error instanceof Error ? error : undefined);
        }

        // Programar siguiente poll
        setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
}

export function stopOutboxPublisher(): void {
    isRunning = false;
    logger.info('outbox.stopped', 'OutboxPublisher Stopped');
}

// Cleanup de eventos publicados (ejecutar periódicamente)
export async function cleanupPublishedEvents(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await prisma.event_outbox.deleteMany({
        where: {
            published: true,
            published_at: { lt: cutoff },
        },
    });

    logger.info('outbox.cleanup', `Cleaned up ${result.count} old events`, { count: result.count });
    return result.count;
}

// Obtener estadísticas del outbox
export async function getOutboxStats(): Promise<{
    pending: number;
    failed: number;
    published_today: number;
}> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, failed, publishedToday] = await Promise.all([
        prisma.event_outbox.count({ where: { published: false, attempts: { lt: MAX_ATTEMPTS } } }),
        prisma.event_outbox.count({ where: { published: false, attempts: { gte: MAX_ATTEMPTS } } }),
        prisma.event_outbox.count({ where: { published: true, published_at: { gte: today } } }),
    ]);

    return { pending, failed, published_today: publishedToday };
}

// Si se ejecuta directamente
if (require.main === module) {
    startOutboxPublisher();

    // Graceful shutdown
    process.on("SIGINT", async () => {
        logger.info('outbox.shutdown', 'Shutting down...');
        stopOutboxPublisher();
        await prisma.$disconnect();
        process.exit(0);
    });
}
