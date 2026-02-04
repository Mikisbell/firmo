/**
 * Tenant Switching for IndexedDB
 * 
 * Task 18.5 - IndexedDB Tenant Isolation
 * 
 * Implements tenant switching functionality for offline-first terminals.
 * When a user switches tenants, the system:
 * 1. Closes the previous tenant's database
 * 2. Clears all cached data from previous tenant
 * 3. Initializes the new tenant's database
 * 4. Validates the new tenant context
 * 
 * This ensures:
 * - No data leakage between tenants on shared devices
 * - Clean state when switching users/tenants
 * - Proper resource cleanup
 * - Audit trail of tenant switches
 */

import { logger } from '@/src/core/observability/logger';
import {
    getTenantDatabase,
    closeTenantDatabase,
    clearTenantDatabase,
    getActiveTenantDatabases,
    getTenantDatabaseName,
} from './tenant-database';
import { validateTenantId } from './tenant-validation';

// ============================================================================
// Types
// ============================================================================

export interface TenantSwitchContext {
    previous_tenant_id?: string;
    new_tenant_id: string;
    switched_at: number;
    reason?: string;
}

export interface TenantSwitchResult {
    success: boolean;
    previous_tenant_id?: string;
    new_tenant_id: string;
    message: string;
    context: TenantSwitchContext;
}

// ============================================================================
// Tenant Switching
// ============================================================================

/**
 * Switches from one tenant to another
 * 
 * This function:
 * 1. Validates both tenant IDs
 * 2. Closes the previous tenant's database
 * 3. Clears all cached data from previous tenant
 * 4. Initializes the new tenant's database
 * 5. Logs the switch operation
 * 6. Returns success/failure status
 * 
 * Requirements: 15.3 - When a user switches tenants, THE System SHALL clear previous tenant's cached data
 * 
 * @param new_tenant_id - UUID of the new tenant
 * @param previous_tenant_id - UUID of the previous tenant (optional)
 * @param reason - Reason for the switch (optional, for audit logging)
 * @returns Promise with switch result
 * @throws Error if tenant IDs are invalid
 */
export async function switchTenant(
    new_tenant_id: string,
    previous_tenant_id?: string,
    reason?: string
): Promise<TenantSwitchResult> {
    if (typeof window === 'undefined') {
        throw new Error('Tenant switching can only be performed on the client side');
    }

    const switchedAt = Date.now();

    try {
        // Validate new tenant ID
        validateTenantId(new_tenant_id);

        // Validate previous tenant ID if provided
        if (previous_tenant_id) {
            validateTenantId(previous_tenant_id);

            // Prevent switching to the same tenant
            if (previous_tenant_id === new_tenant_id) {
                logger.warn('TENANT_SWITCH_SAME_TENANT', 'Attempted to switch to the same tenant', {
                    tenant_id: new_tenant_id,
                    reason,
                });

                return {
                    success: false,
                    previous_tenant_id,
                    new_tenant_id,
                    message: 'Cannot switch to the same tenant',
                    context: {
                        previous_tenant_id,
                        new_tenant_id,
                        switched_at: switchedAt,
                        reason,
                    },
                };
            }
        }

        // Step 1: Close previous tenant's database
        if (previous_tenant_id) {
            try {
                await closeTenantDatabase(previous_tenant_id);
                logger.info('TENANT_DB_CLOSED_FOR_SWITCH', `Closed database for previous tenant: ${previous_tenant_id}`, {
                    previous_tenant_id,
                    new_tenant_id,
                });
            } catch (error) {
                logger.error(
                    'TENANT_DB_CLOSE_FAILED_FOR_SWITCH',
                    `Failed to close database for previous tenant: ${previous_tenant_id}`,
                    error instanceof Error ? error : undefined,
                    {
                        previous_tenant_id,
                        new_tenant_id,
                    }
                );
                // Continue with switch even if close fails
            }
        }

        // Step 2: Clear all cached data from previous tenant
        if (previous_tenant_id) {
            try {
                await clearTenantDatabase(previous_tenant_id);
                logger.info('TENANT_DATA_CLEARED_FOR_SWITCH', `Cleared all data for previous tenant: ${previous_tenant_id}`, {
                    previous_tenant_id,
                    new_tenant_id,
                });
            } catch (error) {
                logger.error(
                    'TENANT_DATA_CLEAR_FAILED_FOR_SWITCH',
                    `Failed to clear data for previous tenant: ${previous_tenant_id}`,
                    error instanceof Error ? error : undefined,
                    {
                        previous_tenant_id,
                        new_tenant_id,
                    }
                );
                // Continue with switch even if clear fails
            }
        }

        // Step 3: Clear localStorage entries for previous tenant
        if (previous_tenant_id) {
            try {
                clearTenantLocalStorage(previous_tenant_id);
                logger.info('TENANT_LOCALSTORAGE_CLEARED_FOR_SWITCH', `Cleared localStorage for previous tenant: ${previous_tenant_id}`, {
                    previous_tenant_id,
                    new_tenant_id,
                });
            } catch (error) {
                logger.error(
                    'TENANT_LOCALSTORAGE_CLEAR_FAILED_FOR_SWITCH',
                    `Failed to clear localStorage for previous tenant: ${previous_tenant_id}`,
                    error instanceof Error ? error : undefined,
                    {
                        previous_tenant_id,
                        new_tenant_id,
                    }
                );
                // Continue with switch even if clear fails
            }
        }

        // Step 3b: Clear sessionStorage entries for previous tenant
        if (previous_tenant_id) {
            try {
                clearTenantSessionStorage(previous_tenant_id);
                logger.info('TENANT_SESSIONSTORAGE_CLEARED_FOR_SWITCH', `Cleared sessionStorage for previous tenant: ${previous_tenant_id}`, {
                    previous_tenant_id,
                    new_tenant_id,
                });
            } catch (error) {
                logger.error(
                    'TENANT_SESSIONSTORAGE_CLEAR_FAILED_FOR_SWITCH',
                    `Failed to clear sessionStorage for previous tenant: ${previous_tenant_id}`,
                    error instanceof Error ? error : undefined,
                    {
                        previous_tenant_id,
                        new_tenant_id,
                    }
                );
                // Continue with switch even if clear fails
            }
        }

        // Step 4: Initialize new tenant's database
        try {
            const newDb = getTenantDatabase(new_tenant_id);
            logger.info('TENANT_DB_INITIALIZED_FOR_SWITCH', `Initialized database for new tenant: ${new_tenant_id}`, {
                previous_tenant_id,
                new_tenant_id,
            });
        } catch (error) {
            logger.error(
                'TENANT_DB_INIT_FAILED_FOR_SWITCH',
                `Failed to initialize database for new tenant: ${new_tenant_id}`,
                error instanceof Error ? error : undefined,
                {
                    previous_tenant_id,
                    new_tenant_id,
                }
            );
            throw error;
        }

        // Step 5: Log the switch operation
        logger.info('TENANT_SWITCHED', `Successfully switched from tenant ${previous_tenant_id} to ${new_tenant_id}`, {
            previous_tenant_id,
            new_tenant_id,
            switched_at: switchedAt,
            reason,
        });

        return {
            success: true,
            previous_tenant_id,
            new_tenant_id,
            message: `Successfully switched to tenant ${new_tenant_id}`,
            context: {
                previous_tenant_id,
                new_tenant_id,
                switched_at: switchedAt,
                reason,
            },
        };
    } catch (error) {
        logger.error(
            'TENANT_SWITCH_FAILED',
            `Failed to switch tenant from ${previous_tenant_id} to ${new_tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                previous_tenant_id,
                new_tenant_id,
                reason,
            }
        );

        throw error;
    }
}

/**
 * Clears all localStorage entries for a specific tenant
 * 
 * This function:
 * 1. Identifies all localStorage keys for the tenant
 * 2. Removes each key
 * 3. Logs the operation
 * 
 * @param tenant_id - UUID of the tenant
 */
export function clearTenantLocalStorage(tenant_id: string): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
    }

    try {
        validateTenantId(tenant_id);

        // Get all localStorage keys - collect them first to avoid iteration issues
        const keysToRemove: string[] = [];
        const allKeys: string[] = [];
        
        // Collect all keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                allKeys.push(key);
            }
        }

        // Filter keys that belong to this tenant
        for (const key of allKeys) {
            if (key.includes(tenant_id)) {
                keysToRemove.push(key);
            }
        }

        // Remove all tenant-specific keys
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        logger.info('TENANT_LOCALSTORAGE_CLEARED', `Cleared ${keysToRemove.length} localStorage entries for tenant: ${tenant_id}`, {
            tenant_id,
            keys_removed: keysToRemove.length,
        });
    } catch (error) {
        logger.error(
            'TENANT_LOCALSTORAGE_CLEAR_FAILED',
            `Failed to clear localStorage for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Clears all sessionStorage entries for a specific tenant
 * 
 * This function:
 * 1. Identifies all sessionStorage keys for the tenant
 * 2. Removes each key
 * 3. Logs the operation
 * 
 * @param tenant_id - UUID of the tenant
 */
export function clearTenantSessionStorage(tenant_id: string): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
        return;
    }

    try {
        validateTenantId(tenant_id);

        // Get all sessionStorage keys - collect them first to avoid iteration issues
        const keysToRemove: string[] = [];
        const allKeys: string[] = [];
        
        // Collect all keys
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
                allKeys.push(key);
            }
        }

        // Filter keys that belong to this tenant
        for (const key of allKeys) {
            if (key.includes(tenant_id)) {
                keysToRemove.push(key);
            }
        }

        // Remove all tenant-specific keys
        keysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });

        logger.info('TENANT_SESSIONSTORAGE_CLEARED', `Cleared ${keysToRemove.length} sessionStorage entries for tenant: ${tenant_id}`, {
            tenant_id,
            keys_removed: keysToRemove.length,
        });
    } catch (error) {
        logger.error(
            'TENANT_SESSIONSTORAGE_CLEAR_FAILED',
            `Failed to clear sessionStorage for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Performs a complete tenant logout cleanup
 * 
 * This function:
 * 1. Closes the tenant's database
 * 2. Clears IndexedDB data
 * 3. Clears localStorage entries
 * 4. Clears sessionStorage entries
 * 5. Logs the operation
 * 
 * Use this when a user logs out to ensure complete cleanup.
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise that resolves when cleanup is complete
 */
export async function logoutTenant(tenant_id: string): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        validateTenantId(tenant_id);

        // Close database
        await closeTenantDatabase(tenant_id);

        // Clear IndexedDB data
        await clearTenantDatabase(tenant_id);

        // Clear localStorage
        clearTenantLocalStorage(tenant_id);

        // Clear sessionStorage
        clearTenantSessionStorage(tenant_id);

        logger.info('TENANT_LOGOUT_COMPLETE', `Complete cleanup for tenant: ${tenant_id}`, {
            tenant_id,
        });
    } catch (error) {
        logger.error(
            'TENANT_LOGOUT_FAILED',
            `Failed to complete logout cleanup for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Gets the current active tenant (if any)
 * 
 * This function:
 * 1. Checks which tenant databases are currently active
 * 2. Returns the first active tenant (typically only one should be active)
 * 3. Returns undefined if no tenant is active
 * 
 * @returns Active tenant_id or undefined
 */
export function getActiveTenant(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    const activeTenants = getActiveTenantDatabases();
    return activeTenants.length > 0 ? activeTenants[0] : undefined;
}

/**
 * Checks if a specific tenant is currently active
 * 
 * @param tenant_id - UUID of the tenant to check
 * @returns true if tenant is active, false otherwise
 */
export function isTenantActive(tenant_id: string): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        validateTenantId(tenant_id);
        const activeTenants = getActiveTenantDatabases();
        return activeTenants.includes(tenant_id);
    } catch {
        return false;
    }
}
