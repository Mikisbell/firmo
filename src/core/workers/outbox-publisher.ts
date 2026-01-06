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

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = 100; // Cada 100ms
const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

let isRunning = false;

export async function processOutbox(): Promise<number> {
    // Obtener eventos pendientes de publicar
    const pending = await prisma.eventOutbox.findMany({
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
            await prisma.eventOutbox.update({
                where: { id: item.id },
                data: {
                    published: true,
                    published_at: new Date(),
                },
            });

            published++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[OutboxPublisher] Error publishing event ${item.event_id}:`, errorMessage);

            // Incrementar intentos y guardar error
            await prisma.eventOutbox.update({
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
        console.log("[OutboxPublisher] Already running");
        return;
    }

    isRunning = true;
    console.log("[OutboxPublisher] Started");

    const poll = async () => {
        if (!isRunning) return;

        try {
            const count = await processOutbox();
            if (count > 0) {
                console.log(`[OutboxPublisher] Published ${count} events`);
            }
        } catch (error) {
            console.error("[OutboxPublisher] Poll error:", error);
        }

        // Programar siguiente poll
        setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
}

export function stopOutboxPublisher(): void {
    isRunning = false;
    console.log("[OutboxPublisher] Stopped");
}

// Cleanup de eventos publicados (ejecutar periódicamente)
export async function cleanupPublishedEvents(olderThanDays: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await prisma.eventOutbox.deleteMany({
        where: {
            published: true,
            published_at: { lt: cutoff },
        },
    });

    console.log(`[OutboxPublisher] Cleaned up ${result.count} old events`);
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
        prisma.eventOutbox.count({ where: { published: false, attempts: { lt: MAX_ATTEMPTS } } }),
        prisma.eventOutbox.count({ where: { published: false, attempts: { gte: MAX_ATTEMPTS } } }),
        prisma.eventOutbox.count({ where: { published: true, published_at: { gte: today } } }),
    ]);

    return { pending, failed, published_today: publishedToday };
}

// Si se ejecuta directamente
if (require.main === module) {
    startOutboxPublisher();

    // Graceful shutdown
    process.on("SIGINT", async () => {
        console.log("\n[OutboxPublisher] Shutting down...");
        stopOutboxPublisher();
        await prisma.$disconnect();
        process.exit(0);
    });
}
