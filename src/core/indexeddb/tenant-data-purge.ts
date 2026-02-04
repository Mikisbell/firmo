/**
 * Tenant Data Purge for IndexedDB
 * 
 * Task 18.9 - IndexedDB Tenant Isolation
 * 
 * Implements complete data purge functionality for tenant data stored in IndexedDB.
 * When a tenant is deactivated, deleted, or a user logs out, all tenant data must be
 * securely removed from the browser's local storage.
 * 
 * This ensures:
 * - Complete removal of IndexedDB database for tenant
 * - Clearing of localStorage entries for tenant
 * - Clearing of sessionStorage entries
 * - No residual data remains after logout
 * - Compliance with data protection requirements
 * 
 * Requirements: 15.6 - THE System SHALL purge all tenant data from IndexedDB on logout
 */

import { logger } from '@/src/core/observability/logger';
import { validateTenantId } from './tenant-validation';
import { clearTenantEncryptionKey } from './tenant-encryption';

// ============================================================================
// Types
// ============================================================================

export interface PurgeResult {
    tenant_id: string;
    indexeddb_deleted: boolean;
    localstorage_cleared: number;
    sessionstorage_cleared: number;
    encryption_keys_cleared: boolean;
    timestamp: Date;
}

// ============================================================================
// IndexedDB Purge
// ============================================================================

/**
 * Gets the IndexedDB database name for a tenant
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Database name in format: parkpos-tenant-{tenant_id}
 */
function getTenantDatabaseName(tenant_id: string): string {
    return `parkpos-tenant-${tenant_id}`;
}

/**
 * Deletes the IndexedDB database for a tenant
 * 
 * This function:
 * 1. Validates tenant_id
 * 2. Gets the database name
 * 3. Deletes the database using IndexedDB API
 * 4. Logs the deletion
 * 5. Returns success status
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise that resolves when database is deleted
 * @throws Error if tenant_id is invalid or deletion fails
 */
async function deleteIndexedDBDatabase(tenant_id: string): Promise<boolean> {
    if (typeof window === 'undefined' || !window.indexedDB) {
        logger.warn('INDEXEDDB_NOT_AVAILABLE', 'IndexedDB not available in this environment', {
            tenant_id,
        });
        return false;
    }

    try {
        validateTenantId(tenant_id);

        const dbName = getTenantDatabaseName(tenant_id);

        // Delete the database
        const deleteRequest = window.indexedDB.deleteDatabase(dbName);

        return new Promise((resolve, reject) => {
            deleteRequest.onerror = () => {
                logger.error(
                    'INDEXEDDB_DELETE_FAILED',
                    `Failed to delete IndexedDB database for tenant: ${tenant_id}`,
                    undefined,
                    { tenant_id, db_name: dbName }
                );
                reject(new Error(`Failed to delete IndexedDB database: ${dbName}`));
            };

            deleteRequest.onsuccess = () => {
                logger.info('INDEXEDDB_DELETED', `Deleted IndexedDB database for tenant: ${tenant_id}`, {
                    tenant_id,
                    db_name: dbName,
                });
                resolve(true);
            };

            deleteRequest.onblocked = () => {
                logger.warn('INDEXEDDB_DELETE_BLOCKED', `IndexedDB delete blocked for tenant: ${tenant_id}`, {
                    tenant_id,
                    db_name: dbName,
                });
            };
        });
    } catch (error) {
        logger.error(
            'INDEXEDDB_DELETE_ERROR',
            `Error deleting IndexedDB database for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            { tenant_id }
        );
        throw error;
    }
}

// ============================================================================
// LocalStorage Purge
// ============================================================================

/**
 * Gets the localStorage key prefix for a tenant
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Key prefix in format: parkpos-{tenant_id}-
 */
function getTenantLocalStoragePrefix(tenant_id: string): string {
    return `parkpos-${tenant_id}-`;
}

/**
 * Clears all localStorage entries for a tenant
 * 
 * This function:
 * 1. Validates tenant_id
 * 2. Gets the key prefix for the tenant
 * 3. Iterates through all localStorage keys
 * 4. Deletes keys matching the tenant prefix
 * 5. Logs the number of entries cleared
 * 6. Returns count of cleared entries
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Number of localStorage entries cleared
 * @throws Error if tenant_id is invalid
 */
function clearTenantLocalStorage(tenant_id: string): number {
    if (typeof window === 'undefined' || !window.localStorage) {
        logger.warn('LOCALSTORAGE_NOT_AVAILABLE', 'localStorage not available in this environment', {
            tenant_id,
        });
        return 0;
    }

    try {
        validateTenantId(tenant_id);

        const prefix = getTenantLocalStoragePrefix(tenant_id);
        const keysToDelete: string[] = [];

        // Find all keys matching the tenant prefix
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        // Delete all matching keys
        keysToDelete.forEach(key => {
            window.localStorage.removeItem(key);
        });

        logger.info('LOCALSTORAGE_CLEARED', `Cleared ${keysToDelete.length} localStorage entries for tenant: ${tenant_id}`, {
            tenant_id,
            entries_cleared: keysToDelete.length,
        });

        return keysToDelete.length;
    } catch (error) {
        logger.error(
            'LOCALSTORAGE_CLEAR_ERROR',
            `Error clearing localStorage for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            { tenant_id }
        );
        throw error;
    }
}

// ============================================================================
// SessionStorage Purge
// ============================================================================

/**
 * Gets the sessionStorage key prefix for a tenant
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Key prefix in format: parkpos-session-{tenant_id}-
 */
function getTenantSessionStoragePrefix(tenant_id: string): string {
    return `parkpos-session-${tenant_id}-`;
}

/**
 * Clears all sessionStorage entries for a tenant
 * 
 * This function:
 * 1. Validates tenant_id
 * 2. Gets the key prefix for the tenant
 * 3. Iterates through all sessionStorage keys
 * 4. Deletes keys matching the tenant prefix
 * 5. Logs the number of entries cleared
 * 6. Returns count of cleared entries
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Number of sessionStorage entries cleared
 * @throws Error if tenant_id is invalid
 */
function clearTenantSessionStorage(tenant_id: string): number {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        logger.warn('SESSIONSTORAGE_NOT_AVAILABLE', 'sessionStorage not available in this environment', {
            tenant_id,
        });
        return 0;
    }

    try {
        validateTenantId(tenant_id);

        const prefix = getTenantSessionStoragePrefix(tenant_id);
        const keysToDelete: string[] = [];

        // Find all keys matching the tenant prefix
        for (let i = 0; i < window.sessionStorage.length; i++) {
            const key = window.sessionStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keysToDelete.push(key);
            }
        }

        // Delete all matching keys
        keysToDelete.forEach(key => {
            window.sessionStorage.removeItem(key);
        });

        logger.info('SESSIONSTORAGE_CLEARED', `Cleared ${keysToDelete.length} sessionStorage entries for tenant: ${tenant_id}`, {
            tenant_id,
            entries_cleared: keysToDelete.length,
        });

        return keysToDelete.length;
    } catch (error) {
        logger.error(
            'SESSIONSTORAGE_CLEAR_ERROR',
            `Error clearing sessionStorage for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            { tenant_id }
        );
        throw error;
    }
}

// ============================================================================
// Complete Purge
// ============================================================================

/**
 * Purges all tenant data from IndexedDB, localStorage, and sessionStorage
 * 
 * This is the main purge function that should be called when:
 * - User logs out
 * - Tenant is deactivated
 * - Tenant is deleted
 * - User switches tenants
 * 
 * The function:
 * 1. Validates tenant_id
 * 2. Deletes IndexedDB database
 * 3. Clears localStorage entries
 * 4. Clears sessionStorage entries
 * 5. Clears encryption keys from memory
 * 6. Logs the complete purge operation
 * 7. Returns detailed purge result
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with detailed purge result
 * @throws Error if tenant_id is invalid
 */
export async function purgeTenantData(tenant_id: string): Promise<PurgeResult> {
    const startTime = Date.now();

    try {
        validateTenantId(tenant_id);

        logger.info('TENANT_PURGE_STARTED', `Starting data purge for tenant: ${tenant_id}`, {
            tenant_id,
        });

        // Delete IndexedDB database
        const indexeddbDeleted = await deleteIndexedDBDatabase(tenant_id);

        // Clear localStorage
        const localstorageCleared = clearTenantLocalStorage(tenant_id);

        // Clear sessionStorage
        const sessionstorageCleared = clearTenantSessionStorage(tenant_id);

        // Clear encryption keys
        clearTenantEncryptionKey(tenant_id);
        const encryptionKeysCleared = true;

        const duration = Date.now() - startTime;

        const result: PurgeResult = {
            tenant_id,
            indexeddb_deleted: indexeddbDeleted,
            localstorage_cleared: localstorageCleared,
            sessionstorage_cleared: sessionstorageCleared,
            encryption_keys_cleared: encryptionKeysCleared,
            timestamp: new Date(),
        };

        logger.info('TENANT_PURGE_COMPLETED', `Completed data purge for tenant: ${tenant_id}`, {
            tenant_id,
            duration_ms: duration,
            indexeddb_deleted: indexeddbDeleted,
            localstorage_cleared: localstorageCleared,
            sessionstorage_cleared: sessionstorageCleared,
            encryption_keys_cleared: encryptionKeysCleared,
        });

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error(
            'TENANT_PURGE_FAILED',
            `Failed to purge data for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
                duration_ms: duration,
            }
        );

        throw error;
    }
}

/**
 * Purges all tenant data on logout
 * 
 * This function should be called when a user logs out to ensure
 * all their data is removed from the browser.
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with purge result
 */
export async function purgeOnLogout(tenant_id: string): Promise<PurgeResult> {
    logger.info('LOGOUT_PURGE_INITIATED', `Initiating logout purge for tenant: ${tenant_id}`, {
        tenant_id,
    });

    return purgeTenantData(tenant_id);
}

/**
 * Purges all tenant data when switching tenants
 * 
 * This function should be called when a user switches from one tenant to another
 * to ensure the previous tenant's data is completely removed.
 * 
 * @param oldTenantId - UUID of the previous tenant
 * @param newTenantId - UUID of the new tenant
 * @returns Promise with purge result for old tenant
 */
export async function purgeOnTenantSwitch(oldTenantId: string, newTenantId: string): Promise<PurgeResult> {
    logger.info('TENANT_SWITCH_PURGE_INITIATED', `Initiating tenant switch purge from ${oldTenantId} to ${newTenantId}`, {
        old_tenant_id: oldTenantId,
        new_tenant_id: newTenantId,
    });

    return purgeTenantData(oldTenantId);
}

/**
 * Purges all tenant data when tenant is deactivated
 * 
 * This function should be called when a tenant is deactivated to ensure
 * all their data is removed from the browser.
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with purge result
 */
export async function purgeOnTenantDeactivation(tenant_id: string): Promise<PurgeResult> {
    logger.info('TENANT_DEACTIVATION_PURGE_INITIATED', `Initiating deactivation purge for tenant: ${tenant_id}`, {
        tenant_id,
    });

    return purgeTenantData(tenant_id);
}

/**
 * Purges all tenant data when tenant is deleted
 * 
 * This function should be called when a tenant is deleted to ensure
 * all their data is removed from the browser.
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with purge result
 */
export async function purgeOnTenantDeletion(tenant_id: string): Promise<PurgeResult> {
    logger.info('TENANT_DELETION_PURGE_INITIATED', `Initiating deletion purge for tenant: ${tenant_id}`, {
        tenant_id,
    });

    return purgeTenantData(tenant_id);
}
