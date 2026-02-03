/**
 * Tenant Configuration Management
 * 
 * Manages tenant-specific settings and customization including branding,
 * business rules, and operational preferences.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
 */

import { prisma } from '@/core/db/prisma';

/**
 * Complete tenant configuration
 */
export interface TenantConfiguration {
  tenant_id: string;
  legal_name: string;
  ruc?: string;
  address_text?: string;
  logo_url?: string;
  timezone: string;
  currency: string;
  receipt_footer_text?: string;
  kds_audio_enabled: boolean;
  kds_audio_volume: number;
  default_delivery_fee_cents: number;
  enable_tips: boolean;
  tips_on_invoice: boolean;
  allow_offline_coupon: boolean;
  max_offline_coupons_per_order: number;
  require_manager_for_offline: boolean;
  updated_at: Date;
}

/**
 * Configuration update request
 */
export type ConfigurationUpdate = Partial<
  Omit<TenantConfiguration, 'tenant_id' | 'updated_at'>
>;

/**
 * Configuration change audit entry
 */
export interface ConfigurationChangeLog {
  id: string;
  tenant_id: string;
  changed_by?: string;
  changes: Record<string, { old: any; new: any }>;
  changed_at: Date;
}

/**
 * Validate logo URL
 * 
 * Checks file size and format
 * 
 * @param url - Logo URL to validate
 * @throws Error if validation fails
 */
async function validateLogoUrl(url: string): Promise<void> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    // Check file size (max 2MB)
    const size = parseInt(response.headers.get('content-length') || '0');
    if (size > 2 * 1024 * 1024) {
      throw new Error('Logo file size exceeds 2MB limit');
    }

    // Check file type
    const contentType = response.headers.get('content-type');
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    
    if (!contentType || !allowedTypes.includes(contentType)) {
      throw new Error('Logo must be PNG, JPG, or SVG format');
    }
  } catch (error) {
    throw new Error(`Logo validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Validate timezone
 * 
 * @param timezone - Timezone string to validate
 * @throws Error if timezone is invalid
 */
function validateTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

/**
 * Validate currency
 * 
 * @param currency - Currency code to validate
 * @throws Error if currency is not supported
 */
function validateCurrency(currency: string): void {
  const allowedCurrencies = ['PEN', 'USD', 'EUR'];
  if (!allowedCurrencies.includes(currency)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
}

/**
 * Get tenant configuration
 * 
 * @param tenant_id - ID of the tenant
 * @returns Tenant configuration
 * @throws Error if tenant not found
 */
export async function getTenantConfiguration(
  tenant_id: string
): Promise<TenantConfiguration> {
  const settings = await prisma.tenant_settings.findUnique({
    where: { tenant_id },
  });

  if (!settings) {
    throw new Error(`Tenant configuration not found: ${tenant_id}`);
  }

  return settings as TenantConfiguration;
}

/**
 * Update tenant configuration
 * 
 * Validates all updates before saving. Logs configuration changes for audit.
 * 
 * @param tenant_id - ID of the tenant
 * @param updates - Configuration updates
 * @param changed_by - Optional: ID of user making the change
 * @returns Updated configuration
 * @throws Error if validation fails
 * 
 * @example
 * ```typescript
 * const updated = await updateTenantConfiguration(
 *   tenant_id,
 *   {
 *     legal_name: 'Pollería El Buen Sabor',
 *     logo_url: 'https://example.com/logo.png',
 *     kds_audio_volume: 75,
 *   },
 *   admin_id
 * );
 * ```
 */
export async function updateTenantConfiguration(
  tenant_id: string,
  updates: ConfigurationUpdate,
  changed_by?: string
): Promise<TenantConfiguration> {
  // Get current configuration for audit
  const current = await getTenantConfiguration(tenant_id);

  // Validate updates
  if (updates.logo_url) {
    await validateLogoUrl(updates.logo_url);
  }

  if (updates.timezone) {
    validateTimezone(updates.timezone);
  }

  if (updates.currency) {
    validateCurrency(updates.currency);
  }

  // Validate KDS audio volume
  if (updates.kds_audio_volume !== undefined) {
    if (updates.kds_audio_volume < 0 || updates.kds_audio_volume > 100) {
      throw new Error('KDS audio volume must be between 0 and 100');
    }
  }

  // Validate delivery fee
  if (updates.default_delivery_fee_cents !== undefined) {
    if (updates.default_delivery_fee_cents < 0) {
      throw new Error('Delivery fee cannot be negative');
    }
  }

  // Validate max offline coupons
  if (updates.max_offline_coupons_per_order !== undefined) {
    if (updates.max_offline_coupons_per_order < 0) {
      throw new Error('Max offline coupons cannot be negative');
    }
  }

  // Update configuration
  const updated = await prisma.tenant_settings.update({
    where: { tenant_id },
    data: {
      ...updates,
      updated_at: new Date(),
    },
  });

  // Log configuration change
  await logConfigurationChange(tenant_id, current, updated, changed_by);

  return updated as TenantConfiguration;
}

/**
 * Log configuration change for audit trail
 * 
 * @param tenant_id - ID of the tenant
 * @param before - Configuration before change
 * @param after - Configuration after change
 * @param changed_by - Optional: ID of user making the change
 */
async function logConfigurationChange(
  tenant_id: string,
  before: TenantConfiguration,
  after: TenantConfiguration,
  changed_by?: string
): Promise<void> {
  const changes: Record<string, { old: any; new: any }> = {};

  // Detect changes
  for (const key of Object.keys(before) as Array<keyof TenantConfiguration>) {
    if (key === 'updated_at' || key === 'tenant_id') continue;
    
    if (before[key] !== after[key]) {
      changes[key] = {
        old: before[key],
        new: after[key],
      };
    }
  }

  // Only log if there are actual changes
  if (Object.keys(changes).length > 0) {
    // Store in audit log (implementation depends on your audit system)
    console.log(`Configuration changed for tenant ${tenant_id}:`, changes);
  }
}

/**
 * Get tenant branding information
 * 
 * Returns branding-specific configuration for UI display
 * 
 * @param tenant_id - ID of the tenant
 * @returns Branding information
 */
export async function getTenantBranding(tenant_id: string) {
  const config = await getTenantConfiguration(tenant_id);

  return {
    legal_name: config.legal_name,
    logo_url: config.logo_url,
    receipt_footer_text: config.receipt_footer_text,
    ruc: config.ruc,
    address_text: config.address_text,
  };
}

/**
 * Get tenant operational settings
 * 
 * Returns operational configuration for POS system
 * 
 * @param tenant_id - ID of the tenant
 * @returns Operational settings
 */
export async function getTenantOperationalSettings(tenant_id: string) {
  const config = await getTenantConfiguration(tenant_id);

  return {
    timezone: config.timezone,
    currency: config.currency,
    kds_audio_enabled: config.kds_audio_enabled,
    kds_audio_volume: config.kds_audio_volume,
    default_delivery_fee_cents: config.default_delivery_fee_cents,
    enable_tips: config.enable_tips,
    tips_on_invoice: config.tips_on_invoice,
    allow_offline_coupon: config.allow_offline_coupon,
    max_offline_coupons_per_order: config.max_offline_coupons_per_order,
    require_manager_for_offline: config.require_manager_for_offline,
  };
}

/**
 * Validate configuration completeness
 * 
 * Checks if all required configuration is set
 * 
 * @param tenant_id - ID of the tenant
 * @returns Validation result
 */
export async function validateConfigurationCompleteness(tenant_id: string) {
  const config = await getTenantConfiguration(tenant_id);

  const issues: string[] = [];

  if (!config.legal_name) issues.push('Legal name is required');
  if (!config.timezone) issues.push('Timezone is required');
  if (!config.currency) issues.push('Currency is required');

  return {
    is_complete: issues.length === 0,
    issues,
  };
}
