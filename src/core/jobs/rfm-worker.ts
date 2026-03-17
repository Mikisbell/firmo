/**
 * RFM Worker - Daily background job for customer RFM scoring
 *
 * Computes recency, frequency, monetary metrics for all customers per tenant,
 * then classifies into segments (VIP, FRECUENTE, NUEVO, EN_RIESGO, DORMIDO, REGULAR).
 *
 * @module core/jobs/rfm-worker
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { RFM_SEGMENTS } from '@/src/core/admin/schemas/crm.schema';

const logger = pinoLogger.child({ service: 'rfm-worker' });

// ============================================================================
// Types
// ============================================================================

export interface RfmWorkerResult {
  tenants_processed: number;
  customers_updated: number;
  duration_ms: number;
  errors: Array<{ tenant_id: string; error: string }>;
}

// ============================================================================
// RFM Classification
// ============================================================================

/**
 * Classify a customer into an RFM segment based on their metrics.
 *
 * Thresholds (MVP, hardcoded — configurable per tenant in future):
 * - VIP: recent (≤7d), frequent (≥8/month), high spend (≥S/150)
 * - FRECUENTE: recent (≤14d), moderate frequency (≥4/month)
 * - NUEVO: recent (≤30d), low frequency (≤2), low lifetime
 * - EN_RIESGO: moderately lapsed (31-60d)
 * - DORMIDO: lapsed (>60d)
 * - REGULAR: everyone else
 */
export function classifyRfm(
  recencyDays: number | null,
  frequency30d: number | null,
  monetary30d: number | null,
): (typeof RFM_SEGMENTS)[number] {
  const r = recencyDays ?? 999;
  const f = frequency30d ?? 0;
  const m = monetary30d ?? 0;

  if (r <= 7 && f >= 8 && m >= 15000) return 'VIP';
  if (r <= 14 && f >= 4) return 'FRECUENTE';
  if (r <= 30 && f <= 2 && m < 5000) return 'NUEVO';
  if (r > 30 && r <= 60) return 'EN_RIESGO';
  if (r > 60) return 'DORMIDO';
  return 'REGULAR';
}

// ============================================================================
// Worker
// ============================================================================

export class RfmWorker {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = (prismaClient || prisma) as PrismaClient;
  }

  /**
   * Compute RFM for all active tenants
   */
  async computeAll(): Promise<RfmWorkerResult> {
    const start = Date.now();
    const errors: RfmWorkerResult['errors'] = [];
    let totalUpdated = 0;

    const tenants = await (this.prisma as any).tenants.findMany({
      where: { is_active: true },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        const updated = await this.computeForTenant(tenant.id);
        totalUpdated += updated;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error({ tenant_id: tenant.id, error: msg }, 'RFM compute failed for tenant');
        errors.push({ tenant_id: tenant.id, error: msg });
      }
    }

    const result: RfmWorkerResult = {
      tenants_processed: tenants.length,
      customers_updated: totalUpdated,
      duration_ms: Date.now() - start,
      errors,
    };

    logger.info(result, 'RFM worker completed');
    return result;
  }

  /**
   * Compute RFM metrics for a single tenant using efficient SQL
   */
  private async computeForTenant(tenantId: string): Promise<number> {
    // Step 1: Update recency, frequency, monetary from orders aggregation
    await (this.prisma as any).$queryRawUnsafe(
      `UPDATE customer_profile cp
       SET
         recency_days = COALESCE(EXTRACT(DAY FROM NOW() - c.last_order_at)::INT, 999),
         frequency_30d = COALESCE(agg.order_count, 0),
         monetary_30d = COALESCE(agg.total_cents, 0),
         rfm_calculated_at = NOW(),
         updated_at = NOW()
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::INT as order_count, COALESCE(SUM(total_cents), 0)::INT as total_cents
         FROM orders o
         WHERE o.tenant_id = $1
           AND o.customer_id = c.id
           AND o.created_at >= NOW() - INTERVAL '30 days'
           AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
       ) agg ON TRUE
       WHERE cp.customer_id = c.id
         AND cp.tenant_id = $1
         AND c.tenant_id = $1`,
      tenantId,
    );

    // Step 2: Classify rfm_segment based on computed metrics
    const updated = await (this.prisma as any).$queryRawUnsafe(
      `UPDATE customer_profile
       SET rfm_segment = CASE
         WHEN recency_days <= 7 AND frequency_30d >= 8 AND monetary_30d >= 15000 THEN 'VIP'
         WHEN recency_days <= 14 AND frequency_30d >= 4 THEN 'FRECUENTE'
         WHEN recency_days <= 30 AND frequency_30d <= 2 AND monetary_30d < 5000 THEN 'NUEVO'
         WHEN recency_days > 30 AND recency_days <= 60 THEN 'EN_RIESGO'
         WHEN recency_days > 60 THEN 'DORMIDO'
         ELSE 'REGULAR'
       END
       WHERE tenant_id = $1
         AND rfm_calculated_at >= NOW() - INTERVAL '5 minutes'`,
      tenantId,
    );

    // $queryRawUnsafe returns the affected rows count for UPDATE in some adapters
    // but may return an array — handle both
    const count = typeof updated === 'number' ? updated : Array.isArray(updated) ? updated.length : 0;
    return count;
  }
}
