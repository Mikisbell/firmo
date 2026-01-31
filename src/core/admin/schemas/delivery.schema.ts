/**
 * Delivery Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Delivery History Query Schema
 */
export const DeliveryHistoryQuerySchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde debe estar en formato YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta debe estar en formato YYYY-MM-DD')
    .optional(),
  status: z.string().optional(),
  driverId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});

export type DeliveryHistoryQueryParams = z.infer<typeof DeliveryHistoryQuerySchema>;

/**
 * Driver Metrics Query Schema
 */
export const DriverMetricsQuerySchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde debe estar en formato YYYY-MM-DD')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta debe estar en formato YYYY-MM-DD')
    .optional(),
});

export type DriverMetricsQueryParams = z.infer<typeof DriverMetricsQuerySchema>;
