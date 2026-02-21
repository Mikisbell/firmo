/**
 * Pollo Control Validation Schemas
 * Esquemas Zod para control de producción de pollo
 */

import { z } from 'zod';

export const PolloProductionStatusSchema = z.enum([
  'CRUDO',
  'COCINANDO',
  'COCIDO',
  'SERVIDO',
]);

export type PolloProductionStatus = z.infer<typeof PolloProductionStatusSchema>;

export const LogProductionSchema = z.object({
  location_id: z.string().uuid('ID de local inválido'),
  shift_id: z.string().uuid('ID de turno inválido').optional().nullable(),
  raw_units: z
    .number()
    .positive('Unidades crudas debe ser mayor a 0')
    .max(500, 'Máximo 500 unidades por lote'),
  raw_weight_kg: z
    .number()
    .positive('Peso crudo debe ser mayor a 0')
    .max(2000, 'Peso máximo 2000 kg'),
  notes: z
    .string()
    .max(500, 'Notas muy largas (máximo 500 caracteres)')
    .trim()
    .optional()
    .nullable(),
});

export type LogProductionDTO = z.infer<typeof LogProductionSchema>;

export const CompleteProductionSchema = z.object({
  cooked_units: z
    .number()
    .min(0, 'Unidades cocidas no puede ser negativo')
    .max(500, 'Máximo 500 unidades'),
  cooked_weight_kg: z
    .number()
    .min(0, 'Peso cocido no puede ser negativo')
    .max(2000, 'Peso máximo 2000 kg'),
  waste_units: z
    .number()
    .min(0, 'Merma no puede ser negativa')
    .max(500, 'Máximo 500 unidades')
    .default(0)
    .optional(),
  waste_reason: z
    .string()
    .max(500, 'Razón muy larga (máximo 500 caracteres)')
    .trim()
    .optional()
    .nullable(),
});

export type CompleteProductionDTO = z.infer<typeof CompleteProductionSchema>;

export const PolloHistoryQuerySchema = z.object({
  location_id: z.string().uuid('ID de local inválido').optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export type PolloHistoryQueryParams = z.infer<typeof PolloHistoryQuerySchema>;

export const PolloDashboardQuerySchema = z.object({
  location_id: z.string().uuid('ID de local inválido'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
});

export type PolloDashboardQueryParams = z.infer<typeof PolloDashboardQuerySchema>;
