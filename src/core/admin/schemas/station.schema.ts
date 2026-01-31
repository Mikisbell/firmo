/**
 * Station Schema Validation
 * Zod schemas for KDS stations CRUD operations
 * 
 * Requirements: Stations management
 */

import { z } from 'zod';

export const CreateStationSchema = z.object({
  code: z.string()
    .min(2, 'El código debe tener al menos 2 caracteres')
    .max(20, 'El código no puede exceder 20 caracteres')
    .regex(/^[A-Z_]+$/, 'El código debe estar en mayúsculas y solo contener letras y guiones bajos')
    .transform(val => val.toUpperCase()),
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  is_active: z.boolean().default(true),
});

export const UpdateStationSchema = z.object({
  name: z.string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .optional(),
  is_active: z.boolean().optional(),
  estimated_time: z.number()
    .int('El tiempo estimado debe ser un número entero')
    .min(1, 'El tiempo estimado debe ser al menos 1 minuto')
    .max(60, 'El tiempo estimado no puede exceder 60 minutos')
    .optional(),
});

export const StationQuerySchema = z.object({
  is_active: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  search: z.string().optional(),
});

export type CreateStationInput = z.infer<typeof CreateStationSchema>;
export type UpdateStationInput = z.infer<typeof UpdateStationSchema>;
export type StationQueryInput = z.infer<typeof StationQuerySchema>;
