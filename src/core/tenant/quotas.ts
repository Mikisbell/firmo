/**
 * Tenant Resource Quota Management
 * 
 * Enforces limits on tenant resource usage to ensure fair distribution
 * and cost control. Tracks current usage and prevents operations when
 * quotas are exceeded.
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6**
 */

import { prisma } from '@/core/db/prisma';

/**
 * Resource types that can be quota-limited
 */
export type QuotaResource = 'terminals' | 'employees' | 'products' | 'daily_orders';

/**
 * Quota check result
 */
export interface QuotaCheck {
  /** Whether the resource can be created */
  allowed: boolean;
  
  /** Current usage count */
  current: number;
  
  /** Maximum allowed count */
  limit: number;
  
  /** Resource type */
  resource: QuotaResource;
  
  /** Percentage of quota used */
  percentage: number;
}

/**
 * Tenant quota configuration
 */
export interface TenantQuota {
  tenant_id: string;
  max_terminals: number;
  max_employees: number;
  max_products: number;
  max_daily_orders: number;
  max_storage_mb: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Tenant resource usage tracking
 */
export interface TenantUsage {
  tenant_id: string;
  current_terminals: number;
  current_employees: number;
  current_products: number;
  daily_orders: number;
  storage_mb: number;
  last_reset_date: Date;
  updated_at: Date;
}

/**
 * Error thrown when quota is exceeded
 */
export class QuotaExceededError extends Error {
  constructor(
    public resource: QuotaResource,
    public current: number,
    public limit: number
  ) {
    super(
      `Quota exceeded for ${resource}: ${current}/${limit}`
    );
    this.name = 'QuotaExceededError';
  }
}

/**
 * Check if a resource can be created within quota
 * 
 * @param tenant_id - ID of the tenant
 * @param resource - Resource type to check
 * @returns Quota check result
 * @throws Error if quota configuration not found
 * 
 * @example
 * ```typescript
 * const check = await checkQuota(tenant_id, 'products');
 * if (!check.allowed) {
 *   throw new QuotaExceededError(check.resource, check.current, check.limit);
 * }
 * ```
 */
export async function checkQuota(
  tenant_id: string,
  resource: QuotaResource
): Promise<QuotaCheck> {
  const [quota, usage] = await Promise.all([
    prisma.tenant_quotas.findUnique({ where: { tenant_id } }),
    prisma.tenant_usage.findUnique({ where: { tenant_id } }),
  ]);

  if (!quota || !usage) {
    throw new Error(`Quota configuration not found for tenant: ${tenant_id}`);
  }

  const limits = {
    terminals: quota.max_terminals,
    employees: quota.max_employees,
    products: quota.max_products,
    daily_orders: quota.max_daily_orders,
  };

  const current = {
    terminals: usage.current_terminals,
    employees: usage.current_employees,
    products: usage.current_products,
    daily_orders: usage.daily_orders,
  };

  const limit = limits[resource];
  const currentValue = current[resource];
  const percentage = (currentValue / limit) * 100;

  return {
    allowed: currentValue < limit,
    current: currentValue,
    limit,
    resource,
    percentage,
  };
}

/**
 * Increment resource usage counter
 * 
 * Checks quota before incrementing. Throws QuotaExceededError if quota is exceeded.
 * 
 * @param tenant_id - ID of the tenant
 * @param resource - Resource type to increment
 * @throws QuotaExceededError if quota is exceeded
 * 
 * @example
 * ```typescript
 * try {
 *   await incrementUsage(tenant_id, 'products');
 * } catch (error) {
 *   if (error instanceof QuotaExceededError) {
 *     console.error(`Cannot create product: quota exceeded`);
 *   }
 * }
 * ```
 */
export async function incrementUsage(
  tenant_id: string,
  resource: QuotaResource
): Promise<void> {
  // Check quota before incrementing
  const check = await checkQuota(tenant_id, resource);
  if (!check.allowed) {
    throw new QuotaExceededError(resource, check.current, check.limit);
  }

  // Increment usage
  const field = `current_${resource}`;
  await prisma.tenant_usage.update({
    where: { tenant_id },
    data: {
      [field]: { increment: 1 },
      updated_at: new Date(),
    },
  });
}

/**
 * Decrement resource usage counter
 * 
 * @param tenant_id - ID of the tenant
 * @param resource - Resource type to decrement
 */
export async function decrementUsage(
  tenant_id: string,
  resource: QuotaResource
): Promise<void> {
  const field = `current_${resource}`;
  await prisma.tenant_usage.update({
    where: { tenant_id },
    data: {
      [field]: { decrement: 1 },
      updated_at: new Date(),
    },
  });
}

/**
 * Reset daily quotas for all tenants
 * 
 * Should be called daily at midnight to reset daily_orders counter.
 * This is typically scheduled as a background job.
 * 
 * @example
 * ```typescript
 * // In a scheduled job (e.g., cron)
 * await resetDailyQuotas();
 * ```
 */
export async function resetDailyQuotas(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  await prisma.tenant_usage.updateMany({
    where: {
      last_reset_date: { lt: new Date(today) },
    },
    data: {
      daily_orders: 0,
      last_reset_date: new Date(today),
    },
  });
}

/**
 * Get current quota usage for a tenant
 * 
 * @param tenant_id - ID of the tenant
 * @returns Current usage and limits for all resources
 */
export async function getTenantQuotaUsage(tenant_id: string) {
  const [quota, usage] = await Promise.all([
    prisma.tenant_quotas.findUnique({ where: { tenant_id } }),
    prisma.tenant_usage.findUnique({ where: { tenant_id } }),
  ]);

  if (!quota || !usage) {
    throw new Error(`Quota configuration not found for tenant: ${tenant_id}`);
  }

  return {
    tenant_id,
    resources: {
      terminals: {
        current: usage.current_terminals,
        limit: quota.max_terminals,
        percentage: (usage.current_terminals / quota.max_terminals) * 100,
      },
      employees: {
        current: usage.current_employees,
        limit: quota.max_employees,
        percentage: (usage.current_employees / quota.max_employees) * 100,
      },
      products: {
        current: usage.current_products,
        limit: quota.max_products,
        percentage: (usage.current_products / quota.max_products) * 100,
      },
      daily_orders: {
        current: usage.daily_orders,
        limit: quota.max_daily_orders,
        percentage: (usage.daily_orders / quota.max_daily_orders) * 100,
      },
      storage: {
        current: usage.storage_mb,
        limit: quota.max_storage_mb,
        percentage: (usage.storage_mb / quota.max_storage_mb) * 100,
      },
    },
    last_reset_date: usage.last_reset_date,
  };
}

/**
 * Update tenant quotas
 * 
 * Allows administrators to modify quota limits for a tenant.
 * 
 * @param tenant_id - ID of the tenant
 * @param updates - Partial quota updates
 * @returns Updated quota configuration
 */
export async function updateTenantQuotas(
  tenant_id: string,
  updates: Partial<Omit<TenantQuota, 'tenant_id' | 'created_at' | 'updated_at'>>
) {
  return await prisma.tenant_quotas.update({
    where: { tenant_id },
    data: {
      ...updates,
      updated_at: new Date(),
    },
  });
}

/**
 * Initialize quotas for a new tenant
 * 
 * Called during tenant provisioning to set up default quotas.
 * 
 * @param tenant_id - ID of the tenant
 * @param defaults - Optional custom defaults
 */
export async function initializeTenantQuotas(
  tenant_id: string,
  defaults?: Partial<TenantQuota>
) {
  const defaultQuotas = {
    max_terminals: 20,
    max_employees: 50,
    max_products: 500,
    max_daily_orders: 1000,
    max_storage_mb: 1000,
    ...defaults,
  };

  await Promise.all([
    prisma.tenant_quotas.create({
      data: {
        tenant_id,
        ...defaultQuotas,
      },
    }),
    prisma.tenant_usage.create({
      data: {
        tenant_id,
        current_terminals: 0,
        current_employees: 0,
        current_products: 0,
        daily_orders: 0,
        storage_mb: 0,
        last_reset_date: new Date(),
      },
    }),
  ]);
}
