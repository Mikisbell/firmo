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
  { message: 'At least one field must be updated' }
);

/**
 * Bulk update request schema
 */
export const BulkUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid())
    .min(1, 'At least one product must be selected')
    .max(100, 'Cannot update more than 100 products at once'),
  updates: ProductUpdateSchema,
});

/**
 * Bulk delete request schema
 */
export const BulkDeleteSchema = z.object({
  product_ids: z.array(z.string().uuid())
    .min(1, 'At least one product must be selected')
    .max(100, 'Cannot delete more than 100 products at once'),
});
