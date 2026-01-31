/**
 * Promotion Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Promotion Type Enum
 */
export const PromotionTypeSchema = z.enum([
  'PERCENT',
  'FIXED',
  'HAPPY_HOUR',
  '2X1',
  'COMBO',
]);

export type PromotionType = z.infer<typeof PromotionTypeSchema>;

/**
 * Create Promotion Schema
 * Validates data for creating a new promotion
 */
const BasePromotionSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(100, 'Nombre muy largo (máximo 100 caracteres)')
    .trim(),
  type: PromotionTypeSchema,
  value: z
    .number()
    .min(0, 'Valor no puede ser negativo')
    .max(100, 'Valor máximo es 100'),
  rules: z.record(z.unknown()).optional(),
  starts_at: z
    .string()
    .datetime('Fecha de inicio inválida'),
  ends_at: z
    .string()
    .datetime('Fecha de fin inválida'),
  is_active: z.boolean().default(true),
});

export const CreatePromotionSchema = BasePromotionSchema.refine(
  (data) => new Date(data.ends_at) > new Date(data.starts_at),
  {
    message: 'Fecha de fin debe ser posterior a fecha de inicio',
    path: ['ends_at'],
  }
);

export type CreatePromotionDTO = z.infer<typeof CreatePromotionSchema>;

/**
 * Update Promotion Schema
 * All fields are optional for partial updates
 */
export const UpdatePromotionSchema = BasePromotionSchema.partial();

export type UpdatePromotionDTO = z.infer<typeof UpdatePromotionSchema>;

/**
 * Promotion ID Schema
 * Validates UUID format
 */
export const PromotionIdSchema = z.string().uuid('ID de promoción inválido');

/**
 * Promotion Query Params Schema
 * Validates query parameters for listing promotions
 */
export const PromotionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  type: PromotionTypeSchema.optional(),
});

export type PromotionQueryParams = z.infer<typeof PromotionQuerySchema>;
