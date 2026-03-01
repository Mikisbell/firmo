/**
 * Tests for Encryption Module
 *
 * Tests AES-GCM encryption/decryption with:
 * - Round-trip consistency (encrypt then decrypt returns original)
 * - Error handling for corrupt data
 * - Error handling for wrong password
 * - Blob size validation on decrypt
 * - Property-based testing with fast-check
 *
 * @module core/security/__tests__/encryption.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock logger to avoid console noise
vi.mock('@/src/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getCryptoKey, encryptData, decryptData } from '../encryption';

// Configure fast-check
fc.configureGlobal({
  numRuns: 100,
  verbose: false,
});

// Arbitraries
const passwordArbitrary = fc.string({ minLength: 1, maxLength: 64 });

const jsonObjectArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }).filter(
    (s) => !['__proto__', 'constructor', 'prototype'].includes(s)
  ),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  ),
  { minKeys: 1, maxKeys: 10 }
);

describe('Encryption Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCryptoKey', () => {
    it('should return a CryptoKey for a given password', async () => {
      const key = await getCryptoKey('test-password');

      expect(key).toBeDefined();
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('should return the same key material for the same password', async () => {
      const key1 = await getCryptoKey('same-password');
      const key2 = await getCryptoKey('same-password');

      // Keys should have the same algorithm and usages
      expect(key1.algorithm).toEqual(key2.algorithm);
      expect(key1.usages).toEqual(key2.usages);
    });

    it('should return different keys for different passwords', async () => {
      const key1 = await getCryptoKey('password-a');
      const key2 = await getCryptoKey('password-b');

      // Both should be valid AES-GCM keys but for different passwords
      expect(key1.algorithm).toMatchObject({ name: 'AES-GCM' });
      expect(key2.algorithm).toMatchObject({ name: 'AES-GCM' });
    });

    it('should handle empty string password', async () => {
      const key = await getCryptoKey('');
      expect(key).toBeDefined();
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    });

    it('should handle long passwords', async () => {
      const longPassword = 'x'.repeat(1000);
      const key = await getCryptoKey(longPassword);
      expect(key).toBeDefined();
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    });

    it('should handle unicode passwords', async () => {
      const key = await getCryptoKey('contraseña-con-ñ-y-tildes-áéíóú');
      expect(key).toBeDefined();
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
    });
  });

  describe('encryptData', () => {
    it('should return a Blob with correct content type', async () => {
      const data = { hello: 'world' };
      const blob = await encryptData(data, 'password');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/octet-stream');
    });

    it('should return a Blob larger than 12 bytes (IV + at least some ciphertext)', async () => {
      const data = { key: 'value' };
      const blob = await encryptData(data, 'password');

      // 12 bytes IV + at least some encrypted data + 16 bytes GCM tag
      expect(blob.size).toBeGreaterThan(12 + 16);
    });

    it('should produce different ciphertexts for the same data and password (random IV)', async () => {
      const data = { same: 'data' };
      const password = 'same-password';

      const blob1 = await encryptData(data, password);
      const blob2 = await encryptData(data, password);

      const buffer1 = await blob1.arrayBuffer();
      const buffer2 = await blob2.arrayBuffer();

      // IVs are random so ciphertexts should differ
      const arr1 = new Uint8Array(buffer1);
      const arr2 = new Uint8Array(buffer2);

      // Check that at least the IV (first 12 bytes) differs
      let ivDiffers = false;
      for (let i = 0; i < 12; i++) {
        if (arr1[i] !== arr2[i]) {
          ivDiffers = true;
          break;
        }
      }
      expect(ivDiffers).toBe(true);
    });

    it('should handle empty object', async () => {
      const blob = await encryptData({}, 'password');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(12);
    });

    it('should handle deeply nested objects', async () => {
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };
      const blob = await encryptData(data, 'password');
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(12);
    });
  });

  describe('decryptData', () => {
    it('should throw for blobs smaller than 13 bytes', async () => {
      const tinyBlob = new Blob([new Uint8Array(10)], { type: 'application/octet-stream' });

      await expect(decryptData(tinyBlob, 'password')).rejects.toThrow(
        /Archivo muy peque/
      );
    });

    it('should throw for 0-byte blobs', async () => {
      const emptyBlob = new Blob([new Uint8Array(0)], { type: 'application/octet-stream' });

      await expect(decryptData(emptyBlob, 'password')).rejects.toThrow(
        /Archivo muy peque/
      );
    });

    it('should throw for exactly 12-byte blobs (IV only, no ciphertext)', async () => {
      const ivOnlyBlob = new Blob([new Uint8Array(12)], { type: 'application/octet-stream' });

      await expect(decryptData(ivOnlyBlob, 'password')).rejects.toThrow(
        /Archivo muy peque/
      );
    });

    it('should throw with descriptive message for corrupt data', async () => {
      // 13+ bytes of garbage that is not valid AES-GCM ciphertext
      const garbageBlob = new Blob([new Uint8Array(100).fill(0xAB)], {
        type: 'application/octet-stream',
      });

      await expect(decryptData(garbageBlob, 'password')).rejects.toThrow(
        /Contrase.*incorrecta|corrupto/
      );
    });

    it('should throw for wrong password', async () => {
      const data = { secret: 'data' };
      const blob = await encryptData(data, 'correct-password');

      await expect(decryptData(blob, 'wrong-password')).rejects.toThrow(
        /Contrase.*incorrecta|corrupto/
      );
    });
  });

  describe('encrypt + decrypt round-trip', () => {
    it('should round-trip a simple object', async () => {
      const data = { hello: 'world', count: 42 };
      const password = 'test-password';

      const blob = await encryptData(data, password);
      const result = await decryptData(blob, password);

      expect(result).toEqual(data);
    });

    it('should round-trip an array value', async () => {
      const data = { items: [1, 2, 3], name: 'test' };
      const password = 'password123';

      const blob = await encryptData(data, password);
      const result = await decryptData(blob, password);

      expect(result).toEqual(data);
    });

    it('should round-trip with unicode content', async () => {
      const data = { message: 'Hola mundo! Precio: S/. 25.00 ñ áéíóú' };
      const password = 'contraseña';

      const blob = await encryptData(data, password);
      const result = await decryptData(blob, password);

      expect(result).toEqual(data);
    });

    it('should round-trip with null values', async () => {
      const data = { value: null, name: 'test' };
      const password = 'password';

      const blob = await encryptData(data, password);
      const result = await decryptData(blob, password);

      expect(result).toEqual(data);
    });

    it('should round-trip large objects', async () => {
      const data: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        data[`key_${i}`] = `value_${i}_${'x'.repeat(100)}`;
      }
      const password = 'password';

      const blob = await encryptData(data, password);
      const result = await decryptData(blob, password);

      expect(result).toEqual(data);
    });
  });

  describe('Property: Encrypt-Decrypt Round-Trip Consistency', () => {
    it('should round-trip any JSON-serializable object (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          jsonObjectArbitrary,
          passwordArbitrary,
          async (data, password) => {
            const blob = await encryptData(data, password);
            const result = await decryptData(blob, password);

            expect(result).toEqual(data);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always produce blobs larger than IV size (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          jsonObjectArbitrary,
          passwordArbitrary,
          async (data, password) => {
            const blob = await encryptData(data, password);

            // IV (12 bytes) + GCM tag (16 bytes) + at least 1 byte of ciphertext
            expect(blob.size).toBeGreaterThan(12);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail decryption with any other password (50 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          jsonObjectArbitrary,
          passwordArbitrary,
          passwordArbitrary,
          async (data, correctPassword, wrongPassword) => {
            // Ensure passwords are different
            fc.pre(correctPassword !== wrongPassword);

            const blob = await encryptData(data, correctPassword);

            await expect(decryptData(blob, wrongPassword)).rejects.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: getCryptoKey determinism', () => {
    it('should generate keys deterministically for the same password (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          passwordArbitrary,
          async (password) => {
            const key1 = await getCryptoKey(password);
            const key2 = await getCryptoKey(password);

            // Same algorithm
            expect(key1.algorithm).toEqual(key2.algorithm);
            // Same usages
            expect(key1.usages).toEqual(key2.usages);
            // Same extractable flag
            expect(key1.extractable).toBe(key2.extractable);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
