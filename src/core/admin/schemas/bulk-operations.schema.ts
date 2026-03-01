/**
 * Bulk Operations Validation Schemas
 * Zod schemas for bulk product operations
 */

import { z } from 'zod';
import { ProductCategorySchema, ProductStationSchema } from './product.schema';

/**
 * Product update schema for bulk operations
 */
export const ProductUpdateSchema = z.object({
  is_active: z.boolean().optional(),
  category: ProductCategorySchema.optional(),
  station: ProductStationSchema.optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Se debe actualizar al menos un campo' }
);

/**
 * Bulk update request schema
 */
export const BulkUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid())
    .min(1, 'Se debe seleccionar al menos un producto')
    .max(100, 'No se pueden actualizar más de 100 productos a la vez'),
  updates: ProductUpdateSchema,
});

/**
 * Bulk delete request schema
 */
export const BulkDeleteSchema = z.object({
  product_ids: z.array(z.string().uuid())
    .min(1, 'Se debe seleccionar al menos un producto')
    .max(100, 'No se pueden eliminar más de 100 productos a la vez'),
});
