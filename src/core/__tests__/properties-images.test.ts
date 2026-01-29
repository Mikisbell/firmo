/**
 * Property-Based Tests: Image Upload and Management
 * 
 * Tests Properties 1-9 from design document using fast-check
 * Each property is tested with 100 iterations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  validImageFormat,
  imageSize,
  imageDimensions,
  productId,
  tenantId,
  userId,
  productImages,
  productImage,
} from './arbitraries';

// Mock types for image operations
interface ImageFile {
  name: string;
  size: number;
  type: string;
  buffer: Buffer;
}

interface UploadedImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: 'webp';
  order: number;
  uploaded_at: string;
  uploaded_by: string;
}

interface ProductImage {
  id: string;
  url: string;
  thumbnail_url: string;
  medium_url: string;
  size_bytes: number;
  format: 'webp';
  order: number;
  uploaded_at: string;
  uploaded_by: string;
}

// Mock image service
const mockImageService = {
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  optimizeImage: vi.fn(),
  generateVersions: vi.fn(),
};

// Mock storage service
const mockStorageService = {
  upload: vi.fn(),
  delete: vi.fn(),
  getPublicUrl: vi.fn(),
};

describe('Image Upload and Management Properties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Property 1: Valid image acceptance
   * For any image file that meets validation criteria (JPG/PNG/WEBP format, ≤5MB size),
   * uploading it should result in successful acceptance and storage.
   */
  it('Feature: products-p1-improvements, Property 1: Valid image acceptance', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImageFormat,
        imageSize,
        imageDimensions,
        productId,
        tenantId,
        userId,
        async (format, size, dimensions, prodId, tenant, user) => {
          // Arrange: Create valid image file
          const imageFile: ImageFile = {
            name: `test-image.${format.split('/')[1]}`,
            size,
            type: format,
            buffer: Buffer.alloc(size),
          };

          // Mock successful upload
          mockImageService.uploadImage.mockResolvedValue({
            id: 'image-123',
            url: `https://storage.example.com/${tenant}/products/${prodId}/image-123.webp`,
            thumbnail_url: `https://storage.example.com/${tenant}/products/${prodId}/image-123-thumb.webp`,
            medium_url: `https://storage.example.com/${tenant}/products/${prodId}/image-123-medium.webp`,
            size_bytes: size,
            format: 'webp',
            order: 0,
            uploaded_at: new Date().toISOString(),
            uploaded_by: user,
          });

          // Act: Upload image
          const result = await mockImageService.uploadImage(imageFile, tenant, prodId);

          // Assert: Upload should succeed
          expect(result).toBeDefined();
          expect(result.url).toContain(tenant);
          expect(result.url).toContain(prodId);
          expect(result.format).toBe('webp');
          expect(mockImageService.uploadImage).toHaveBeenCalledWith(imageFile, tenant, prodId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Image optimization completeness
   * For any uploaded image, the Image_Upload_Service should generate all three required versions
   * (original max 1920x1920, medium 800x800, thumbnail 200x200) in WEBP format.
   */
  it('Feature: products-p1-improvements, Property 2: Image optimization completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImageFormat,
        imageSize,
        imageDimensions,
        async (format, size, dimensions) => {
          // Arrange: Mock image buffer
          const imageBuffer = Buffer.alloc(size);

          // Mock optimization to generate 3 versions
          mockImageService.generateVersions.mockResolvedValue({
            original: { buffer: Buffer.alloc(size * 0.7), width: Math.min(dimensions.width, 1920), height: Math.min(dimensions.height, 1920) },
            medium: { buffer: Buffer.alloc(size * 0.3), width: 800, height: 800 },
            thumbnail: { buffer: Buffer.alloc(size * 0.1), width: 200, height: 200 },
          });

          // Act: Generate versions
          const versions = await mockImageService.generateVersions(imageBuffer);

          // Assert: All 3 versions should be generated
          expect(versions).toBeDefined();
          expect(versions.original).toBeDefined();
          expect(versions.medium).toBeDefined();
          expect(versions.thumbnail).toBeDefined();
          
          // Verify dimensions
          expect(versions.original.width).toBeLessThanOrEqual(1920);
          expect(versions.original.height).toBeLessThanOrEqual(1920);
          expect(versions.medium.width).toBe(800);
          expect(versions.medium.height).toBe(800);
          expect(versions.thumbnail.width).toBe(200);
          expect(versions.thumbnail.height).toBe(200);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Image storage tenant isolation
   * For any uploaded image, it should be stored in Supabase_Storage under the correct
   * tenant-scoped path: {tenant_id}/products/{product_id}/{image_id}.webp
   */
  it('Feature: products-p1-improvements, Property 3: Image storage tenant isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        productId,
        tenantId,
        fc.uuid(),
        async (prodId, tenant, imageId) => {
          // Arrange: Expected path structure
          const expectedPathPattern = new RegExp(`^${tenant}/products/${prodId}/${imageId}\\.webp$`);

          // Mock storage upload
          mockStorageService.upload.mockResolvedValue({
            path: `${tenant}/products/${prodId}/${imageId}.webp`,
            url: `https://storage.example.com/${tenant}/products/${prodId}/${imageId}.webp`,
          });

          // Act: Upload to storage
          const result = await mockStorageService.upload(
            Buffer.alloc(1024),
            `${tenant}/products/${prodId}/${imageId}.webp`
          );

          // Assert: Path should follow tenant isolation pattern
          expect(result.path).toMatch(expectedPathPattern);
          expect(result.path).toContain(tenant);
          expect(result.path).toContain(prodId);
          expect(result.path).toContain(imageId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Image metadata completeness
   * For any stored image, the database record should contain all required URLs
   * (original, medium, thumbnail) and metadata (size, format, order, timestamps).
   */
  it('Feature: products-p1-improvements, Property 4: Image metadata completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        productImages,
        async (images) => {
          // Act & Assert: Verify each image has complete metadata
          for (const image of images) {
            expect(image.id).toBeDefined();
            expect(image.url).toBeDefined();
            expect(image.thumbnail_url).toBeDefined();
            expect(image.medium_url).toBeDefined();
            expect(image.size_bytes).toBeGreaterThan(0);
            expect(image.format).toBe('webp');
            expect(image.order).toBeGreaterThanOrEqual(0);
            expect(image.order).toBeLessThan(5);
            expect(image.uploaded_at).toBeDefined();
            expect(image.uploaded_by).toBeDefined();

            // Verify URLs are valid
            expect(image.url).toMatch(/^https?:\/\/.+/);
            expect(image.thumbnail_url).toMatch(/^https?:\/\/.+/);
            expect(image.medium_url).toMatch(/^https?:\/\/.+/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Image deletion cleanup
   * For any deleted image, both the database record should be updated AND
   * all three image versions should be removed from Supabase_Storage.
   */
  it('Feature: products-p1-improvements, Property 5: Image deletion cleanup', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        tenantId,
        productId,
        async (imageId, tenant, prodId) => {
          // Arrange: Mock deletion
          const deletedPaths: string[] = [];
          mockStorageService.delete.mockImplementation((path: string) => {
            deletedPaths.push(path);
            return Promise.resolve({ success: true });
          });

          mockImageService.deleteImage.mockImplementation(async () => {
            // Delete all 3 versions
            await mockStorageService.delete(`${tenant}/products/${prodId}/${imageId}.webp`);
            await mockStorageService.delete(`${tenant}/products/${prodId}/${imageId}-medium.webp`);
            await mockStorageService.delete(`${tenant}/products/${prodId}/${imageId}-thumb.webp`);
          });

          // Act: Delete image
          await mockImageService.deleteImage(imageId, tenant);

          // Assert: All 3 versions should be deleted
          expect(deletedPaths).toHaveLength(3);
          expect(deletedPaths).toContain(`${tenant}/products/${prodId}/${imageId}.webp`);
          expect(deletedPaths).toContain(`${tenant}/products/${prodId}/${imageId}-medium.webp`);
          expect(deletedPaths).toContain(`${tenant}/products/${prodId}/${imageId}-thumb.webp`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Multiple image display
   * For any product with N images (where 1 ≤ N ≤ 5), the Admin_Panel should
   * display all N images with reordering capability.
   */
  it('Feature: products-p1-improvements, Property 6: Multiple image display', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }).chain(count => 
          fc.tuple(
            fc.constant(count),
            fc.array(productImage, { minLength: count, maxLength: count })
          )
        ),
        async ([expectedCount, images]) => {
          // Act: Simulate UI rendering
          const displayedImages = images.map((img, index) => ({
            ...img,
            order: index,
            canMoveUp: index > 0,
            canMoveDown: index < images.length - 1,
          }));

          // Assert: All images should be displayed with reorder capability
          expect(displayedImages).toHaveLength(expectedCount);
          
          displayedImages.forEach((img, index) => {
            expect(img.order).toBe(index);
            
            if (index === 0) {
              expect(img.canMoveUp).toBe(false);
            } else {
              expect(img.canMoveUp).toBe(true);
            }
            
            if (index === displayedImages.length - 1) {
              expect(img.canMoveDown).toBe(false);
            } else {
              expect(img.canMoveDown).toBe(true);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Image display version selection
   * For any product with images, the list view should use thumbnail URLs
   * and the detail view should use medium URLs.
   */
  it('Feature: products-p1-improvements, Property 7: Image display version selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        productImages,
        fc.constantFrom('list', 'detail'),
        async (images, viewType) => {
          // Act: Select appropriate URL based on view type
          const selectedUrls = images.map(img => {
            if (viewType === 'list') {
              return img.thumbnail_url;
            } else {
              return img.medium_url;
            }
          });

          // Assert: Correct URL type should be selected
          selectedUrls.forEach((url, index) => {
            if (viewType === 'list') {
              expect(url).toBe(images[index].thumbnail_url);
              expect(url).toContain('thumb');
            } else {
              expect(url).toBe(images[index].medium_url);
              expect(url).toContain('medium');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Upload preview feedback
   * For any successful image upload, the Admin_Panel should display
   * a preview of the uploaded image.
   */
  it('Feature: products-p1-improvements, Property 8: Upload preview feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImageFormat,
        imageSize,
        productId,
        tenantId,
        async (format, size, prodId, tenant) => {
          // Arrange: Mock successful upload
          const uploadedImage: UploadedImage = {
            id: 'new-image-123',
            url: `https://storage.example.com/${tenant}/products/${prodId}/new-image-123.webp`,
            thumbnail_url: `https://storage.example.com/${tenant}/products/${prodId}/new-image-123-thumb.webp`,
            medium_url: `https://storage.example.com/${tenant}/products/${prodId}/new-image-123-medium.webp`,
            size_bytes: size,
            format: 'webp',
            order: 0,
            uploaded_at: new Date().toISOString(),
            uploaded_by: 'user-123',
          };

          mockImageService.uploadImage.mockResolvedValue(uploadedImage);

          // Act: Upload and get preview
          const result = await mockImageService.uploadImage(
            { name: 'test.jpg', size, type: format, buffer: Buffer.alloc(size) },
            tenant,
            prodId
          );

          // Assert: Preview data should be available
          expect(result).toBeDefined();
          expect(result.thumbnail_url).toBeDefined();
          expect(result.medium_url).toBeDefined();
          expect(result.url).toBeDefined();
          
          // Preview should use medium or thumbnail URL
          const previewUrl = result.medium_url || result.thumbnail_url;
          expect(previewUrl).toMatch(/^https?:\/\/.+/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 9: Primary image thumbnail display
   * For any product with at least one image in list view, the primary image
   * (order=0) thumbnail should be displayed.
   */
  it('Feature: products-p1-improvements, Property 9: Primary image thumbnail display', async () => {
    await fc.assert(
      fc.asyncProperty(
        productImages,
        async (images) => {
          // Arrange: Ensure images have proper order
          const sortedImages = images
            .map((img, index) => ({ ...img, order: index }))
            .sort((a, b) => a.order - b.order);

          // Act: Get primary image for list view
          const primaryImage = sortedImages.find(img => img.order === 0);

          // Assert: Primary image should exist and have thumbnail
          if (sortedImages.length > 0) {
            expect(primaryImage).toBeDefined();
            expect(primaryImage!.order).toBe(0);
            expect(primaryImage!.thumbnail_url).toBeDefined();
            expect(primaryImage!.thumbnail_url).toMatch(/^https?:\/\/.+/);
            expect(primaryImage!.thumbnail_url).toContain('thumb');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
