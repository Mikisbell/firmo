/**
 * Zone Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Create Zone Schema
 * Validates data for creating a new zone
 */
export const CreateZoneSchema = z.object({
  code: z
    .string()
    .min(1, 'Código es requerido')
    .max(20, 'Código muy largo (máximo 20 caracteres)')
    .regex(/^[A-Z0-9_-]+$/, 'Código debe ser alfanumérico en mayúsculas')
    .trim(),
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(50, 'Nombre muy largo (máximo 50 caracteres)')
    .trim(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color debe ser formato hexadecimal (#RRGGBB)')
    .default('#4CAF50'),
  is_outdoor: z.boolean().default(false),
  is_smoking: z.boolean().default(false),
  has_ac: z.boolean().default(false),
  sort_order: z
    .number()
    .int('Orden debe ser entero')
    .min(0, 'Orden no puede ser negativo')
    .default(0),
  is_active: z.boolean().default(true),
});

export type CreateZoneDTO = z.infer<typeof CreateZoneSchema>;

/**
 * Update Zone Schema
 * All fields are optional for partial updates
 */
export const UpdateZoneSchema = CreateZoneSchema.partial();

export type UpdateZoneDTO = z.infer<typeof UpdateZoneSchema>;

/**
 * Zone ID Schema
 * Validates UUID format
 */
export const ZoneIdSchema = z.string().uuid('ID de zona inválido');

/**
 * Zone Query Params Schema
 * Validates query parameters for listing zones
 */
export const ZoneQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  is_outdoor: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  is_smoking: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type ZoneQueryParams = z.infer<typeof ZoneQuerySchema>;
