/**
 * Cleanup Processed Events
 * 
 * Elimina registros de processed_events más viejos que X días
 * para evitar que la tabla crezca infinitamente.
 * 
 * Ejecutar como cron job diario o manualmente:
 * npx ts-node src/core/workers/cleanup-processed-events.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RETENTION_DAYS = 7; // Mantener 7 días de historial

export async function cleanupProcessedEvents(retentionDays: number = RETENTION_DAYS): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.processedEvent.deleteMany({
        where: {
            processed_at: { lt: cutoff }
        }
    });

    console.log(`[Cleanup] Deleted ${result.count} processed events older than ${retentionDays} days`);
    return result.count;
}

// Si se ejecuta directamente
if (require.main === module) {
    cleanupProcessedEvents()
        .then((count) => {
            console.log(`Cleanup complete. Removed ${count} records.`);
            process.exit(0);
        })
        .catch((error) => {
            console.error("Cleanup failed:", error);
            process.exit(1);
        });
}
