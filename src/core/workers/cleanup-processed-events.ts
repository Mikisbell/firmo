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
import { logger } from "@/src/core/observability/logger";

const prisma = new PrismaClient();

const RETENTION_DAYS = 7; // Mantener 7 días de historial

export async function cleanupProcessedEvents(retentionDays: number = RETENTION_DAYS): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await prisma.processed_events.deleteMany({
        where: {
            processed_at: { lt: cutoff }
        }
    });

    logger.info('cleanup.processed_events', `Deleted ${result.count} processed events older than ${retentionDays} days`, { 
        count: result.count, 
        retention_days: retentionDays 
    });
    return result.count;
}

// Si se ejecuta directamente
if (require.main === module) {
    cleanupProcessedEvents()
        .then((count) => {
            logger.info('cleanup.complete', `Cleanup complete. Removed ${count} records.`, { count });
            process.exit(0);
        })
        .catch((error) => {
            logger.error('cleanup.failed', 'Cleanup failed', error instanceof Error ? error : undefined);
            process.exit(1);
        });
}
