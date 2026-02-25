/**
 * Employee Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from "zod";

/**
 * Employee Role Enum
 */
export const EmployeeRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "COOK",
  "PACKER",
  "BAR",
  "DRIVER",
]);

export type EmployeeRole = z.infer<typeof EmployeeRoleSchema>;

/** DNI peruano: exactamente 8 digits numericos, opcional */
const DniSchema = z
  .string()
  .regex(/^\d{8}$/, "DNI debe tener exactamente 8 digits numericos")
  .optional()
  .nullable();

/**
 * Create Employee Schema
 */
export const CreateEmployeeSchema = z.object({
  name: z
    .string()
    .min(1, "Nombre es requerido")
    .max(100, "Nombre muy largo (maximo 100 caracteres)")
    .trim(),
  role: EmployeeRoleSchema,
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN debe ser de 4-6 digits numericos"),
  dni: DniSchema,
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
    .min(1, "Nombre es requerido")
    .max(100, "Nombre muy largo (maximo 100 caracteres)")
    .trim()
    .optional(),
  role: EmployeeRoleSchema.optional(),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN debe ser de 4-6 digits numericos")
    .optional(),
  dni: DniSchema,
  is_active: z.boolean().optional(),
});

export type UpdateEmployeeDTO = z.infer<typeof UpdateEmployeeSchema>;

/**
 * Employee ID Schema
 */
export const EmployeeIdSchema = z.string().uuid("ID de empleado invalido");

/**
 * Employee Query Params Schema
 */
export const EmployeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  is_active: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
});

export type EmployeeQueryParams = z.infer<typeof EmployeeQuerySchema>;
