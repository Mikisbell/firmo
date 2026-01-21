/**
 * Location and Tenant Configuration
 * 
 * Centralized constants for default location and tenant IDs.
 * These must match the values used in seed data.
 */

export const DEFAULT_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const DEFAULT_LOCATION_ID = 'loc-00000000-0000-0000-0000-000000000001';

/**
 * Get tenant ID from environment or use default
 */
export function getTenantId(): string {
  return process.env.TENANT_ID || DEFAULT_TENANT_ID;
}

/**
 * Get location ID from environment or use default
 */
export function getLocationId(): string {
  return process.env.LOCATION_ID || DEFAULT_LOCATION_ID;
}
