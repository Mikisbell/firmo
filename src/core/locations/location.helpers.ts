/**
 * Shared location helpers
 */

import prisma from '@/src/core/db/prisma';

/**
 * Returns the primary active location for a tenant (oldest by created_at).
 * Used consistently across all admin API routes so they always resolve the
 * same location regardless of call order.
 */
export async function getTenantLocationId(tenantId: string): Promise<string | null> {
  const loc = await prisma.locations.findFirst({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true },
    orderBy: { created_at: 'asc' },
  });
  return loc?.id ?? null;
}
