/**
 * Table Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Table Shape Enum
 */
export const TableShapeSchema = z.enum(['SQUARE', 'ROUND', 'RECTANGLE']);

export type TableShape = z.infer<typeof TableShapeSchema>;

/**
 * Create Table Schema
 * Validates data for creating a new table
 */
export const CreateTableSchema = z.object({
  number: z
    .string()
    .min(1, 'Número de mesa es requerido')
    .max(20, 'Número muy largo (máximo 20 caracteres)')
    .trim(),
  display_name: z
    .string()
    .max(50, 'Nombre muy largo (máximo 50 caracteres)')
    .trim()
    .optional()
    .nullable(),
  zone_id: z
    .string()
    .uuid('ID de zona inválido')
    .optional()
    .nullable(),
  capacity: z
    .number()
    .int('Capacidad debe ser un número entero')
    .min(1, 'Capacidad mínima es 1')
    .max(20, 'Capacidad máxima es 20')
    .default(4),
  shape: TableShapeSchema.default('SQUARE'),
  position_x: z
    .number()
    .int('Posición X debe ser un número entero')
    .min(0, 'Posición X no puede ser negativa')
    .default(0),
  position_y: z
    .number()
    .int('Posición Y debe ser un número entero')
    .min(0, 'Posición Y no puede ser negativa')
    .default(0),
  width: z
    .number()
    .int('Ancho debe ser un número entero')
    .min(30, 'Ancho mínimo es 30')
    .max(200, 'Ancho máximo es 200')
    .default(60),
  height: z
    .number()
    .int('Alto debe ser un número entero')
    .min(30, 'Alto mínimo es 30')
    .max(200, 'Alto máximo es 200')
    .default(60),
  rotation: z
    .number()
    .int('Rotación debe ser un número entero')
    .min(0, 'Rotación mínima es 0')
    .max(360, 'Rotación máxima es 360')
    .default(0),
  is_active: z.boolean().default(true),
});

export type CreateTableDTO = z.infer<typeof CreateTableSchema>;

/**
 * Update Table Schema
 * All fields are optional for partial updates
 */
export const UpdateTableSchema = CreateTableSchema.partial();

export type UpdateTableDTO = z.infer<typeof UpdateTableSchema>;

/**
 * Table ID Schema
 * Validates UUID format
 */
export const TableIdSchema = z.string().uuid('ID de mesa inválido');

/**
 * Table Query Params Schema
 * Validates query parameters for listing tables
 */
export const TableQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  zone_id: z.string().uuid().optional(),
  active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type TableQueryParams = z.infer<typeof TableQuerySchema>;
