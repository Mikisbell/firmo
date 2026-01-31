/**
 * Employee Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Employee Role Enum
 */
export const EmployeeRoleSchema = z.enum([
  'OWNER',
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'DRIVER',
  'BAR',
]);

export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;

/**
 * Create Employee Schema
 * Validates data for creating a new employee
 */
export const CreateEmployeeSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(100, 'Nombre muy largo (máximo 100 caracteres)')
    .trim(),
  role: EmployeeRoleSchema,
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN debe ser de 4-6 dígitos numéricos'),
  is_active: z.boolean().default(true).optional(),
});

export type CreateEmployeeDTO = z.infer<typeof CreateEmployeeSchema>;

/**
 * Update Employee Schema
 * All fields are optional for partial updates
 */
export const UpdateEmployeeSchema = z.object({
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(100, 'Nombre muy largo (máximo 100 caracteres)')
    .trim()
    .optional(),
  role: EmployeeRoleSchema.optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, 'PIN debe ser de 4-6 dígitos numéricos')
    .optional(),
  is_active: z.boolean().optional(),
});

export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;

/**
 * Employee ID Schema
 * Validates UUID format
 */
export const EmployeeIdSchema = z.string().uuid('ID de empleado inválido');

/**
 * Employee Query Params Schema
 * Validates query parameters for listing employees
 */
export const EmployeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export type EmployeeQueryParams = z.infer<typeof EmployeeQuerySchema>;
