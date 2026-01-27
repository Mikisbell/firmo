/**
 * Unit Tests for Image Service
 * 
 * Tests image upload, optimization, validation, and storage operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import {
  validateFile,
  validateFileSignature,
  optimizeImage,
  generateImageVersions,
  uploadImage,
  deleteImage,
  deleteProductImages,
} from '../image.service';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock File object for testing
 */
function createMockFile(
  name: string,
  size: number,
  type: string,
  content?: Buffer
): File {
  const buffer = content || Buffer.alloc(size);
  // Convert Buffer to Uint8Array for Blob compatibility
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array], { type });
  return new File([blob], name, { type });
}

/**
 * Creates a valid image buffer (1x1 pixel PNG)
 */
function createValidImageBuffer(format: 'png' | 'jpeg' | 'webp' = 'png'): Buffer {
  if (format === 'png') {
    // 1x1 pixel PNG (valid signature: 0x89, 0x50, 0x4E, 0x47)
    return Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
  } else if (format === 'jpeg') {
    // 1x1 pixel JPEG (valid signature: 0xFF, 0xD8, 0xFF)
    return Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
      0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
      0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
      0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
      0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
      0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14,
      0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3f, 0x00, 0x37, 0xff, 0xd9,
    ]);
  } else {
    // 1x1 pixel WEBP (valid signature: 0x52, 0x49, 0x46, 0x46)
    return Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
      0x0e, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
      0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00,
    ]);
  }
}

// ============================================================================
// File Validation Tests
// ============================================================================

describe('validateFile', () => {
  it('should accept a valid 3MB JPG file', () => {
    const file = createMockFile('test.jpg', 3 * 1024 * 1024, 'image/jpeg');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept a valid 1MB PNG file', () => {
    const file = createMockFile('test.png', 1 * 1024 * 1024, 'image/png');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('should accept a valid WEBP file', () => {
    const file = createMockFile('test.webp', 2 * 1024 * 1024, 'image/webp');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('should reject a file larger than 5MB', () => {
    const file = createMockFile('large.jpg', 6 * 1024 * 1024, 'image/jpeg');
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds 5MB limit');
  });

  it('should reject exactly 5MB + 1 byte file', () => {
    const file = createMockFile('large.jpg', 5 * 1024 * 1024 + 1, 'image/jpeg');
    const result = validateFile(file);
    expect(result.valid).toBe(false);
  });

  it('should accept exactly 5MB file', () => {
    const file = createMockFile('exact.jpg', 5 * 1024 * 1024, 'image/jpeg');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid file format (PDF)', () => {
    const file = createMockFile('doc.pdf', 1024 * 1024, 'application/pdf');
    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file format');
  });

  it('should reject invalid file format (GIF)', () => {
    const file = createMockFile('animated.gif', 1024 * 1024, 'image/gif');
    const result = validateFile(file);
    expect(result.valid).toBe(false);
  });

  it('should accept a very small file (1KB)', () => {
    const file = createMockFile('tiny.jpg', 1024, 'image/jpeg');
    const result = validateFile(file);
    expect(result.valid).toBe(true);
  });
});

describe('validateFileSignature', () => {
  it('should validate PNG signature correctly', () => {
    const buffer = createValidImageBuffer('png');
    const result = validateFileSignature(buffer, 'image/png');
    expect(result).toBe(true);
  });

  it('should validate JPEG signature correctly', () => {
    const buffer = createValidImageBuffer('jpeg');
    const result = validateFileSignature(buffer, 'image/jpeg');
    expect(result).toBe(true);
  });

  it('should validate WEBP signature correctly', () => {
    const buffer = createValidImageBuffer('webp');
    const result = validateFileSignature(buffer, 'image/webp');
    expect(result).toBe(true);
  });

  it('should reject PNG with fake JPG extension', () => {
    const buffer = createValidImageBuffer('png');
    const result = validateFileSignature(buffer, 'image/jpeg');
    expect(result).toBe(false);
  });

  it('should reject JPEG with fake PNG extension', () => {
    const buffer = createValidImageBuffer('jpeg');
    const result = validateFileSignature(buffer, 'image/png');
    expect(result).toBe(false);
  });

  it('should reject invalid signature', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const result = validateFileSignature(buffer, 'image/jpeg');
    expect(result).toBe(false);
  });

  it('should reject unsupported MIME type', () => {
    const buffer = createValidImageBuffer('png');
    const result = validateFileSignature(buffer, 'image/gif');
    expect(result).toBe(false);
  });
});

// ============================================================================
// Image Optimization Tests
// ============================================================================

describe('optimizeImage', () => {
  it('should resize image to specified dimensions', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(inputBuffer, {
      width: 800,
      height: 800,
      format: 'webp',
    });

    const metadata = await sharp(optimized).metadata();
    expect(metadata.width).toBeLessThanOrEqual(800);
    expect(metadata.height).toBeLessThanOrEqual(800);
    expect(metadata.format).toBe('webp');
  });

  it('should maintain aspect ratio when resizing', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1600,
        height: 800,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(inputBuffer, {
      width: 800,
      height: 800,
      format: 'webp',
    });

    const metadata = await sharp(optimized).metadata();
    // Should fit within 800x800 while maintaining 2:1 aspect ratio
    expect(metadata.width).toBe(800);
    expect(metadata.height).toBe(400);
  });

  it('should not upscale small images', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(inputBuffer, {
      width: 800,
      height: 800,
      format: 'webp',
    });

    const metadata = await sharp(optimized).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(100);
  });

  it('should convert to WEBP format', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(inputBuffer, {
      width: 500,
      height: 500,
      format: 'webp',
      quality: 85,
    });

    const metadata = await sharp(optimized).metadata();
    expect(metadata.format).toBe('webp');
  });

  it('should compress image (output smaller than input)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const optimized = await optimizeImage(inputBuffer, {
      width: 1000,
      height: 1000,
      format: 'webp',
      quality: 85,
    });

    expect(optimized.length).toBeLessThan(inputBuffer.length);
  });
});

describe('generateImageVersions', () => {
  it('should generate all 3 versions (original, medium, thumbnail)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    expect(versions.original).toBeDefined();
    expect(versions.medium).toBeDefined();
    expect(versions.thumbnail).toBeDefined();
  });

  it('should generate original version (max 1920x1920)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 3000,
        height: 3000,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    expect(versions.original.width).toBeLessThanOrEqual(1920);
    expect(versions.original.height).toBeLessThanOrEqual(1920);
    expect(versions.original.buffer).toBeInstanceOf(Buffer);
    expect(versions.original.size).toBeGreaterThan(0);
  });

  it('should generate medium version (800x800)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    expect(versions.medium.width).toBeLessThanOrEqual(800);
    expect(versions.medium.height).toBeLessThanOrEqual(800);
  });

  it('should generate thumbnail version (200x200)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    expect(versions.thumbnail.width).toBeLessThanOrEqual(200);
    expect(versions.thumbnail.height).toBeLessThanOrEqual(200);
  });

  it('should maintain aspect ratio in all versions', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1600,
        height: 800,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    // All versions should maintain 2:1 aspect ratio
    expect(versions.original.width / versions.original.height).toBeCloseTo(2, 1);
    expect(versions.medium.width / versions.medium.height).toBeCloseTo(2, 1);
    expect(versions.thumbnail.width / versions.thumbnail.height).toBeCloseTo(2, 1);
  });

  it('should convert all versions to WEBP', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1000,
        height: 1000,
        channels: 4,
        background: { r: 128, g: 128, b: 128, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    const originalMeta = await sharp(versions.original.buffer).metadata();
    const mediumMeta = await sharp(versions.medium.buffer).metadata();
    const thumbnailMeta = await sharp(versions.thumbnail.buffer).metadata();

    expect(originalMeta.format).toBe('webp');
    expect(mediumMeta.format).toBe('webp');
    expect(thumbnailMeta.format).toBe('webp');
  });

  it('should have decreasing file sizes (original > medium > thumbnail)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 2000,
        height: 2000,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    expect(versions.original.size).toBeGreaterThan(versions.medium.size);
    expect(versions.medium.size).toBeGreaterThan(versions.thumbnail.size);
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  it('should handle very small images (10x10)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    // Should not upscale
    expect(versions.original.width).toBe(10);
    expect(versions.original.height).toBe(10);
    expect(versions.medium.width).toBe(10);
    expect(versions.thumbnail.width).toBe(10);
  });

  it('should handle very large images (4000x4000)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 4000,
        height: 4000,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    // Should downscale to max dimensions
    expect(versions.original.width).toBeLessThanOrEqual(1920);
    expect(versions.original.height).toBeLessThanOrEqual(1920);
  });

  it('should handle non-square images (portrait)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 800,
        height: 1600,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    // Should maintain aspect ratio
    expect(versions.original.height).toBeGreaterThan(versions.original.width);
    expect(versions.medium.height).toBeGreaterThan(versions.medium.width);
    expect(versions.thumbnail.height).toBeGreaterThan(versions.thumbnail.width);
  });

  it('should handle non-square images (landscape)', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 1600,
        height: 800,
        channels: 4,
        background: { r: 255, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const versions = await generateImageVersions(inputBuffer);

    // Should maintain aspect ratio
    expect(versions.original.width).toBeGreaterThan(versions.original.height);
    expect(versions.medium.width).toBeGreaterThan(versions.medium.height);
    expect(versions.thumbnail.width).toBeGreaterThan(versions.thumbnail.height);
  });
});
