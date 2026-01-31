/**
 * Reports Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Reports Query Schema
 */
export const ReportsQuerySchema = z.object({
  period: z
    .enum(['daily', 'weekly', 'monthly'])
    .default('daily')
    .optional(),
});

export type ReportsQueryParams = z.infer<typeof ReportsQuerySchema>;
