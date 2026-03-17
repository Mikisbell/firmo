/**
 * CRM Schema Validation
 * Zod schemas for segments, campaigns, templates, and RFM
 */

import { z } from 'zod';

// ============================================================================
// RFM
// ============================================================================

export const RFM_SEGMENTS = ['VIP', 'FRECUENTE', 'NUEVO', 'EN_RIESGO', 'DORMIDO', 'REGULAR'] as const;
export type RfmSegment = (typeof RFM_SEGMENTS)[number];

// ============================================================================
// Segment
// ============================================================================

export const SEGMENT_FILTER_FIELDS = [
  'rfm_segment',
  'loyalty_tier',
  'monetary_30d',
  'frequency_30d',
  'recency_days',
  'orders_count',
  'lifetime_value_cents',
] as const;

export const SEGMENT_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in'] as const;

export const SegmentFilterSchema = z.object({
  field: z.enum(SEGMENT_FILTER_FIELDS),
  operator: z.enum(SEGMENT_OPERATORS),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export type SegmentFilter = z.infer<typeof SegmentFilterSchema>;

export const SegmentDefinitionSchema = z.object({
  type: z.enum(['RFM', 'MANUAL', 'CUSTOM']),
  filters: z.array(SegmentFilterSchema).min(1),
  logic: z.enum(['AND', 'OR']).default('AND'),
});

export type SegmentDefinition = z.infer<typeof SegmentDefinitionSchema>;

export const CreateSegmentSchema = z.object({
  name: z.string().min(2).max(100),
  definition: SegmentDefinitionSchema,
});

export const UpdateSegmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  definition: SegmentDefinitionSchema.optional(),
  is_active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

// ============================================================================
// Campaign
// ============================================================================

export const CAMPAIGN_CHANNELS = ['WHATSAPP', 'SMS'] as const;
export const CAMPAIGN_STATUSES = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;

export const CreateCampaignSchema = z.object({
  name: z.string().min(2).max(100),
  segment_id: z.string().uuid(),
  template_id: z.string().uuid(),
  channel: z.enum(CAMPAIGN_CHANNELS).default('WHATSAPP'),
  scheduled_at: z.string().datetime().optional(),
});

// ============================================================================
// Template
// ============================================================================

export const TEMPLATE_CHANNELS = ['WHATSAPP', 'SMS'] as const;

export const CreateTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  channel: z.enum(TEMPLATE_CHANNELS),
  content: z.string().min(1).max(1600),
  variables_schema: z.record(z.string()).optional(),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  channel: z.enum(TEMPLATE_CHANNELS).optional(),
  content: z.string().min(1).max(1600).optional(),
  variables_schema: z.record(z.string()).optional(),
  is_active: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

// ============================================================================
// Template Preview
// ============================================================================

export const PreviewTemplateSchema = z.object({
  variables: z.record(z.string()),
});
