/**
 * Centralized Tenant Configuration
 * 
 * This module provides a single source of truth for tenant ID configuration.
 * All other modules should import getTenantId() instead of using hardcoded values.
 */

// Default tenant ID for development/testing
// In production, this MUST be provided via environment variable
const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/**
 * Get the current tenant ID from environment or default
 * 
 * Priority order:
 * 1. TENANT_ID environment variable (server-side)
 * 2. NEXT_PUBLIC_TENANT_ID environment variable (client-side)
 * 3. DEFAULT_TENANT_ID (development only)
 * 
 * @returns {string} The tenant ID
 * @throws {Error} In production if no tenant ID is configured
 */
export function getTenantId(): string {
  const tenantId = process.env.TENANT_ID || process.env.NEXT_PUBLIC_TENANT_ID;
  
  // In production, tenant ID must be explicitly configured
  if (!tenantId && process.env.NODE_ENV === 'production') {
    throw new Error('CONFIGURATION ERROR: TENANT_ID must be configured in production environment');
  }
  
  return tenantId || DEFAULT_TENANT_ID;
}

/**
 * Get the default tenant ID (for backward compatibility)
 * @deprecated Use getTenantId() instead
 */
export const DEFAULT_TENANT_ID_EXPORT = DEFAULT_TENANT_ID;
