/**
 * Product Images Types - Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  IMAGE_VALIDATION,
  validateImageFile,
  getPrimaryImage,
  reorderAfterDeletion,
  type ProductImage,
} from '../product-images';

describe('Product Images Types', () => {
  describe('IMAGE_VALIDATION constants', () => {
    it('should define MAX_FILE_SIZE', () => {
      expect(IMAGE_VALIDATION.MAX_FILE_SIZE).toBeGreaterThan(0);
    });

    it('should define MAX_IMAGES', () => {
      expect(IMAGE_VALIDATION.MAX_IMAGES).toBeGreaterThanOrEqual(1);
    });

    it('should define ALLOWED_FORMATS', () => {
      expect(IMAGE_VALIDATION.ALLOWED_FORMATS).toContain('image/jpeg');
      expect(IMAGE_VALIDATION.ALLOWED_FORMATS).toContain('image/png');
      expect(IMAGE_VALIDATION.ALLOWED_FORMATS).toContain('image/webp');
    });
  });

  describe('validateImageFile', () => {
    it('should accept a valid image file', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 1024 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject files that are too large', () => {
      const file = new File(['test'], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: IMAGE_VALIDATION.MAX_FILE_SIZE + 1 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
    });

    it('should reject unsupported formats', () => {
      const file = new File(['test'], 'test.bmp', { type: 'image/bmp' });
      Object.defineProperty(file, 'size', { value: 1024 });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('getPrimaryImage', () => {
    it('should return image with order 0', () => {
      const images: ProductImage[] = [
        { id: '1', url: 'https://example.com/1.jpg', thumbnail_url: 'https://example.com/1t.jpg', medium_url: 'https://example.com/1m.jpg', format: 'jpeg', order: 1, size_bytes: 1024, uploaded_at: '2026-01-01T00:00:00Z', uploaded_by: 'user-1' },
        { id: '2', url: 'https://example.com/2.jpg', thumbnail_url: 'https://example.com/2t.jpg', medium_url: 'https://example.com/2m.jpg', format: 'jpeg', order: 0, size_bytes: 1024, uploaded_at: '2026-01-01T00:00:00Z', uploaded_by: 'user-1' },
      ];
      const primary = getPrimaryImage(images);
      expect(primary?.id).toBe('2');
    });

    it('should return undefined for empty array', () => {
      expect(getPrimaryImage([])).toBeUndefined();
    });
  });

  describe('reorderAfterDeletion', () => {
    it('should reassign sequential order values', () => {
      const images: ProductImage[] = [
        { id: '1', url: 'u', thumbnail_url: 't', medium_url: 'm', format: 'jpeg', order: 0, size_bytes: 100, uploaded_at: '2026-01-01T00:00:00Z', uploaded_by: 'user-1' },
        { id: '2', url: 'u', thumbnail_url: 't', medium_url: 'm', format: 'jpeg', order: 1, size_bytes: 100, uploaded_at: '2026-01-01T00:00:00Z', uploaded_by: 'user-1' },
        { id: '3', url: 'u', thumbnail_url: 't', medium_url: 'm', format: 'jpeg', order: 2, size_bytes: 100, uploaded_at: '2026-01-01T00:00:00Z', uploaded_by: 'user-1' },
      ];
      const reordered = reorderAfterDeletion(images, '2');
      expect(reordered).toHaveLength(2);
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].order).toBe(1);
    });
  });
});
