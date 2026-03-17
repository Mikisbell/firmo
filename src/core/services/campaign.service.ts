/**
 * Campaign Service - Marketing campaign lifecycle management
 *
 * Manages campaign CRUD, launch (populates message_outbox), and stats.
 *
 * @module core/services/campaign.service
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, NotFoundError, ValidationError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { SegmentService } from '@/src/core/services/segment.service';
import { TemplateService } from '@/src/core/services/template.service';
import { MessagingService } from '@/src/core/services/messaging.service';

const logger = pinoLogger.child({ service: 'campaign' });

// ============================================================================
// Types
// ============================================================================

export interface CampaignInput {
  name: string;
  segment_id: string;
  template_id: string;
  channel: string;
  scheduled_at?: string;
}

export interface CampaignRow {
  id: string;
  tenant_id: string;
  name: string;
  channel: string;
  segment_id: string | null;
  message_template_id: string | null;
  status: string;
  schedule: { scheduled_at?: string } | null;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
}

// ============================================================================
// Service
// ============================================================================

export class CampaignService {
  private prisma: PrismaClient;
  private segmentService: SegmentService;
  private templateService: TemplateService;

  constructor(
    prismaClient?: PrismaClient,
    segmentService?: SegmentService,
    templateService?: TemplateService,
  ) {
    const p = (prismaClient || prisma) as PrismaClient;
    this.prisma = p;
    this.segmentService = segmentService || new SegmentService(p);
    this.templateService = templateService || new TemplateService(p);
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async create(tenantId: string, input: CampaignInput, actorId?: string): Promise<Result<CampaignRow>> {
    // Validate segment exists
    const segResult = await this.segmentService.getById(tenantId, input.segment_id);
    if (!segResult.success) return err(new ValidationError('Segment not found'));

    // Validate template exists
    const tplResult = await this.templateService.getById(tenantId, input.template_id);
    if (!tplResult.success) return err(new ValidationError('Template not found'));

    const id = uuidv4();
    const campaign = await (this.prisma as any).marketing_campaigns.create({
      data: {
        id,
        tenant_id: tenantId,
        name: input.name,
        channel: input.channel,
        segment_id: input.segment_id,
        message_template_id: input.template_id,
        status: input.scheduled_at ? 'SCHEDULED' : 'DRAFT',
        schedule: input.scheduled_at ? { scheduled_at: input.scheduled_at } : null,
        created_by: actorId ?? null,
      },
    });

    logger.info({ tenantId, campaignId: id }, 'Campaign created');
    return ok(campaign);
  }

  async list(tenantId: string, status?: string): Promise<CampaignRow[]> {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (status) where.status = status;

    return (this.prisma as any).marketing_campaigns.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        marketing_segments: { select: { name: true } },
        message_templates: { select: { name: true } },
      },
    });
  }

  async getById(tenantId: string, campaignId: string): Promise<Result<CampaignRow>> {
    const campaign = await (this.prisma as any).marketing_campaigns.findFirst({
      where: { id: campaignId, tenant_id: tenantId },
      include: {
        marketing_segments: { select: { name: true } },
        message_templates: { select: { name: true, content: true } },
      },
    });

    if (!campaign) {
      return err(new NotFoundError('Campaign not found'));
    }

    return ok(campaign);
  }

  async cancel(tenantId: string, campaignId: string): Promise<Result<void>> {
    const campaign = await (this.prisma as any).marketing_campaigns.findFirst({
      where: { id: campaignId, tenant_id: tenantId },
    });

    if (!campaign) {
      return err(new NotFoundError('Campaign not found'));
    }

    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      return err(new ValidationError('Campaign already finished'));
    }

    await (this.prisma as any).marketing_campaigns.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED' },
    });

    // Cancel pending outbox messages
    await (this.prisma as any).message_outbox.updateMany({
      where: {
        campaign_id: campaignId,
        status: 'QUEUED',
      },
      data: { status: 'CANCELLED' },
    });

    return ok(undefined);
  }

  // --------------------------------------------------------------------------
  // Launch
  // --------------------------------------------------------------------------

  /**
   * Launch a campaign: evaluate segment, interpolate template, populate outbox
   */
  async launch(tenantId: string, campaignId: string): Promise<Result<{ messagesQueued: number }>> {
    const campaign = await (this.prisma as any).marketing_campaigns.findFirst({
      where: { id: campaignId, tenant_id: tenantId },
    });

    if (!campaign) {
      return err(new NotFoundError('Campaign not found'));
    }

    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      return err(new ValidationError(`Cannot launch campaign with status ${campaign.status}`));
    }

    if (!campaign.segment_id || !campaign.message_template_id) {
      return err(new ValidationError('Campaign must have segment and template'));
    }

    // Evaluate segment
    const evalResult = await this.segmentService.evaluateSegment(tenantId, campaign.segment_id);
    if (!evalResult.success) return evalResult;

    if (evalResult.data.count === 0) {
      return ok({ messagesQueued: 0 });
    }

    // Get template
    const tplResult = await this.templateService.getById(tenantId, campaign.message_template_id);
    if (!tplResult.success) return tplResult;

    const template = tplResult.data;

    // Get full customer data for variable interpolation
    const customerProfiles = await (this.prisma as any).customer_profile.findMany({
      where: {
        tenant_id: tenantId,
        customer_id: { in: evalResult.data.customers.map((c) => c.id) },
      },
      select: {
        customer_id: true,
        loyalty_points_balance: true,
        loyalty_tier: true,
        rfm_segment: true,
        customers: { select: { id: true, name: true, phone: true } },
      },
    });

    // Build outbox rows
    const outboxRows = customerProfiles
      .filter((p: any) => p.customers?.phone)
      .map((p: any) => {
        const vars: Record<string, string> = {
          nombre: p.customers.name || 'Cliente',
          puntos: String(p.loyalty_points_balance ?? 0),
          tier: p.loyalty_tier ?? 'BRONCE',
          segmento: p.rfm_segment ?? '',
        };

        const body = MessagingService.interpolate(template.content, vars);

        return {
          id: uuidv4(),
          tenant_id: tenantId,
          channel: campaign.channel,
          customer_id: p.customers.id,
          to_phone: p.customers.phone,
          campaign_id: campaignId,
          template_id: campaign.message_template_id,
          payload: { body, variables: vars },
          status: 'QUEUED',
        };
      });

    if (outboxRows.length > 0) {
      await (this.prisma as any).message_outbox.createMany({
        data: outboxRows,
      });
    }

    // Update campaign status
    await (this.prisma as any).marketing_campaigns.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });

    logger.info({ tenantId, campaignId, messagesQueued: outboxRows.length }, 'Campaign launched');
    return ok({ messagesQueued: outboxRows.length });
  }

  // --------------------------------------------------------------------------
  // Stats
  // --------------------------------------------------------------------------

  async getStats(tenantId: string, campaignId: string): Promise<Result<CampaignStats>> {
    const campaign = await (this.prisma as any).marketing_campaigns.findFirst({
      where: { id: campaignId, tenant_id: tenantId },
    });

    if (!campaign) {
      return err(new NotFoundError('Campaign not found'));
    }

    const [total, queued, sent, failed] = await Promise.all([
      (this.prisma as any).message_outbox.count({ where: { campaign_id: campaignId } }),
      (this.prisma as any).message_outbox.count({ where: { campaign_id: campaignId, status: 'QUEUED' } }),
      (this.prisma as any).message_outbox.count({ where: { campaign_id: campaignId, status: 'SENT' } }),
      (this.prisma as any).message_outbox.count({ where: { campaign_id: campaignId, status: 'FAILED' } }),
    ]);

    return ok({ total, queued, sent, failed });
  }
}
