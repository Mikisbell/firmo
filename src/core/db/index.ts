export { db, getDb, clearLocalDatabase, ParkDB } from './schema';
export type { EventEntity, SyncStateEntity, ProjectionEntity } from './schema';
export {
    cleanupOldEvents,
    getStorageStats,
    needsCleanup,
    autoCleanup,
    clearAllLocalData,
    type CleanupResult,
} from './cleanup';
export { withTransaction, type TransactionOptions } from './transaction';
// NOTA: el re-export de ./hr-offline-db se elimino — el modulo fue borrado en la
// migracion Edge (7f00ef7, revertida) y nadie consumia estos simbolos.
