/**
 * Product Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';
import { ProductImagesArraySchema } from './product-image.schema';

/**
 * Product Category Enum
 */
export const ProductCategorySchema = z.enum([
  'POLLOS',
  'PARRILLAS',
  'CRIOLLOS',
  'SALCHIPAPAS',
  'ALITAS',
  'PIQUEOS',
  'BEBIDAS',
  'GUARNICIONES',
  'EXTRAS',
  'POSTRES',
  'COMBOS',
]);

export type ProductCategory = z.infer<typeof ProductCategorySchema>;

/**
 * Product Station Enum
 */
export const ProductStationSchema = z.enum([
  'PARRILLA',
  'COCINA',
  'BAR',
  'HORNO',
  'POSTRES',
  'EMPAQUE',
]);

export type ProductStation = z.infer<typeof ProductStationSchema>;

/**
 * Product Type Enum
 */
export const ProductTypeSchema = z.enum(['SIMPLE', 'COMBO']);

export type ProductType = z.infer<typeof ProductTypeSchema>;

/**
 * Create Product Schema
 * Validates data for creating a new product
 */
export const CreateProductSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU es requerido')
    .max(50, 'SKU muy largo (máximo 50 caracteres)')
    .trim(),
  name: z
    .string()
    .min(1, 'Nombre es requerido')
    .max(200, 'Nombre muy largo (máximo 200 caracteres)')
    .trim(),
  short_name: z
    .string()
    .max(50, 'Nombre corto muy largo (máximo 50 caracteres)')
    .trim()
    .optional()
    .nullable(),
  price_cents: z
    .number()
    .int('Precio debe ser un número entero de centavos')
    .min(0, 'Precio no puede ser negativo')
    .max(1000000, 'Precio muy alto (máximo S/10,000)'),
  category: ProductCategorySchema,
  station: ProductStationSchema,
  type: ProductTypeSchema.optional().default('SIMPLE'),
  is_active: z.boolean().optional().default(true),
  images: ProductImagesArraySchema.optional().default([]),
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;

/**
 * Update Product Schema
 * All fields are optional for partial updates
 */
export const UpdateProductSchema = CreateProductSchema.partial();

export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>;

/**
 * Product ID Schema
 * Validates UUID format
 */
export const ProductIdSchema = z.string().uuid('ID de producto inválido');

/**
 * Product Query Params Schema
 * Validates query parameters for listing products
 */
export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  category: ProductCategorySchema.optional(),
  station: ProductStationSchema.optional(),
});

export type ProductQueryParams = z.infer<typeof ProductQuerySchema>;
