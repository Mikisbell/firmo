/**
 * Product Types - Unit Tests
 * 
 * Tests for product type utilities and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
  Product,
  getPrimaryImage,
  getPrimaryImageThumbnail,
  hasImages,
  canAddMoreImages,
  formatProductPrice,
  withMetadata,
} from '../product';
import { unsafeCentavos } from '../shared';
import { ProductImage } from '../product-images';

describe('Product Type Utilities', () => {
  const mockImage1: ProductImage = {
    id: 'img-1',
    url: 'https://example.com/img1.webp',
    thumbnail_url: 'https://example.com/img1-thumb.webp',
    medium_url: 'https://example.com/img1-medium.webp',
    size_bytes: 100000,
    format: 'webp',
    order: 0,
    uploaded_at: '2026-01-27T10:00:00Z',
    uploaded_by: 'user-1',
  };

  const mockImage2: ProductImage = {
    id: 'img-2',
    url: 'https://example.com/img2.webp',
    thumbnail_url: 'https://example.com/img2-thumb.webp',
    medium_url: 'https://example.com/img2-medium.webp',
    size_bytes: 150000,
    format: 'webp',
    order: 1,
    uploaded_at: '2026-01-27T10:05:00Z',
    uploaded_by: 'user-1',
  };

  const mockProduct: Product = {
    id: 'product-1',
    tenant_id: 'tenant-1',
    sku: 'P001',
    name: '1/4 Pollo a la Brasa',
    short_name: '1/4 Pollo',
    price_cents: unsafeCentavos(2500),
    category: 'POLLOS',
    station: 'PARRILLA',
    type: 'SIMPLE',
    is_active: true,
    images: [mockImage1, mockImage2],
    version: 1,
    created_at: new Date('2026-01-27T09:00:00Z'),
    updated_at: new Date('2026-01-27T09:00:00Z'),
    created_by: 'user-1',
    updated_by: 'user-1',
  };

  describe('getPrimaryImage', () => {
    it('should return the image with order=0', () => {
      const primary = getPrimaryImage(mockProduct);
      expect(primary).toBeDefined();
      expect(primary?.id).toBe('img-1');
      expect(primary?.order).toBe(0);
    });

    it('should return undefined if no images', () => {
      const productNoImages: Product = { ...mockProduct, images: [] };
      const primary = getPrimaryImage(productNoImages);
      expect(primary).toBeUndefined();
    });

    it('should return undefined if no primary image (no order=0)', () => {
      const productNoPrimary: Product = {
        ...mockProduct,
        images: [{ ...mockImage2, order: 1 }],
      };
      const primary = getPrimaryImage(productNoPrimary);
      expect(primary).toBeUndefined();
    });
  });

  describe('getPrimaryImageThumbnail', () => {
    it('should return thumbnail URL of primary image', () => {
      const thumbnail = getPrimaryImageThumbnail(mockProduct);
      expect(thumbnail).toBe('https://example.com/img1-thumb.webp');
    });

    it('should return undefined if no images', () => {
      const productNoImages: Product = { ...mockProduct, images: [] };
      const thumbnail = getPrimaryImageThumbnail(productNoImages);
      expect(thumbnail).toBeUndefined();
    });
  });

  describe('hasImages', () => {
    it('should return true if product has images', () => {
      expect(hasImages(mockProduct)).toBe(true);
    });

    it('should return false if product has no images', () => {
      const productNoImages: Product = { ...mockProduct, images: [] };
      expect(hasImages(productNoImages)).toBe(false);
    });
  });

  describe('canAddMoreImages', () => {
    it('should return true if product has less than 5 images', () => {
      expect(canAddMoreImages(mockProduct)).toBe(true);
    });

    it('should return false if product has 5 images', () => {
      const productMaxImages: Product = {
        ...mockProduct,
        images: [
          mockImage1,
          { ...mockImage2, order: 1 },
          { ...mockImage2, id: 'img-3', order: 2 },
          { ...mockImage2, id: 'img-4', order: 3 },
          { ...mockImage2, id: 'img-5', order: 4 },
        ],
      };
      expect(canAddMoreImages(productMaxImages)).toBe(false);
    });

    it('should return true if product has no images', () => {
      const productNoImages: Product = { ...mockProduct, images: [] };
      expect(canAddMoreImages(productNoImages)).toBe(true);
    });
  });

  describe('formatProductPrice', () => {
    it('should format price correctly with 2 decimals', () => {
      expect(formatProductPrice(unsafeCentavos(2500))).toBe('S/ 25.00');
      expect(formatProductPrice(unsafeCentavos(1050))).toBe('S/ 10.50');
      expect(formatProductPrice(unsafeCentavos(99))).toBe('S/ 0.99');
    });

    it('should handle zero price', () => {
      expect(formatProductPrice(unsafeCentavos(0))).toBe('S/ 0.00');
    });

    it('should handle large prices', () => {
      expect(formatProductPrice(unsafeCentavos(999999))).toBe('S/ 9999.99');
    });
  });

  describe('withMetadata', () => {
    it('should add metadata to product', () => {
      const productWithMeta = withMetadata(mockProduct);
      
      expect(productWithMeta.image_count).toBe(2);
      expect(productWithMeta.has_primary_image).toBe(true);
      expect(productWithMeta.formatted_price).toBe('S/ 25.00');
    });

    it('should handle product with no images', () => {
      const productNoImages: Product = { ...mockProduct, images: [] };
      const productWithMeta = withMetadata(productNoImages);
      
      expect(productWithMeta.image_count).toBe(0);
      expect(productWithMeta.has_primary_image).toBe(false);
      expect(productWithMeta.formatted_price).toBe('S/ 25.00');
    });

    it('should preserve all original product fields', () => {
      const productWithMeta = withMetadata(mockProduct);
      
      expect(productWithMeta.id).toBe(mockProduct.id);
      expect(productWithMeta.sku).toBe(mockProduct.sku);
      expect(productWithMeta.name).toBe(mockProduct.name);
      expect(productWithMeta.price_cents).toBe(mockProduct.price_cents);
      expect(productWithMeta.images).toEqual(mockProduct.images);
    });
  });
});
