/**
 * Product Images Types - Unit Tests
 * 
 * Tests for product image type definitions and utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  ProductImage,
  ImageUploadErrorCode,
  ImageUploadErrorMessages,
  IMAGE_CONSTANTS,
} from '../product-images';

describe('Product Images Types', () => {
  describe('IMAGE_CONSTANTS', () => {
    it('should have correct max file size (5MB)', () => {
      expect(IMAGE_CONSTANTS.MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('should have correct max images per product', () => {
      expect(IMAGE_CONSTANTS.MAX_IMAGES_PER_PRODUCT).toBe(5);
    });

    it('should accept JPG, PNG, and WEBP formats', () => {
      expect(IMAGE_CONSTANTS.ACCEPTED_MIME_TYPES).toEqual([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]);
    });

    it('should have correct image size configurations', () => {
      expect(IMAGE_CONSTANTS.SIZES.ORIGINAL).toEqual({
        width: 1920,
        height: 1920,
        quality: 85,
      });
      expect(IMAGE_CONSTANTS.SIZES.MEDIUM).toEqual({
        width: 800,
        height: 800,
        quality: 80,
      });
      expect(IMAGE_CONSTANTS.SIZES.THUMBNAIL).toEqual({
        width: 200,
        height: 200,
        quality: 75,
      });
    });
  });

  describe('ImageUploadErrorMessages', () => {
    it('should have messages for all error codes', () => {
      const errorCodes = Object.values(ImageUploadErrorCode);
      
      errorCodes.forEach((code) => {
        expect(ImageUploadErrorMessages[code]).toBeDefined();
        expect(typeof ImageUploadErrorMessages[code]).toBe('string');
        expect(ImageUploadErrorMessages[code].length).toBeGreaterThan(0);
      });
    });

    it('should have descriptive error messages', () => {
      expect(ImageUploadErrorMessages[ImageUploadErrorCode.FILE_TOO_LARGE]).toContain('5MB');
      expect(ImageUploadErrorMessages[ImageUploadErrorCode.INVALID_FORMAT]).toContain('JPG');
      expect(ImageUploadErrorMessages[ImageUploadErrorCode.MAX_IMAGES_REACHED]).toContain('5');
    });
  });

  describe('ProductImage interface', () => {
    it('should accept valid product image object', () => {
      const validImage: ProductImage = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        url: 'https://storage.supabase.co/products/tenant-123/product-456/image-1.webp',
        thumbnail_url: 'https://storage.supabase.co/products/tenant-123/product-456/image-1-thumb.webp',
        medium_url: 'https://storage.supabase.co/products/tenant-123/product-456/image-1-medium.webp',
        size_bytes: 245678,
        format: 'webp',
        order: 0,
        uploaded_at: '2026-01-27T10:30:00Z',
        uploaded_by: 'employee-uuid',
      };

      expect(validImage.id).toBeDefined();
      expect(validImage.url).toContain('https://');
      expect(validImage.format).toBe('webp');
      expect(validImage.order).toBeGreaterThanOrEqual(0);
      expect(validImage.order).toBeLessThanOrEqual(4);
    });
  });
});
