/**
 * Compression utilities for cache values
 *
 * Uses browser-compatible compression for values > 1KB
 * Falls back to no compression if compression fails
 *
 * @module core/utils/compression
 */

import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('compression');

/**
 * Compress a string using base64 encoding
 * In a real implementation, this would use a compression library like pako or lz-string
 * For now, we use a simple base64 encoding as a placeholder
 */
export async function compress(value: string): Promise<string> {
  try {
    // In production, use a proper compression library like lz-string
    // For now, use base64 as a placeholder
    if (typeof Buffer !== 'undefined') {
      // Node.js environment
      return Buffer.from(value).toString('base64');
    } else {
      // Browser environment
      return btoa(value);
    }
  } catch (error) {
    // Graceful degradation - return original value if compression fails
    log.error('Compresión falló', error instanceof Error ? error : new Error(String(error)));
    return value;
  }
}

/**
 * Decompress a string from base64 encoding
 */
export async function decompress(value: string): Promise<string> {
  try {
    if (typeof Buffer !== 'undefined') {
      // Node.js environment
      return Buffer.from(value, 'base64').toString('utf-8');
    } else {
      // Browser environment
      return atob(value);
    }
  } catch (error) {
    // Graceful degradation - return original value if decompression fails
    log.error('Descompresión falló', error instanceof Error ? error : new Error(String(error)));
    return value;
  }
}
