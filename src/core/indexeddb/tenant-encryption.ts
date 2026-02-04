/**
 * Tenant Data Encryption for IndexedDB
 * 
 * Task 18.7 - IndexedDB Tenant Isolation
 * 
 * Implements encryption for sensitive tenant data stored in IndexedDB.
 * Each tenant gets a unique encryption key derived from their tenant_id.
 * 
 * This ensures:
 * - Sensitive data is encrypted at rest in IndexedDB
 * - Encryption keys are tenant-specific
 * - Data cannot be read without the correct tenant context
 * - Compliance with data protection requirements
 * 
 * Encryption Details:
 * - Algorithm: AES-GCM (256-bit)
 * - Key Derivation: PBKDF2 with SHA-256
 * - IV: 12 bytes (96 bits) random per encryption
 * - Iterations: 100,000 (NIST recommendation)
 * - Encoding: Base64 for storage
 * 
 * Requirements: 15.5 - THE System SHALL encrypt sensitive tenant data in IndexedDB
 */

import { logger } from '@/src/core/observability/logger';
import { validateTenantId } from './tenant-validation';

// ============================================================================
// Types
// ============================================================================

export interface EncryptedData {
    ciphertext: string; // Base64-encoded IV + encrypted data
    algorithm: string; // 'AES-GCM'
    version: number; // Encryption format version
}

// ============================================================================
// Encryption Key Management
// ============================================================================

// Cache for derived encryption keys (per tenant)
const encryptionKeyCache = new Map<string, CryptoKey>();

/**
 * Gets or derives a tenant-specific encryption key
 * 
 * This function:
 * 1. Checks if key is cached for the tenant
 * 2. If not cached, derives key from tenant_id using PBKDF2
 * 3. Caches the key for reuse
 * 4. Returns the CryptoKey for encryption/decryption
 * 
 * Key Derivation:
 * - Input: tenant_id (UUID)
 * - Salt: 'parkpos-tenant-salt' (fixed, allows key recovery)
 * - Iterations: 100,000 (NIST recommendation for 2024)
 * - Hash: SHA-256
 * - Output: 256-bit AES key
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with CryptoKey for encryption/decryption
 * @throws Error if tenant_id is invalid or key derivation fails
 */
async function getTenantEncryptionKey(tenant_id: string): Promise<CryptoKey> {
    // Validate tenant_id
    validateTenantId(tenant_id);

    // Check cache first
    if (encryptionKeyCache.has(tenant_id)) {
        return encryptionKeyCache.get(tenant_id)!;
    }

    try {
        // Import tenant_id as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(tenant_id),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        // Derive AES-GCM key using PBKDF2
        const key = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode('parkpos-tenant-salt'),
                iterations: 100000, // NIST recommendation
                hash: 'SHA-256',
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false, // Not extractable
            ['encrypt', 'decrypt']
        );

        // Cache the key
        encryptionKeyCache.set(tenant_id, key);

        logger.info('TENANT_ENCRYPTION_KEY_DERIVED', `Derived encryption key for tenant: ${tenant_id}`, {
            tenant_id,
        });

        return key;
    } catch (error) {
        logger.error(
            'TENANT_ENCRYPTION_KEY_DERIVATION_FAILED',
            `Failed to derive encryption key for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Clears the encryption key cache for a tenant
 * 
 * Call this when a tenant is deactivated or deleted to ensure
 * the key cannot be reused.
 * 
 * @param tenant_id - UUID of the tenant
 */
export function clearTenantEncryptionKey(tenant_id: string): void {
    try {
        validateTenantId(tenant_id);
        encryptionKeyCache.delete(tenant_id);
        logger.info('TENANT_ENCRYPTION_KEY_CLEARED', `Cleared encryption key cache for tenant: ${tenant_id}`, {
            tenant_id,
        });
    } catch (error) {
        logger.error(
            'TENANT_ENCRYPTION_KEY_CLEAR_FAILED',
            `Failed to clear encryption key for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
    }
}

/**
 * Clears all encryption keys from cache
 * 
 * Use with caution - typically only during logout or app shutdown.
 */
export function clearAllEncryptionKeys(): void {
    encryptionKeyCache.clear();
    logger.info('ALL_ENCRYPTION_KEYS_CLEARED', 'Cleared all encryption keys from cache', {});
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypts tenant data for storage in IndexedDB
 * 
 * This function:
 * 1. Gets the tenant-specific encryption key
 * 2. Generates a random 12-byte IV
 * 3. Encrypts data using AES-GCM
 * 4. Combines IV and ciphertext
 * 5. Encodes as Base64
 * 6. Returns encrypted data object
 * 
 * The IV is included in the output so decryption doesn't need it separately.
 * 
 * @param tenant_id - UUID of the tenant
 * @param data - Data to encrypt (will be JSON stringified)
 * @returns Promise with encrypted data object
 * @throws Error if tenant_id is invalid or encryption fails
 */
export async function encryptTenantData(tenant_id: string, data: any): Promise<EncryptedData> {
    if (typeof window === 'undefined' || typeof crypto === 'undefined') {
        throw new Error('Encryption can only be performed in browser environment with Web Crypto API');
    }

    try {
        // Validate tenant_id
        validateTenantId(tenant_id);

        // Get tenant-specific encryption key
        const key = await getTenantEncryptionKey(tenant_id);

        // Serialize data to JSON
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));

        // Generate random IV (12 bytes for GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt data using AES-GCM
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            dataBuffer
        );

        // Combine IV and encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        // Encode as Base64
        const ciphertext = btoa(String.fromCharCode(...combined));

        logger.info('TENANT_DATA_ENCRYPTED', `Encrypted data for tenant: ${tenant_id}`, {
            tenant_id,
            data_size: dataBuffer.byteLength,
            encrypted_size: combined.byteLength,
        });

        return {
            ciphertext,
            algorithm: 'AES-GCM',
            version: 1,
        };
    } catch (error) {
        logger.error(
            'TENANT_DATA_ENCRYPTION_FAILED',
            `Failed to encrypt data for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Decrypts tenant data from IndexedDB
 * 
 * This function:
 * 1. Gets the tenant-specific encryption key
 * 2. Decodes Base64 ciphertext
 * 3. Extracts IV and encrypted data
 * 4. Decrypts using AES-GCM
 * 5. Parses JSON and returns data
 * 
 * @param tenant_id - UUID of the tenant
 * @param encrypted - Encrypted data object
 * @returns Promise with decrypted data
 * @throws Error if tenant_id is invalid, decryption fails, or data is corrupted
 */
export async function decryptTenantData(tenant_id: string, encrypted: EncryptedData): Promise<any> {
    if (typeof window === 'undefined' || typeof crypto === 'undefined') {
        throw new Error('Decryption can only be performed in browser environment with Web Crypto API');
    }

    try {
        // Validate tenant_id
        validateTenantId(tenant_id);

        // Validate encrypted data format
        if (!encrypted.ciphertext || typeof encrypted.ciphertext !== 'string') {
            throw new Error('Invalid encrypted data: missing or invalid ciphertext');
        }

        if (encrypted.algorithm !== 'AES-GCM') {
            throw new Error(`Unsupported encryption algorithm: ${encrypted.algorithm}`);
        }

        // Get tenant-specific encryption key
        const key = await getTenantEncryptionKey(tenant_id);

        // Decode Base64
        const combined = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));

        // Extract IV (first 12 bytes) and encrypted data (rest)
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        // Decrypt using AES-GCM
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        // Decode and parse JSON
        const decoder = new TextDecoder();
        const result = JSON.parse(decoder.decode(decrypted));

        logger.info('TENANT_DATA_DECRYPTED', `Decrypted data for tenant: ${tenant_id}`, {
            tenant_id,
            encrypted_size: combined.byteLength,
            decrypted_size: decrypted.byteLength,
        });

        return result;
    } catch (error) {
        logger.error(
            'TENANT_DATA_DECRYPTION_FAILED',
            `Failed to decrypt data for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
            }
        );
        throw error;
    }
}

/**
 * Encrypts multiple data items for a tenant
 * 
 * Useful for batch encryption of multiple objects.
 * 
 * @param tenant_id - UUID of the tenant
 * @param items - Array of data items to encrypt
 * @returns Promise with array of encrypted data objects
 */
export async function encryptTenantDataBatch(
    tenant_id: string,
    items: any[]
): Promise<EncryptedData[]> {
    try {
        validateTenantId(tenant_id);

        const encrypted = await Promise.all(
            items.map(item => encryptTenantData(tenant_id, item))
        );

        logger.info('TENANT_DATA_BATCH_ENCRYPTED', `Encrypted ${items.length} items for tenant: ${tenant_id}`, {
            tenant_id,
            count: items.length,
        });

        return encrypted;
    } catch (error) {
        logger.error(
            'TENANT_DATA_BATCH_ENCRYPTION_FAILED',
            `Failed to encrypt batch for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
                count: items.length,
            }
        );
        throw error;
    }
}

/**
 * Decrypts multiple data items for a tenant
 * 
 * Useful for batch decryption of multiple objects.
 * 
 * @param tenant_id - UUID of the tenant
 * @param encrypted - Array of encrypted data objects
 * @returns Promise with array of decrypted data
 */
export async function decryptTenantDataBatch(
    tenant_id: string,
    encrypted: EncryptedData[]
): Promise<any[]> {
    try {
        validateTenantId(tenant_id);

        const decrypted = await Promise.all(
            encrypted.map(item => decryptTenantData(tenant_id, item))
        );

        logger.info('TENANT_DATA_BATCH_DECRYPTED', `Decrypted ${encrypted.length} items for tenant: ${tenant_id}`, {
            tenant_id,
            count: encrypted.length,
        });

        return decrypted;
    } catch (error) {
        logger.error(
            'TENANT_DATA_BATCH_DECRYPTION_FAILED',
            `Failed to decrypt batch for tenant: ${tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                tenant_id,
                count: encrypted.length,
            }
        );
        throw error;
    }
}

/**
 * Re-encrypts data with a new tenant context
 * 
 * Useful when migrating data between tenants or re-keying.
 * 
 * @param old_tenant_id - UUID of the original tenant
 * @param new_tenant_id - UUID of the new tenant
 * @param encrypted - Encrypted data with old tenant key
 * @returns Promise with encrypted data using new tenant key
 */
export async function reencryptTenantData(
    old_tenant_id: string,
    new_tenant_id: string,
    encrypted: EncryptedData
): Promise<EncryptedData> {
    try {
        validateTenantId(old_tenant_id);
        validateTenantId(new_tenant_id);

        // Decrypt with old key
        const data = await decryptTenantData(old_tenant_id, encrypted);

        // Encrypt with new key
        const reencrypted = await encryptTenantData(new_tenant_id, data);

        logger.info('TENANT_DATA_REENCRYPTED', `Re-encrypted data from tenant ${old_tenant_id} to ${new_tenant_id}`, {
            old_tenant_id,
            new_tenant_id,
        });

        return reencrypted;
    } catch (error) {
        logger.error(
            'TENANT_DATA_REENCRYPTION_FAILED',
            `Failed to re-encrypt data from ${old_tenant_id} to ${new_tenant_id}`,
            error instanceof Error ? error : undefined,
            {
                old_tenant_id,
                new_tenant_id,
            }
        );
        throw error;
    }
}
