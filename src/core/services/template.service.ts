/**
 * Template Service - CRUD for message templates
 *
 * Manages per-tenant message templates for WhatsApp/SMS campaigns.
 * Supports variable interpolation preview.
 *
 * @module core/services/template.service
 */

import { PrismaClient } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, NotFoundError, ValidationError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { MessagingService } from '@/src/core/services/messaging.service';

const logger = pinoLogger.child({ service: 'template' });

// ============================================================================
// Types
// ============================================================================

export interface TemplateInput {
  name: string;
  channel: string;
  content: string;
  variables_schema?: Record<string, string>;
}

export interface TemplateRow {
  id: string;
  tenant_id: string;
  channel: string;
  name: string;
  language: string;
  template_key: string | null;
  content: string;
  variables_schema: Record<string, string> | null;
  is_active: boolean;
  updated_at: Date;
}

// ============================================================================
// Service
// ============================================================================

export class TemplateService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = (prismaClient || prisma) as PrismaClient;
  }

  async create(tenantId: string, input: TemplateInput): Promise<Result<TemplateRow>> {
    const id = uuidv4();
    const variables = MessagingService.extractVariables(input.content);
    const schema = input.variables_schema ?? Object.fromEntries(variables.map((v) => [v, 'string']));

    const template = await (this.prisma as any).message_templates.create({
      data: {
        id,
        tenant_id: tenantId,
        name: input.name,
        channel: input.channel,
        content: input.content,
        variables_schema: schema,
        is_active: true,
      },
    });

    logger.info({ tenantId, templateId: id }, 'Template created');
    return ok(template);
  }

  async update(
    tenantId: string,
    templateId: string,
    input: Partial<TemplateInput> & { is_active?: boolean },
  ): Promise<Result<TemplateRow>> {
    const existing = await (this.prisma as any).message_templates.findFirst({
      where: { id: templateId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Template not found'));
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.channel !== undefined) data.channel = input.channel;
    if (input.content !== undefined) {
      data.content = input.content;
      const variables = MessagingService.extractVariables(input.content);
      data.variables_schema = input.variables_schema ?? Object.fromEntries(variables.map((v) => [v, 'string']));
    }
    if (input.variables_schema !== undefined && !data.variables_schema) {
      data.variables_schema = input.variables_schema;
    }
    if (input.is_active !== undefined) data.is_active = input.is_active;

    const updated = await (this.prisma as any).message_templates.update({
      where: { id: templateId },
      data,
    });

    return ok(updated);
  }

  async delete(tenantId: string, templateId: string): Promise<Result<void>> {
    const existing = await (this.prisma as any).message_templates.findFirst({
      where: { id: templateId, tenant_id: tenantId },
    });

    if (!existing) {
      return err(new NotFoundError('Template not found'));
    }

    await (this.prisma as any).message_templates.delete({
      where: { id: templateId },
    });

    return ok(undefined);
  }

  async list(tenantId: string, channel?: string): Promise<TemplateRow[]> {
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (channel) where.channel = channel;

    return (this.prisma as any).message_templates.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });
  }

  async getById(tenantId: string, templateId: string): Promise<Result<TemplateRow>> {
    const template = await (this.prisma as any).message_templates.findFirst({
      where: { id: templateId, tenant_id: tenantId },
    });

    if (!template) {
      return err(new NotFoundError('Template not found'));
    }

    return ok(template);
  }

  async preview(tenantId: string, templateId: string, sampleVars: Record<string, string>): Promise<Result<string>> {
    const result = await this.getById(tenantId, templateId);
    if (!result.success) return result;

    const interpolated = MessagingService.interpolate(result.data.content, sampleVars);
    return ok(interpolated);
  }
}
