/**
 * Analytics Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Realtime Analytics Query Schema
 */
export const RealtimeAnalyticsQuerySchema = z.object({
  shift_id: z.string().uuid('ID de turno inválido').optional(),
});

export type RealtimeAnalyticsQueryParams = z.infer<typeof RealtimeAnalyticsQuerySchema>;

/**
 * Hourly Analytics Query Schema
 */
export const HourlyAnalyticsQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .optional(),
});

export type HourlyAnalyticsQueryParams = z.infer<typeof HourlyAnalyticsQuerySchema>;

/**
 * Top Products Query Schema
 */
export const TopProductsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde debe estar en formato YYYY-MM-DD')
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta debe estar en formato YYYY-MM-DD')
    .optional(),
});

export type TopProductsQueryParams = z.infer<typeof TopProductsQuerySchema>;

/**
 * History Analytics Query Schema
 */
export const HistoryAnalyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
});

export type HistoryAnalyticsQueryParams = z.infer<typeof HistoryAnalyticsQuerySchema>;

/**
 * Comparison Analytics Query Schema
 */
export const ComparisonAnalyticsQuerySchema = z.object({
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde debe estar en formato YYYY-MM-DD'),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta debe estar en formato YYYY-MM-DD'),
  compare_to_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha comparación desde debe estar en formato YYYY-MM-DD')
    .optional(),
  compare_to_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha comparación hasta debe estar en formato YYYY-MM-DD')
    .optional(),
});

export type ComparisonAnalyticsQueryParams = z.infer<typeof ComparisonAnalyticsQuerySchema>;
