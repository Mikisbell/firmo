/**
 * Terminal Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Terminal Query Params Schema
 * Validates query parameters for listing terminals
 */
export const TerminalQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  is_allowed: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  station_id: z.string().optional(),
});

export type TerminalQueryParams = z.infer<typeof TerminalQuerySchema>;

/**
 * Create Terminal Schema
 * Validates data for registering a new terminal
 */
export const CreateTerminalSchema = z.object({
  terminal_id: z
    .string()
    .min(1, 'ID de terminal es requerido')
    .max(50, 'ID de terminal muy largo (máximo 50 caracteres)')
    .trim(),
  station_id: z
    .string()
    .min(1, 'ID de estación es requerido')
    .max(50, 'ID de estación muy largo (máximo 50 caracteres)')
    .trim(),
  is_allowed: z.boolean().default(true),
});

export type CreateTerminalDTO = z.infer<typeof CreateTerminalSchema>;

/**
 * Update Terminal Schema
 * All fields are optional for partial updates
 */
export const UpdateTerminalSchema = z.object({
  station_id: z
    .string()
    .min(1, 'ID de estación es requerido')
    .max(50, 'ID de estación muy largo (máximo 50 caracteres)')
    .trim()
    .optional(),
  is_allowed: z.boolean().optional(),
});

export type UpdateTerminalDTO = z.infer<typeof UpdateTerminalSchema>;

/**
 * Terminal ID Schema
 * Validates UUID format
 */
export const TerminalIdSchema = z.string().uuid('ID de terminal inválido');
