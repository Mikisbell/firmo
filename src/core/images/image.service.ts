/**
 * Image Storage Service
 * 
 * Handles image upload, optimization, and storage for product images.
 * Uses Sharp for image processing and Supabase Storage for persistence.
 * 
 * Features:
 * - Generates 3 versions: original (max 1920x1920), medium (800x800), thumbnail (200x200)
 * - Converts all images to WEBP format for optimal compression
 * - Validates file signatures (magic bytes) to prevent fake extensions
 * - Implements retry logic for upload failures
 * - Tenant-scoped storage paths for data isolation
 */

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { ProductImage } from '@/src/core/types/product-images';

// ============================================================================
// Types
// ============================================================================

export interface UploadedImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: 'webp';
}

export interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format: 'webp' | 'jpeg' | 'png';
}

export interface ImageVersion {
  buffer: Buffer;
  width: number;
  height: number;
  size: number;
}

// ============================================================================
// Constants
// ============================================================================

const IMAGE_SIZES = {
  ORIGINAL: { width: 1920, height: 1920 },
  MEDIUM: { width: 800, height: 800 },
  THUMBNAIL: { width: 200, height: 200 },
} as const;

const WEBP_QUALITY = 85;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// File signature validation (magic bytes)
const FILE_SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
} as const;

// ============================================================================
// Supabase Storage Client
// ============================================================================

function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  }

  const client = createClient(supabaseUrl, supabaseKey);
  return client.storage;
}

// ============================================================================
// File Validation
// ============================================================================

/**
 * Validates file signature (magic bytes) to prevent fake extensions
 */
export function validateFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signature = FILE_SIGNATURES[mimeType as keyof typeof FILE_SIGNATURES];
  
  if (!signature) {
    return false;
  }

  // Check if buffer starts with the expected signature
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validates file format and size
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
    };
  }

  // Check MIME type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format. Must be JPG, PNG, or WEBP (got ${file.type})`,
    };
  }

  return { valid: true };
}

// ============================================================================
// Image Optimization
// ============================================================================

/**
 * Optimizes an image using Sharp
 * Resizes to fit within max dimensions while maintaining aspect ratio
 * Converts to WEBP format for optimal compression
 */
export async function optimizeImage(
  buffer: Buffer,
  options: OptimizeOptions
): Promise<Buffer> {
  const { width, height, quality = WEBP_QUALITY, format = 'webp' } = options;

  let pipeline = sharp(buffer);

  // Resize if dimensions specified
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: 'inside', // Maintain aspect ratio, fit within dimensions
      withoutEnlargement: true, // Don't upscale small images
    });
  }

  // Convert to specified format
  if (format === 'webp') {
    pipeline = pipeline.webp({ quality });
  } else if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality });
  } else if (format === 'png') {
    pipeline = pipeline.png({ quality });
  }

  return pipeline.toBuffer();
}

/**
 * Generates all 3 versions of an image (original, medium, thumbnail)
 */
export async function generateImageVersions(
  buffer: Buffer
): Promise<{
  original: ImageVersion;
  medium: ImageVersion;
  thumbnail: ImageVersion;
}> {
  // Generate original (max 1920x1920)
  const originalBuffer = await optimizeImage(buffer, {
    width: IMAGE_SIZES.ORIGINAL.width,
    height: IMAGE_SIZES.ORIGINAL.height,
    format: 'webp',
  });

  const originalMetadata = await sharp(originalBuffer).metadata();

  // Generate medium (800x800)
  const mediumBuffer = await optimizeImage(buffer, {
    width: IMAGE_SIZES.MEDIUM.width,
    height: IMAGE_SIZES.MEDIUM.height,
    format: 'webp',
  });

  const mediumMetadata = await sharp(mediumBuffer).metadata();

  // Generate thumbnail (200x200)
  const thumbnailBuffer = await optimizeImage(buffer, {
    width: IMAGE_SIZES.THUMBNAIL.width,
    height: IMAGE_SIZES.THUMBNAIL.height,
    format: 'webp',
  });

  const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

  return {
    original: {
      buffer: originalBuffer,
      width: originalMetadata.width || IMAGE_SIZES.ORIGINAL.width,
      height: originalMetadata.height || IMAGE_SIZES.ORIGINAL.height,
      size: originalBuffer.length,
    },
    medium: {
      buffer: mediumBuffer,
      width: mediumMetadata.width || IMAGE_SIZES.MEDIUM.width,
      height: mediumMetadata.height || IMAGE_SIZES.MEDIUM.height,
      size: mediumBuffer.length,
    },
    thumbnail: {
      buffer: thumbnailBuffer,
      width: thumbnailMetadata.width || IMAGE_SIZES.THUMBNAIL.width,
      height: thumbnailMetadata.height || IMAGE_SIZES.THUMBNAIL.height,
      size: thumbnailBuffer.length,
    },
  };
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Uploads a buffer to Supabase Storage with retry logic
 */
async function uploadToStorage(
  path: string,
  buffer: Buffer,
  contentType: string,
  retries = MAX_RETRIES
): Promise<string> {
  const storage = getStorageClient();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await storage
        .from('products')
        .upload(path, buffer, {
          contentType,
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = storage
        .from('products')
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`Failed to upload image after ${retries} attempts: ${error}`);
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
  }

  throw new Error('Upload failed: max retries exceeded');
}

/**
 * Deletes a file from Supabase Storage
 */
async function deleteFromStorage(path: string): Promise<void> {
  const storage = getStorageClient();

  const { error } = await storage
    .from('products')
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Uploads and optimizes a product image
 * Generates 3 versions and uploads to Supabase Storage
 * 
 * @param file - The image file to upload
 * @param tenantId - Tenant ID for scoped storage
 * @param productId - Product ID for organizing images
 * @param uploadedBy - Employee ID who uploaded the image
 * @returns UploadedImage with URLs to all versions
 */
export async function uploadImage(
  file: File,
  tenantId: string,
  productId: string,
  uploadedBy: string
): Promise<UploadedImage> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate file signature
  if (!validateFileSignature(buffer, file.type)) {
    throw new Error('File signature does not match extension. Possible fake file.');
  }

  // Generate image ID
  const imageId = uuidv4();

  // Generate all versions
  const versions = await generateImageVersions(buffer);

  // Upload all versions to Supabase Storage
  const basePath = `${tenantId}/products/${productId}`;

  const [originalUrl, mediumUrl, thumbnailUrl] = await Promise.all([
    uploadToStorage(
      `${basePath}/${imageId}.webp`,
      versions.original.buffer,
      'image/webp'
    ),
    uploadToStorage(
      `${basePath}/${imageId}-medium.webp`,
      versions.medium.buffer,
      'image/webp'
    ),
    uploadToStorage(
      `${basePath}/${imageId}-thumb.webp`,
      versions.thumbnail.buffer,
      'image/webp'
    ),
  ]);

  return {
    id: imageId,
    url: originalUrl,
    thumbnail_url: thumbnailUrl,
    medium_url: mediumUrl,
    size_bytes: versions.original.size,
    format: 'webp',
  };
}

/**
 * Deletes a product image and all its versions
 * 
 * @param imageId - ID of the image to delete
 * @param tenantId - Tenant ID for scoped storage
 * @param productId - Product ID for organizing images
 */
export async function deleteImage(
  imageId: string,
  tenantId: string,
  productId: string
): Promise<void> {
  const basePath = `${tenantId}/products/${productId}`;

  // Delete all versions
  await Promise.all([
    deleteFromStorage(`${basePath}/${imageId}.webp`),
    deleteFromStorage(`${basePath}/${imageId}-medium.webp`),
    deleteFromStorage(`${basePath}/${imageId}-thumb.webp`),
  ]);
}

/**
 * Deletes all images for a product
 * 
 * @param productId - Product ID
 * @param tenantId - Tenant ID for scoped storage
 * @param images - Array of product images to delete
 */
export async function deleteProductImages(
  productId: string,
  tenantId: string,
  images: ProductImage[]
): Promise<void> {
  await Promise.all(
    images.map(image => deleteImage(image.id, tenantId, productId))
  );
}

// ============================================================================
// Exports
// ============================================================================

export const ImageService = {
  uploadImage,
  deleteImage,
  deleteProductImages,
  optimizeImage,
  generateImageVersions,
  validateFile,
  validateFileSignature,
};

export default ImageService;
