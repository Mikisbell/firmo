/**
 * Credential Encryption Unit Tests
 *
 * Tests AES-256-GCM encryption/decryption for SUNAT credentials
 * and PEM certificate/key validation.
 *
 * @module core/integrations/sunat/__tests__/credential-encryption.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Setup: Mock env for encryption key
// ============================================================================

// Valid 256-bit key (64 hex chars)
const TEST_KEY =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const WRONG_KEY =
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

describe('credential-encryption', () => {
  let encryptCredential: typeof import('../credential-encryption').encryptCredential;
  let decryptCredential: typeof import('../credential-encryption').decryptCredential;
  let isEncrypted: typeof import('../credential-encryption').isEncrypted;
  let validateCertificatePem: typeof import('../credential-encryption').validateCertificatePem;
  let validatePrivateKeyPem: typeof import('../credential-encryption').validatePrivateKeyPem;

  beforeEach(async () => {
    vi.resetModules();
    process.env.SUNAT_ENCRYPTION_KEY = TEST_KEY;

    const mod = await import('../credential-encryption');
    encryptCredential = mod.encryptCredential;
    decryptCredential = mod.decryptCredential;
    isEncrypted = mod.isEncrypted;
    validateCertificatePem = mod.validateCertificatePem;
    validatePrivateKeyPem = mod.validatePrivateKeyPem;
  });

  afterEach(() => {
    delete process.env.SUNAT_ENCRYPTION_KEY;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Encrypt / Decrypt Roundtrip
  // ==========================================================================

  describe('encrypt/decrypt roundtrip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'MODDATOS';
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const encrypted = encryptCredential('');
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe('');
    });

    it('should encrypt and decrypt unicode content', () => {
      const plaintext = 'contraseña-con-ñ-y-émojis-🔑';
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt a long PEM-like string', () => {
      const fakePem = `-----BEGIN CERTIFICATE-----
${'MIIBkTCB+wIJAJyr6GV5eZ9YMA0GCSqGSIb3DQEBCwUA'.repeat(20)}
-----END CERTIFICATE-----`;
      const encrypted = encryptCredential(fakePem);
      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(fakePem);
    });

    it('should produce encrypted values starting with "enc:" prefix', () => {
      const encrypted = encryptCredential('test');
      expect(encrypted.startsWith('enc:')).toBe(true);
    });
  });

  // ==========================================================================
  // IV Randomness — Different encryptions produce different ciphertexts
  // ==========================================================================

  describe('IV randomness', () => {
    it('should produce different ciphertexts for the same plaintext', () => {
      const plaintext = 'MODDATOS';
      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
      // But both should decrypt to the same value
      expect(decryptCredential(encrypted1)).toBe(plaintext);
      expect(decryptCredential(encrypted2)).toBe(plaintext);
    });
  });

  // ==========================================================================
  // Decryption with wrong key fails
  // ==========================================================================

  describe('wrong key decryption', () => {
    it('should fail to decrypt with a different key', async () => {
      const encrypted = encryptCredential('secret-password');

      // Reset modules and use a different key
      vi.resetModules();
      process.env.SUNAT_ENCRYPTION_KEY = WRONG_KEY;
      const mod2 = await import('../credential-encryption');

      expect(() => mod2.decryptCredential(encrypted)).toThrow();
    });
  });

  // ==========================================================================
  // Invalid input handling
  // ==========================================================================

  describe('invalid input handling', () => {
    it('should throw on missing enc: prefix', () => {
      expect(() => decryptCredential('not-encrypted')).toThrow(
        'missing enc: prefix',
      );
    });

    it('should throw on malformed base64', () => {
      expect(() => decryptCredential('enc:!!!not-base64!!!')).toThrow();
    });

    it('should throw on payload too short', () => {
      // Valid base64 but too short
      expect(() => decryptCredential('enc:AQID')).toThrow(
        'payload too short',
      );
    });

    it('should throw when SUNAT_ENCRYPTION_KEY is not set', async () => {
      vi.resetModules();
      delete process.env.SUNAT_ENCRYPTION_KEY;
      const mod = await import('../credential-encryption');

      expect(() => mod.encryptCredential('test')).toThrow(
        'SUNAT_ENCRYPTION_KEY not configured',
      );
    });

    it('should throw when SUNAT_ENCRYPTION_KEY has invalid length', async () => {
      vi.resetModules();
      process.env.SUNAT_ENCRYPTION_KEY = 'abcdef'; // Too short
      const mod = await import('../credential-encryption');

      expect(() => mod.encryptCredential('test')).toThrow(
        '64 hex characters',
      );
    });

    it('should throw when SUNAT_ENCRYPTION_KEY has invalid chars', async () => {
      vi.resetModules();
      // 64 chars but contains non-hex
      process.env.SUNAT_ENCRYPTION_KEY = 'g'.repeat(64);
      const mod = await import('../credential-encryption');

      expect(() => mod.encryptCredential('test')).toThrow(
        '64 hex characters',
      );
    });
  });

  // ==========================================================================
  // isEncrypted detection
  // ==========================================================================

  describe('isEncrypted', () => {
    it('should recognize encrypted strings', () => {
      const encrypted = encryptCredential('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should reject plaintext strings', () => {
      expect(isEncrypted('plain-text-password')).toBe(false);
    });

    it('should reject strings with enc: prefix but payload too short', () => {
      // base64 of a 5-byte buffer (too short for IV + authTag = 28 bytes)
      expect(isEncrypted('enc:AQIDBAU=')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isEncrypted('')).toBe(false);
    });
  });

  // ==========================================================================
  // Certificate PEM Validation
  // ==========================================================================

  describe('validateCertificatePem', () => {
    // Self-signed test certificate (generated with openssl, valid 10 years)
    const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUIj3YQAbPdo3jSJ7xca54wXZ6t5EwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJVGVzdFNVTkFUMB4XDTI2MDMwMzE2MzA1MloXDTM2MDIy
OTE2MzA1MlowFDESMBAGA1UEAwwJVGVzdFNVTkFUMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAv4JFrBoX0fYy3o+I3oSxwSoLHSliO7Z3mghYbAV/kWC8
Wlvxjgz2+LukYts3bhRICEj1aca5miThxy4LL2J7O894n7SBS9tIRwNpUfqxGgsB
07ALnjt/FBu9Wq/x4SEkjz+1x7cQ0DX6p8nIl8JRxbvUkL7iAo3bcP61XDD5ZLHg
UQMPQVTv6aAjI+ZmR4yHfc1DzuXqXmID7/78VTBA64xT0coiGhJy4n2X2e931vfX
5uh80euSbpQieSIxPwBuYag1dM2sDcEUa7wXqkiIJhSR39WERZcxDgZLzNi9GnTV
b/sfj7tYrdQesa2El/Ls7cc5cujPuIStdZyEzy3uJQIDAQABo1MwUTAdBgNVHQ4E
FgQUUcdN+50404yUO9qVYcuGTuGDAjcwHwYDVR0jBBgwFoAUUcdN+50404yUO9qV
YcuGTuGDAjcwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEARpWk
x40F9dxrfyj817a17LZV6sgaUxg2qMWKZbiYmPloqAJETsCl3zUY8rBRZltuz7ST
I+WolINGV7ACt/EhueOP+sDTuxoQpb5HrQYGAwap/9/kKueHRbpbH+rs/iFRU2kL
y0T5WpNU9sArIuWe+kApcL6LQ+wDdAma6a5pxo5kdjrcBxx3Pv9sy0LKWtH9xcfm
CciVEItPBVJHsUJxynVOJ9IiGUF8+3X6M5BTlOOKC5Bu3ZFXatLikC0AGSPLscK3
fgvly6sdFR0cB2hviaqUNtZ9sIaEPW+BENRYmH+HSfQYKXAqLrRvAXE1yzOgVpnn
nzxAzXzV5fciwdsNFw==
-----END CERTIFICATE-----`;

    it('should accept a valid PEM certificate', () => {
      const result = validateCertificatePem(VALID_CERT);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresAt).toBeInstanceOf(Date);
        expect(typeof result.data.subject).toBe('string');
        expect(typeof result.data.issuer).toBe('string');
      }
    });

    it('should reject a string without PEM header', () => {
      const result = validateCertificatePem('not-a-certificate');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_CERT_INVALID_FORMAT');
      }
    });

    it('should reject a PEM that is too large', () => {
      const largePem =
        '-----BEGIN CERTIFICATE-----\n' + 'A'.repeat(11000) + '\n-----END CERTIFICATE-----';
      const result = validateCertificatePem(largePem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_CERT_TOO_LARGE');
      }
    });

    it('should reject a malformed PEM (valid header but invalid content)', () => {
      const badPem =
        '-----BEGIN CERTIFICATE-----\nNOT-VALID-BASE64-DATA\n-----END CERTIFICATE-----';
      const result = validateCertificatePem(badPem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_CERT_PARSE_ERROR');
      }
    });
  });

  // ==========================================================================
  // Private Key PEM Validation
  // ==========================================================================

  describe('validatePrivateKeyPem', () => {
    it('should accept PKCS#8 format key', () => {
      const pem = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7o4qne60TB3pO
-----END PRIVATE KEY-----`;
      const result = validatePrivateKeyPem(pem);
      expect(result.success).toBe(true);
    });

    it('should accept PKCS#1 (RSA) format key', () => {
      const pem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAu6OKp3utEwd6TmGgcuWDdSTnM5fdYxyzKwBx4HykjFThX5mB
-----END RSA PRIVATE KEY-----`;
      const result = validatePrivateKeyPem(pem);
      expect(result.success).toBe(true);
    });

    it('should reject a string without PEM header', () => {
      const result = validatePrivateKeyPem('not-a-key');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_KEY_INVALID_FORMAT');
      }
    });

    it('should reject a string with header but no footer', () => {
      const result = validatePrivateKeyPem(
        '-----BEGIN PRIVATE KEY-----\ndata\n',
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_KEY_INVALID_FORMAT');
      }
    });

    it('should reject a PEM that is too large', () => {
      const largePem =
        '-----BEGIN PRIVATE KEY-----\n' +
        'A'.repeat(11000) +
        '\n-----END PRIVATE KEY-----';
      const result = validatePrivateKeyPem(largePem);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_KEY_TOO_LARGE');
      }
    });
  });

  // ==========================================================================
  // Property Tests — fast-check
  // ==========================================================================

  describe('property tests', () => {
    it('decrypt(encrypt(s)) === s for all strings (numRuns=100)', () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          const encrypted = encryptCredential(s);
          const decrypted = decryptCredential(encrypted);
          expect(decrypted).toBe(s);
        }),
        { numRuns: 100 },
      );
    });

    it('encrypted values are always recognized by isEncrypted (numRuns=100)', () => {
      fc.assert(
        fc.property(fc.string(), (s) => {
          const encrypted = encryptCredential(s);
          expect(isEncrypted(encrypted)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('plaintext strings are never recognized as encrypted (numRuns=100)', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.startsWith('enc:')),
          (s) => {
            expect(isEncrypted(s)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
