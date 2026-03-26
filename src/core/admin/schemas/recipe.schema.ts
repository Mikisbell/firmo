/**
 * Recipe Validation Schemas
 * Esquemas Zod para recetas / fichas técnicas
 */

import { z } from 'zod';

export const RecipeCategorySchema = z.enum([
  'POLLO',
  'ADEREZO',
  'GUARNICION',
  'SALSA',
  'BEBIDA',
  'POSTRE',
  'OTRO',
]);

export type RecipeCategory = z.infer<typeof RecipeCategorySchema>;

export const RecipeIngredientSchema = z.object({
  inventory_code: z.string().min(1, 'Código de inventario es requerido').trim(),
  quantity: z
    .number()
    .positive('Cantidad debe ser mayor a 0')
    .max(99999, 'Cantidad muy alta'),
  unit: z.string().min(1, 'Unidad es requerida').trim(),
  is_optional: z.boolean().optional().default(false),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const CreateRecipeSchema = z.object({
  product_id: z.string().uuid('ID de producto inválido'),
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(200, 'Nombre muy largo (máximo 200 caracteres)')
    .trim()
    .optional()
    .nullable(),
  ingredients: z
    .array(RecipeIngredientSchema)
    .min(1, 'Debe tener al menos 1 ingrediente')
    .max(50, 'Máximo 50 ingredientes'),
  yield_qty: z
    .number()
    .positive('Rendimiento debe ser mayor a 0')
    .max(99999, 'Rendimiento muy alto')
    .default(1),
  yield_unit: z
    .string()
    .min(1)
    .max(30)
    .trim()
    .default('UNIDADES'),
  conversion_factor: z
    .number()
    .positive('Factor de conversión debe ser mayor a 0')
    .max(10, 'Factor muy alto')
    .default(1.0),
  category: RecipeCategorySchema.optional().nullable(),
  preparation_time_minutes: z
    .number()
    .int('Tiempo debe ser entero')
    .min(0, 'Tiempo no puede ser negativo')
    .max(1440, 'Tiempo máximo 24 horas')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(1000, 'Notas muy largas (máximo 1000 caracteres)')
    .trim()
    .optional()
    .nullable(),
});

export type CreateRecipeDTO = z.infer<typeof CreateRecipeSchema>;

export const UpdateRecipeSchema = CreateRecipeSchema.omit({ product_id: true }).partial();

export type UpdateRecipeDTO = z.infer<typeof UpdateRecipeSchema>;

export const RecipeIdSchema = z.string().uuid('ID de receta inválido');

export const RecipeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  category: RecipeCategorySchema.optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  station: z.string().optional(),
});

export type RecipeQueryParams = z.infer<typeof RecipeQuerySchema>;
