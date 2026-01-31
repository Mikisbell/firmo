/**
 * Product Image Types
 * 
 * Type definitions for product image management in PARK POS.
 * These types support the image upload, storage, and display features.
 * 
 * @see .kiro/specs/products-p1-improvements/design.md
 */

/**
 * Product Image stored in database (JSONB format)
 * 
 * Represents a single image associated with a product.
 * Stored in products.images JSONB column as an array.
 */
export interface ProductImage {
  /** Unique identifier for the image (UUID) */
  id: string;
  
  /** Full size image URL (max 1920x1920, WEBP format) */
  url: string;
  
  /** Thumbnail URL (200x200, WEBP format) */
  thumbnail_url: string;
  
  /** Medium size URL (800x800, WEBP format) */
  medium_url: string;
  
  /** File size in bytes */
  size_bytes: number;
  
  /** Image format (always 'webp' after optimization) */
  format: 'webp';
  
  /** Display order (0-4, where 0 is primary image) */
  order: number;
  
  /** Upload timestamp (ISO 8601 format) */
  uploaded_at: string;
  
  /** Employee UUID who uploaded the image */
  uploaded_by: string;
}

/**
 * Response from image upload operation
 */
export interface ImageUploadResponse {
  /** Success status */
  success: boolean;
  
  /** Uploaded image data (if successful) */
  image?: ProductImage;
  
  /** Error details (if failed) */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Image optimization options
 */
export interface ImageOptimizeOptions {
  /** Target width in pixels */
  width?: number;
  
  /** Target height in pixels */
  height?: number;
  
  /** Quality (1-100) */
  quality?: number;
  
  /** Output format */
  format: 'webp' | 'jpeg' | 'png';
}

/**
 * Uploaded image metadata (before database storage)
 */
export interface UploadedImageMetadata {
  /** Generated UUID for the image */
  id: string;
  
  /** Full size image URL */
  url: string;
  
  /** Thumbnail URL */
  thumbnail_url: string;
  
  /** Medium size URL */
  medium_url: string;
  
  /** File size in bytes */
  size_bytes: number;
  
  /** Image format */
  format: 'webp';
}

/**
 * Image upload error codes
 */
export enum ImageUploadErrorCode {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MAX_IMAGES_REACHED = 'MAX_IMAGES_REACHED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
}

/**
 * Image upload error messages
 */
export const ImageUploadErrorMessages: Record<ImageUploadErrorCode, string> = {
  [ImageUploadErrorCode.FILE_TOO_LARGE]: 'File size exceeds 5MB limit',
  [ImageUploadErrorCode.INVALID_FORMAT]: 'File must be JPG, PNG, or WEBP',
  [ImageUploadErrorCode.INVALID_SIGNATURE]: 'File signature does not match extension',
  [ImageUploadErrorCode.MAX_IMAGES_REACHED]: 'Product already has maximum of 5 images',
  [ImageUploadErrorCode.UPLOAD_FAILED]: 'Failed to upload image to storage',
  [ImageUploadErrorCode.OPTIMIZATION_FAILED]: 'Failed to optimize image',
  [ImageUploadErrorCode.STORAGE_UNAVAILABLE]: 'Storage service is currently unavailable',
};

/**
 * Constants for image management
 */
export const IMAGE_CONSTANTS = {
  /** Maximum file size in bytes (5MB) */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  
  /** Maximum number of images per product */
  MAX_IMAGES_PER_PRODUCT: 5,
  
  /** Accepted MIME types */
  ACCEPTED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
  
  /** Image size configurations */
  SIZES: {
    ORIGINAL: { width: 1920, height: 1920, quality: 85 },
    MEDIUM: { width: 800, height: 800, quality: 80 },
    THUMBNAIL: { width: 200, height: 200, quality: 75 },
  },
  
  /** Storage path template */
  STORAGE_PATH_TEMPLATE: '{tenant_id}/products/{product_id}/{image_id}.webp',
} as const;
