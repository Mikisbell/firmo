/**
 * SUNAT Credential Encryption Module
 *
 * Provides AES-256-GCM encryption/decryption for sensitive SUNAT credentials
 * (SOL password, certificates, private keys, Nubefact tokens).
 *
 * Security:
 * - Master key from SUNAT_ENCRYPTION_KEY env var (64 hex chars = 32 bytes)
 * - IV: 12 bytes random per encryption (unique ciphertext per call)
 * - Auth tag: 16 bytes for tamper detection
 * - Output: base64(iv || ciphertext || authTag)
 * - NEVER logs plaintext credentials
 *
 * @module core/integrations/sunat/credential-encryption
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  X509Certificate,
} from 'crypto';
import { Result, ok, err, DomainError } from '@/src/core/result';

// ============================================================================
// Constants
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const ENCRYPTED_PREFIX = 'enc:'; // Prefix to identify encrypted values
const MAX_PEM_SIZE = 10 * 1024; // 10KB max PEM size

// ============================================================================
// Key Management
// ============================================================================

/**
 * Get the master encryption key from environment.
 * @throws {Error} if SUNAT_ENCRYPTION_KEY is not set or invalid
 */
function getMasterKey(): Buffer {
  const hexKey = process.env.SUNAT_ENCRYPTION_KEY;

  if (!hexKey) {
    throw new Error(
      'SUNAT_ENCRYPTION_KEY not configured. Set a 64 hex char (256 bit) key.',
    );
  }

  if (hexKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(hexKey)) {
    throw new Error(
      'SUNAT_ENCRYPTION_KEY must be exactly 64 hex characters (256 bits).',
    );
  }

  return Buffer.from(hexKey, 'hex');
}

// ============================================================================
// Encryption / Decryption
// ============================================================================

/**
 * Encrypt a plaintext credential string using AES-256-GCM.
 *
 * Output format: "enc:" + base64(iv[12] || ciphertext || authTag[16])
 *
 * @param plaintext - The credential to encrypt (NEVER logged)
 * @returns Encrypted string prefixed with "enc:"
 */
export function encryptCredential(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // iv || ciphertext || authTag
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return ENCRYPTED_PREFIX + combined.toString('base64');
}

/**
 * Decrypt an encrypted credential string.
 *
 * Input format: "enc:" + base64(iv[12] || ciphertext || authTag[16])
 *
 * @param encrypted - The encrypted string (must start with "enc:")
 * @returns Decrypted plaintext string
 * @throws {Error} if decryption fails (wrong key, tampered data, invalid format)
 */
export function decryptCredential(encrypted: string): string {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Invalid encrypted value: missing enc: prefix');
  }

  const key = getMasterKey();
  const payload = encrypted.slice(ENCRYPTED_PREFIX.length);

  let combined: Buffer;
  try {
    combined = Buffer.from(payload, 'base64');
  } catch {
    throw new Error('Invalid encrypted value: malformed base64');
  }

  // Minimum length: IV (12) + authTag (16) = 28 (ciphertext can be 0 bytes for empty string)
  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted value: payload too short');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(
    IV_LENGTH,
    combined.length - AUTH_TAG_LENGTH,
  );

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check whether a value is already encrypted (has the "enc:" prefix).
 */
export function isEncrypted(value: string): boolean {
  if (!value.startsWith(ENCRYPTED_PREFIX)) {
    return false;
  }

  // Additional validation: the payload after "enc:" should be valid base64
  const payload = value.slice(ENCRYPTED_PREFIX.length);
  try {
    const decoded = Buffer.from(payload, 'base64');
    // Must have at least iv + authTag (ciphertext can be 0 bytes for empty string)
    return decoded.length >= IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// ============================================================================
// Certificate & Key Validation
// ============================================================================

/**
 * Validate a PEM-encoded X.509 certificate.
 *
 * Checks:
 * - PEM format (BEGIN/END CERTIFICATE headers)
 * - Size limit (10KB max)
 * - Parseable by Node.js crypto
 * - Extracts: expiration date, subject, issuer
 *
 * @param pem - The certificate PEM string
 * @returns Result with certificate info or DomainError
 */
export function validateCertificatePem(
  pem: string,
): Result<{ expiresAt: Date; subject: string; issuer: string }, DomainError> {
  // Size check
  if (pem.length > MAX_PEM_SIZE) {
    return err(
      new DomainError(
        'El certificado excede el tamaño máximo de 10KB',
        'SUNAT_CERT_TOO_LARGE',
        { size: pem.length, maxSize: MAX_PEM_SIZE },
      ),
    );
  }

  // PEM header check
  const trimmed = pem.trim();
  if (!trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return err(
      new DomainError(
        'Formato de certificado inválido: falta encabezado PEM',
        'SUNAT_CERT_INVALID_FORMAT',
      ),
    );
  }

  try {
    const cert = new X509Certificate(trimmed);

    const expiresAt = new Date(cert.validTo);
    const subject = cert.subject;
    const issuer = cert.issuer;

    return ok({
      expiresAt,
      subject,
      issuer,
    });
  } catch (error) {
    return err(
      new DomainError(
        'No se pudo parsear el certificado digital. Verifique que es un X.509 PEM válido.',
        'SUNAT_CERT_PARSE_ERROR',
        {
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      ),
    );
  }
}

/**
 * Validate a PEM-encoded private key.
 *
 * Checks:
 * - PEM format (BEGIN RSA PRIVATE KEY or BEGIN PRIVATE KEY headers)
 * - Size limit (10KB max)
 *
 * @param pem - The private key PEM string
 * @returns Result<void, DomainError>
 */
export function validatePrivateKeyPem(
  pem: string,
): Result<void, DomainError> {
  // Size check
  if (pem.length > MAX_PEM_SIZE) {
    return err(
      new DomainError(
        'La clave privada excede el tamaño máximo de 10KB',
        'SUNAT_KEY_TOO_LARGE',
        { size: pem.length, maxSize: MAX_PEM_SIZE },
      ),
    );
  }

  const trimmed = pem.trim();

  // Accept both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) formats
  const hasValidHeader =
    trimmed.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    trimmed.includes('-----BEGIN PRIVATE KEY-----');

  if (!hasValidHeader) {
    return err(
      new DomainError(
        'Formato de clave privada inválido: falta encabezado PEM (RSA PRIVATE KEY o PRIVATE KEY)',
        'SUNAT_KEY_INVALID_FORMAT',
      ),
    );
  }

  const hasValidFooter =
    trimmed.includes('-----END RSA PRIVATE KEY-----') ||
    trimmed.includes('-----END PRIVATE KEY-----');

  if (!hasValidFooter) {
    return err(
      new DomainError(
        'Formato de clave privada inválido: falta pie de PEM',
        'SUNAT_KEY_INVALID_FORMAT',
      ),
    );
  }

  return ok(undefined);
}
