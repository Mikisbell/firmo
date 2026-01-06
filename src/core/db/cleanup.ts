/**
 * IndexedDB Cleanup - PARK POS
 * 
 * Limpia datos antiguos para evitar que la tablet se quede sin espacio.
 * Solo borra eventos YA SINCRONIZADOS (synced = 1).
 * 
 * Política de retención:
 * - Eventos sincronizados: 30 días
 * - Proyecciones: Se mantienen (son pequeñas)
 * - Catálogo: Se mantiene (es pequeño)
 */

import { db, getDb } from './schema';

// Configuración
const RETENTION_DAYS = 30;
const CLEANUP_BATCH_SIZE = 1000;

export interface CleanupResult {
    deletedEvents: number;
    freedSpaceEstimate: string;
    duration: number;
}

/**
 * Limpia eventos sincronizados más antiguos que RETENTION_DAYS
 */
export async function cleanupOldEvents(): Promise<CleanupResult> {
    const dbInstance = getDb();
    if (!dbInstance) {
        console.log('[Cleanup] Skipping - not in browser');
        return { deletedEvents: 0, freedSpaceEstimate: '0 KB', duration: 0 };
    }

    const startTime = Date.now();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoffDate.toISOString();

    let totalDeleted = 0;
    let hasMore = true;

    // Borrar en batches para no bloquear UI
    while (hasMore) {
        const toDelete = await db.events
            .where('synced')
            .equals(1)
            .filter(e => e.occurred_at < cutoffIso)
            .limit(CLEANUP_BATCH_SIZE)
            .primaryKeys();

        if (toDelete.length === 0) {
            hasMore = false;
        } else {
            await db.events.bulkDelete(toDelete);
            totalDeleted += toDelete.length;
            
            // Yield para no bloquear UI
            await new Promise(r => setTimeout(r, 10));
        }
    }

    const duration = Date.now() - startTime;
    const freedSpaceEstimate = formatBytes(totalDeleted * 500); // ~500 bytes por evento

    console.log(`[Cleanup] Deleted ${totalDeleted} events older than ${RETENTION_DAYS} days in ${duration}ms`);

    return {
        deletedEvents: totalDeleted,
        freedSpaceEstimate,
        duration,
    };
}

/**
 * Obtiene estadísticas de uso de IndexedDB
 */
export async function getStorageStats(): Promise<{
    totalEvents: number;
    syncedEvents: number;
    pendingEvents: number;
    oldestEventDate: string | null;
    estimatedSize: string;
    quotaUsage?: { used: number; quota: number; percent: number };
}> {
    const dbInstance = getDb();
    if (!dbInstance) {
        return {
            totalEvents: 0,
            syncedEvents: 0,
            pendingEvents: 0,
            oldestEventDate: null,
            estimatedSize: '0 KB',
        };
    }

    const totalEvents = await db.events.count();
    const syncedEvents = await db.events.where('synced').equals(1).count();
    const pendingEvents = await db.events.where('synced').equals(0).count();

    // Obtener evento más antiguo
    const oldest = await db.events.orderBy('occurred_at').first();
    const oldestEventDate = oldest?.occurred_at || null;

    // Estimar tamaño (aproximado)
    const estimatedSize = formatBytes(totalEvents * 500);

    // Obtener quota del navegador si está disponible
    let quotaUsage: { used: number; quota: number; percent: number } | undefined;
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            if (estimate.usage !== undefined && estimate.quota !== undefined) {
                quotaUsage = {
                    used: estimate.usage,
                    quota: estimate.quota,
                    percent: Math.round((estimate.usage / estimate.quota) * 100),
                };
            }
        } catch {
            // Ignore - not all browsers support this
        }
    }

    return {
        totalEvents,
        syncedEvents,
        pendingEvents,
        oldestEventDate,
        estimatedSize,
        quotaUsage,
    };
}

/**
 * Verifica si se necesita cleanup (>80% de quota o >100k eventos)
 */
export async function needsCleanup(): Promise<boolean> {
    const stats = await getStorageStats();
    
    // Si hay más de 100k eventos sincronizados
    if (stats.syncedEvents > 100_000) {
        return true;
    }

    // Si el quota está >80%
    if (stats.quotaUsage && stats.quotaUsage.percent > 80) {
        return true;
    }

    return false;
}

/**
 * Ejecuta cleanup automático si es necesario
 * Llamar al iniciar la app
 */
export async function autoCleanup(): Promise<CleanupResult | null> {
    if (await needsCleanup()) {
        console.log('[Cleanup] Auto-cleanup triggered');
        return cleanupOldEvents();
    }
    return null;
}

/**
 * Formatea bytes a string legible
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Limpia TODOS los datos locales (para desarrollo/testing)
 */
export async function clearAllLocalData(): Promise<void> {
    const dbInstance = getDb();
    if (!dbInstance) return;

    await db.events.clear();
    await db.projections.clear();
    await db.sync_state.clear();
    await db.catalog_versions.clear();
    await db.catalog_items.clear();

    console.log('[Cleanup] All local data cleared');
}
