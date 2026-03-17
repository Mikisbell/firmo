/**
 * Segment Service - Customer segment management
 *
 * Creates and evaluates marketing segments based on filter criteria.
 * Supports RFM auto-segments and custom filter combinations.
 *
 * @module core/services/segment.service
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, NotFoundError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { SegmentDefinition, SegmentFilter, RFM_SEGMENTS } from '@/src/core/admin/schemas/crm.schema';

const logger = pinoLogger.child({ service: 'segment' });

// ============================================================================
// Types
// ============================================================================

export interface SegmentRow {
  id: string;
  tenant_id: string;
  name: string;
  definition: SegmentDefinition;
  is_active: boolean;
  updated_at: Date;
}

export interface CustomerSummary {
  id: string;
  name: string | null;
  phone: string;
  loyalty_tier: string | null;
  rfm_segment: string | null;
  loyalty_points_balance: number;
}

export interface SegmentEvaluation {
  count: number;
  customers: CustomerSummary[];
}

// ============================================================================
// Service
// ============================================================================

export class SegmentService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = (prismaClient || prisma) as PrismaClient;
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async create(tenantId: string, input: { name: string; definition: SegmentDefinition }, actorId?: string): Promise<Result<SegmentRow>> {
    const id = uuidv4();

    const segment = await (this.prisma as any).marketing_segments.create({
      data: {
        id,
        tenant_id: tenantId,
        name: input.name,
        definition: input.definition,
        is_active: true,
      },
    });

    logger.info({ tenantId, segmentId: id, name: input.name }, 'Segment created');
    return ok(segment);
  }

  async update(
    tenantId: string,
    segmentId: string,
    input: { name?: string; definition?: SegmentDefinition; is_active?: boolean },
  ): Promise<Result<SegmentRow>> {
    const existing = await (this.prisma as any).marketing_segments.findFirst({
      where: { id: segmentId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Segment not found'));
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.definition !== undefined) data.definition = input.definition;
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const updated = await (this.prisma as any).marketing_segments.update({
      where: { id: segmentId },
      data,
    });

    return ok(updated);
  }

  async delete(tenantId: string, segmentId: string): Promise<Result<void>> {
    const existing = await (this.prisma as any).marketing_segments.findFirst({
      where: { id: segmentId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Segment not found'));
    }

    // Delete members first, then segment
    await (this.prisma as any).segment_members.deleteMany({
      where: { tenant_id: tenantId, segment_id: segmentId },
    });

    await (this.prisma as any).marketing_segments.delete({
      where: { id: segmentId },
    });

    return ok(undefined);
  }

  async list(tenantId: string): Promise<SegmentRow[]> {
    return (this.prisma as any).marketing_segments.findMany({
      where: { tenant_id: tenantId },
      orderBy: { updated_at: 'desc' },
    });
  }

  async getById(tenantId: string, segmentId: string): Promise<Result<SegmentRow>> {
    const segment = await (this.prisma as any).marketing_segments.findFirst({
      where: { id: segmentId, tenant_id: tenantId },
    });

    if (!segment) {
      return err(new NotFoundError('Segment not found'));
    }

    return ok(segment);
  }

  // --------------------------------------------------------------------------
  // Evaluation
  // --------------------------------------------------------------------------

  /**
   * Evaluate segment: count matching customers and return first 100
   */
  async evaluateSegment(tenantId: string, segmentId: string): Promise<Result<SegmentEvaluation>> {
    const segResult = await this.getById(tenantId, segmentId);
    if (!segResult.success) return segResult;

    const definition = segResult.data.definition as SegmentDefinition;
    return this.evaluateDefinition(tenantId, definition);
  }

  /**
   * Evaluate a segment definition directly (for preview before saving)
   */
  async evaluateDefinition(tenantId: string, definition: SegmentDefinition): Promise<Result<SegmentEvaluation>> {
    const profileWhere = this.buildProfileWhere(definition);
    const customerWhere = this.buildCustomerWhere(definition);

    const profiles = await (this.prisma as any).customer_profile.findMany({
      where: {
        tenant_id: tenantId,
        ...profileWhere,
        customers: customerWhere,
      },
      select: {
        customer_id: true,
        loyalty_tier: true,
        rfm_segment: true,
        loyalty_points_balance: true,
        customers: {
          select: { id: true, name: true, phone: true },
        },
      },
      take: 100,
    });

    const count = await (this.prisma as any).customer_profile.count({
      where: {
        tenant_id: tenantId,
        ...profileWhere,
        customers: customerWhere,
      },
    });

    const customers: CustomerSummary[] = profiles.map((p: any) => ({
      id: p.customers.id,
      name: p.customers.name,
      phone: p.customers.phone,
      loyalty_tier: p.loyalty_tier,
      rfm_segment: p.rfm_segment,
      loyalty_points_balance: p.loyalty_points_balance,
    }));

    return ok({ count, customers });
  }

  /**
   * Refresh segment_members table for a segment
   */
  async refreshMembers(tenantId: string, segmentId: string): Promise<Result<{ added: number; removed: number }>> {
    const segResult = await this.getById(tenantId, segmentId);
    if (!segResult.success) return segResult;

    const definition = segResult.data.definition as SegmentDefinition;
    const evalResult = await this.evaluateDefinition(tenantId, definition);
    if (!evalResult.success) return evalResult;

    const newCustomerIds = new Set(evalResult.data.customers.map((c) => c.id));

    // Get current members
    const currentMembers = await (this.prisma as any).segment_members.findMany({
      where: { tenant_id: tenantId, segment_id: segmentId },
      select: { customer_id: true },
    });
    const currentIds = new Set(currentMembers.map((m: any) => m.customer_id as string));

    // Compute diff
    const toAdd = [...newCustomerIds].filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id): id is string => !newCustomerIds.has(id as string));

    // Remove old
    if (toRemove.length > 0) {
      await (this.prisma as any).segment_members.deleteMany({
        where: {
          tenant_id: tenantId,
          segment_id: segmentId,
          customer_id: { in: toRemove },
        },
      });
    }

    // Add new
    if (toAdd.length > 0) {
      await (this.prisma as any).segment_members.createMany({
        data: toAdd.map((customerId) => ({
          tenant_id: tenantId,
          segment_id: segmentId,
          customer_id: customerId,
        })),
        skipDuplicates: true,
      });
    }

    return ok({ added: toAdd.length, removed: toRemove.length });
  }

  /**
   * Create or update the 5 default RFM-based auto-segments
   */
  async syncRfmSegments(tenantId: string): Promise<void> {
    for (const rfmLabel of RFM_SEGMENTS) {
      const name = `Auto: ${rfmLabel}`;
      const definition: SegmentDefinition = {
        type: 'RFM',
        filters: [{ field: 'rfm_segment', operator: 'eq', value: rfmLabel }],
        logic: 'AND',
      };

      const existing = await (this.prisma as any).marketing_segments.findFirst({
        where: { tenant_id: tenantId, name },
      });

      if (existing) {
        await (this.prisma as any).marketing_segments.update({
          where: { id: existing.id },
          data: { definition },
        });
      } else {
        await (this.prisma as any).marketing_segments.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            name,
            definition,
            is_active: true,
          },
        });
      }
    }

    logger.info({ tenantId }, 'RFM auto-segments synced');
  }

  // --------------------------------------------------------------------------
  // Filter → Prisma WHERE builder
  // --------------------------------------------------------------------------

  /**
   * Build Prisma where clause for customer_profile fields
   */
  private buildProfileWhere(definition: SegmentDefinition): Record<string, unknown> {
    const profileFields = new Set([
      'rfm_segment', 'loyalty_tier', 'monetary_30d', 'frequency_30d',
      'recency_days', 'orders_count', 'lifetime_value_cents',
    ]);

    const conditions = definition.filters
      .filter((f) => profileFields.has(f.field))
      .map((f) => this.filterToCondition(f));

    if (conditions.length === 0) return {};
    if (definition.logic === 'OR') return { OR: conditions };
    return { AND: conditions };
  }

  /**
   * Build Prisma where clause for customer-level fields (none currently, placeholder)
   */
  private buildCustomerWhere(_definition: SegmentDefinition): Record<string, unknown> | undefined {
    return undefined;
  }

  private filterToCondition(filter: SegmentFilter): Record<string, unknown> {
    const { field, operator, value } = filter;

    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'neq':
        return { [field]: { not: value } };
      case 'gt':
        return { [field]: { gt: value } };
      case 'gte':
        return { [field]: { gte: value } };
      case 'lt':
        return { [field]: { lt: value } };
      case 'lte':
        return { [field]: { lte: value } };
      case 'in':
        return { [field]: { in: Array.isArray(value) ? value : [value] } };
      default:
        return { [field]: value };
    }
  }
}
