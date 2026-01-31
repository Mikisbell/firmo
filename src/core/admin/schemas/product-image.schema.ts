/**
 * Product Image Validation Schemas
 * 
 * Zod schemas for type-safe validation of product image operations.
 * 
 * @see .kiro/specs/products-p1-improvements/design.md
 */

import { z } from 'zod';
import { IMAGE_CONSTANTS } from '@/src/core/types/product-images';

/**
 * Product Image Schema
 * Validates the structure of a product image object
 */
export const ProductImageSchema = z.object({
  id: z.string().uuid('Image ID must be a valid UUID'),
  url: z.string().url('Image URL must be valid'),
  thumbnail_url: z.string().url('Thumbnail URL must be valid'),
  medium_url: z.string().url('Medium URL must be valid'),
  size_bytes: z.number().int().min(0, 'Size must be non-negative'),
  format: z.literal('webp'),
  order: z.number().int().min(0).max(4, 'Order must be between 0 and 4'),
  uploaded_at: z.string().datetime('Upload timestamp must be ISO 8601 format'),
  uploaded_by: z.string().uuid('Uploader ID must be a valid UUID'),
});

export type ProductImageDTO = z.infer<typeof ProductImageSchema>;

/**
 * Image Upload Request Schema
 * Validates image upload requests
 */
export const ImageUploadRequestSchema = z.object({
  product_id: z.string().uuid('Product ID must be a valid UUID'),
  file: z.custom<File>(
    (val) => val instanceof File,
    'File must be a valid File object'
  )
    .refine(
      (file) => file.size <= IMAGE_CONSTANTS.MAX_FILE_SIZE,
      `File size must be less than ${IMAGE_CONSTANTS.MAX_FILE_SIZE / (1024 * 1024)}MB`
    )
    .refine(
      (file) => IMAGE_CONSTANTS.ACCEPTED_MIME_TYPES.includes(file.type as any),
      `File must be one of: ${IMAGE_CONSTANTS.ACCEPTED_MIME_TYPES.join(', ')}`
    ),
});

export type ImageUploadRequestDTO = z.infer<typeof ImageUploadRequestSchema>;

/**
 * Image Delete Request Schema
 * Validates image deletion requests
 */
export const ImageDeleteRequestSchema = z.object({
  image_id: z.string().uuid('Image ID must be a valid UUID'),
  product_id: z.string().uuid('Product ID must be a valid UUID'),
});

export type ImageDeleteRequestDTO = z.infer<typeof ImageDeleteRequestSchema>;

/**
 * Image Reorder Request Schema
 * Validates image reordering requests
 */
export const ImageReorderRequestSchema = z.object({
  product_id: z.string().uuid('Product ID must be a valid UUID'),
  image_orders: z.array(
    z.object({
      image_id: z.string().uuid('Image ID must be a valid UUID'),
      order: z.number().int().min(0).max(4, 'Order must be between 0 and 4'),
    })
  ).min(1, 'At least one image order must be specified')
    .max(IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT, `Cannot reorder more than ${IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT} images`),
});

export type ImageReorderRequestDTO = z.infer<typeof ImageReorderRequestSchema>;

/**
 * Image Optimization Options Schema
 * Validates image optimization parameters
 */
export const ImageOptimizeOptionsSchema = z.object({
  width: z.number().int().min(1).max(4000).optional(),
  height: z.number().int().min(1).max(4000).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  format: z.enum(['webp', 'jpeg', 'png']),
});

export type ImageOptimizeOptionsDTO = z.infer<typeof ImageOptimizeOptionsSchema>;

/**
 * Product Images Array Schema
 * Validates the entire images array for a product
 */
export const ProductImagesArraySchema = z.array(ProductImageSchema)
  .max(IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT, `Product cannot have more than ${IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT} images`)
  .refine(
    (images) => {
      // Check that orders are unique and sequential (0, 1, 2, ...)
      const orders = images.map(img => img.order).sort((a, b) => a - b);
      return orders.every((order, index) => order === index);
    },
    'Image orders must be unique and sequential starting from 0'
  )
  .refine(
    (images) => {
      // Check that only one image has order 0 (primary image)
      const primaryImages = images.filter(img => img.order === 0);
      return primaryImages.length <= 1;
    },
    'Only one image can be the primary image (order 0)'
  );

export type ProductImagesArrayDTO = z.infer<typeof ProductImagesArraySchema>;
