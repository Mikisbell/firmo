/**
 * Unit Tests for Tenant Data Encryption
 * 
 * Task 18.8 - IndexedDB Tenant Isolation
 * 
 * Tests encryption/decryption functionality:
 * - Encryption/decryption round trip
 * - Tenant-specific keys
 * - Data integrity
 * - Error handling
 * 
 * Validates: Requirements 15.5
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
    encryptTenantData,
    decryptTenantData,
    encryptTenantDataBatch,
    decryptTenantDataBatch,
    reencryptTenantData,
    clearTenantEncryptionKey,
    clearAllEncryptionKeys,
    type EncryptedData,
} from '../tenant-encryption';

// Mock window and crypto for tests
Object.defineProperty(global, 'window', {
    value: {
        crypto: global.crypto,
    },
    writable: true,
    configurable: true,
});

// ============================================================================
// Test Data
// ============================================================================

const TENANT_ID_1 = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID_2 = '550e8400-e29b-41d4-a716-446655440001';

const TEST_DATA = {
    simple: { message: 'Hello, World!' },
    complex: {
        user: {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com',
        },
        orders: [
            { id: 1, total: 100 },
            { id: 2, total: 200 },
        ],
        metadata: {
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
        },
    },
    array: [1, 2, 3, 4, 5],
    string: 'test string',
    number: 42,
    boolean: true,
};

// ============================================================================
// Unit Tests
// ============================================================================

describe('Tenant Data Encryption', () => {
    afterEach(() => {
        clearAllEncryptionKeys();
    });

    describe('encryptTenantData', () => {
        it('should encrypt data successfully', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);

            expect(encrypted).toBeDefined();
            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.algorithm).toBe('AES-GCM');
            expect(encrypted.version).toBe(1);
            expect(typeof encrypted.ciphertext).toBe('string');
            expect(encrypted.ciphertext.length).toBeGreaterThan(0);
        });

        it('should produce different ciphertexts for same data (due to random IV)', async () => {
            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const encrypted2 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);

            expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        });

        it('should handle complex data structures', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.complex);

            expect(encrypted.ciphertext).toBeDefined();
            expect(encrypted.algorithm).toBe('AES-GCM');
        });

        it('should handle arrays', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.array);

            expect(encrypted.ciphertext).toBeDefined();
        });

        it('should handle primitive types', async () => {
            const stringEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.string);
            const numberEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.number);
            const booleanEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.boolean);

            expect(stringEncrypted.ciphertext).toBeDefined();
            expect(numberEncrypted.ciphertext).toBeDefined();
            expect(booleanEncrypted.ciphertext).toBeDefined();
        });

        it('should throw error for invalid tenant_id', async () => {
            await expect(encryptTenantData('invalid-id', TEST_DATA.simple)).rejects.toThrow();
        });
    });

    describe('decryptTenantData', () => {
        it('should decrypt data successfully', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const decrypted = await decryptTenantData(TENANT_ID_1, encrypted);

            expect(decrypted).toEqual(TEST_DATA.simple);
        });

        it('should decrypt complex data structures', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.complex);
            const decrypted = await decryptTenantData(TENANT_ID_1, encrypted);

            expect(decrypted).toEqual(TEST_DATA.complex);
        });

        it('should decrypt arrays', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.array);
            const decrypted = await decryptTenantData(TENANT_ID_1, encrypted);

            expect(decrypted).toEqual(TEST_DATA.array);
        });

        it('should decrypt primitive types', async () => {
            const stringEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.string);
            const numberEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.number);
            const booleanEncrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.boolean);

            const stringDecrypted = await decryptTenantData(TENANT_ID_1, stringEncrypted);
            const numberDecrypted = await decryptTenantData(TENANT_ID_1, numberEncrypted);
            const booleanDecrypted = await decryptTenantData(TENANT_ID_1, booleanEncrypted);

            expect(stringDecrypted).toBe(TEST_DATA.string);
            expect(numberDecrypted).toBe(TEST_DATA.number);
            expect(booleanDecrypted).toBe(TEST_DATA.boolean);
        });

        it('should throw error for invalid tenant_id', async () => {
            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            await expect(decryptTenantData('invalid-id', encrypted)).rejects.toThrow();
        });

        it('should throw error for corrupted ciphertext', async () => {
            const corrupted: EncryptedData = {
                ciphertext: 'corrupted-data',
                algorithm: 'AES-GCM',
                version: 1,
            };

            await expect(decryptTenantData(TENANT_ID_1, corrupted)).rejects.toThrow();
        });

        it('should throw error for unsupported algorithm', async () => {
            const unsupported: EncryptedData = {
                ciphertext: 'some-data',
                algorithm: 'RSA',
                version: 1,
            };

            await expect(decryptTenantData(TENANT_ID_1, unsupported)).rejects.toThrow();
        });
    });

    describe('Tenant-Specific Keys', () => {
        it('should use different keys for different tenants', async () => {
            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const encrypted2 = await encryptTenantData(TENANT_ID_2, TEST_DATA.simple);

            expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

            await expect(decryptTenantData(TENANT_ID_2, encrypted1)).rejects.toThrow();
            await expect(decryptTenantData(TENANT_ID_1, encrypted2)).rejects.toThrow();
        });

        it('should decrypt correctly with matching tenant', async () => {
            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const encrypted2 = await encryptTenantData(TENANT_ID_2, TEST_DATA.simple);

            const decrypted1 = await decryptTenantData(TENANT_ID_1, encrypted1);
            const decrypted2 = await decryptTenantData(TENANT_ID_2, encrypted2);

            expect(decrypted1).toEqual(TEST_DATA.simple);
            expect(decrypted2).toEqual(TEST_DATA.simple);
        });
    });

    describe('Batch Operations', () => {
        it('should encrypt multiple items', async () => {
            const items = [TEST_DATA.simple, TEST_DATA.complex, TEST_DATA.array];
            const encrypted = await encryptTenantDataBatch(TENANT_ID_1, items);

            expect(encrypted).toHaveLength(3);
            encrypted.forEach(e => {
                expect(e.ciphertext).toBeDefined();
                expect(e.algorithm).toBe('AES-GCM');
            });
        });

        it('should decrypt multiple items', async () => {
            const items = [TEST_DATA.simple, TEST_DATA.complex, TEST_DATA.array];
            const encrypted = await encryptTenantDataBatch(TENANT_ID_1, items);
            const decrypted = await decryptTenantDataBatch(TENANT_ID_1, encrypted);

            expect(decrypted).toHaveLength(3);
            expect(decrypted[0]).toEqual(TEST_DATA.simple);
            expect(decrypted[1]).toEqual(TEST_DATA.complex);
            expect(decrypted[2]).toEqual(TEST_DATA.array);
        });

        it('should handle empty batch', async () => {
            const encrypted = await encryptTenantDataBatch(TENANT_ID_1, []);
            const decrypted = await decryptTenantDataBatch(TENANT_ID_1, encrypted);

            expect(encrypted).toHaveLength(0);
            expect(decrypted).toHaveLength(0);
        });
    });

    describe('Re-encryption', () => {
        it('should re-encrypt data with new tenant key', async () => {
            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const reencrypted = await reencryptTenantData(TENANT_ID_1, TENANT_ID_2, encrypted1);

            const decrypted = await decryptTenantData(TENANT_ID_2, reencrypted);
            expect(decrypted).toEqual(TEST_DATA.simple);

            await expect(decryptTenantData(TENANT_ID_1, reencrypted)).rejects.toThrow();
        });

        it('should preserve data integrity during re-encryption', async () => {
            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.complex);
            const reencrypted = await reencryptTenantData(TENANT_ID_1, TENANT_ID_2, encrypted1);
            const decrypted = await decryptTenantData(TENANT_ID_2, reencrypted);

            expect(decrypted).toEqual(TEST_DATA.complex);
        });
    });

    describe('Key Management', () => {
        it('should clear tenant encryption key', async () => {
            await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            clearTenantEncryptionKey(TENANT_ID_1);

            const encrypted = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            expect(encrypted.ciphertext).toBeDefined();
        });

        it('should clear all encryption keys', async () => {
            await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            await encryptTenantData(TENANT_ID_2, TEST_DATA.simple);

            clearAllEncryptionKeys();

            const encrypted1 = await encryptTenantData(TENANT_ID_1, TEST_DATA.simple);
            const encrypted2 = await encryptTenantData(TENANT_ID_2, TEST_DATA.simple);

            expect(encrypted1.ciphertext).toBeDefined();
            expect(encrypted2.ciphertext).toBeDefined();
        });
    });

    describe('Round-trip Encryption/Decryption', () => {
        it('should maintain data integrity through multiple cycles', async () => {
            let data = TEST_DATA.complex;

            for (let i = 0; i < 5; i++) {
                const encrypted = await encryptTenantData(TENANT_ID_1, data);
                data = await decryptTenantData(TENANT_ID_1, encrypted);
            }

            expect(data).toEqual(TEST_DATA.complex);
        });

        it('should handle large data objects', async () => {
            const largeData = {
                items: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    name: `Item ${i}`,
                    value: Math.random() * 1000,
                })),
            };

            const encrypted = await encryptTenantData(TENANT_ID_1, largeData);
            const decrypted = await decryptTenantData(TENANT_ID_1, encrypted);

            expect(decrypted.items).toHaveLength(1000);
        });
    });
});
