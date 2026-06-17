/**
 * Config Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Update Config Schema
 */
export const UpdateConfigSchema = z.object({
  legal_name: z
    .string()
    .min(1, 'Nombre legal es requerido')
    .max(200, 'Nombre legal muy largo (máximo 200 caracteres)'),
  ruc: z
    .string()
    .regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos')
    .nullable()
    .optional(),
  address_text: z
    .string()
    .max(500, 'Dirección muy larga (máximo 500 caracteres)')
    .nullable()
    .optional(),
  table_inactivity_threshold_min: z
    .number()
    .int()
    .min(1, 'El tiempo mínimo es 1 minuto')
    .max(120, 'El tiempo máximo es 120 minutos')
    .optional(),
  sla_normal_min: z
    .number()
    .int()
    .min(1, 'El tiempo mínimo es 1 minuto')
    .max(120, 'El tiempo máximo es 120 minutos')
    .optional(),
  sla_special_min: z
    .number()
    .int()
    .min(1, 'El tiempo mínimo es 1 minuto')
    .max(120, 'El tiempo máximo es 120 minutos')
    .optional(),
});

export type UpdateConfigDTO = z.infer<typeof UpdateConfigSchema>;
