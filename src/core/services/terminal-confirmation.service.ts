/**
 * Terminal Confirmation Service
 *
 * Handles device confirmation codes with rate limiting.
 * When a device is unknown, a 6-digit code is generated
 * and must be verified within a time window.
 * After 3 failed attempts, the device is locked out for 5 minutes.
 *
 * @module core/services/terminal-confirmation.service
 */

import { randomBytes } from 'crypto';
import type { Result } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmationCode {
  code: string;
  terminalId: string;
  tenantId: string;
  employeeId: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
}

export interface VerifyResult {
  verified: boolean;
  attemptsRemaining: number;
  lockedUntil?: Date;
}

interface StoredCode {
  codeHash: string;
  terminalId: string;
  tenantId: string;
  employeeId: string;
  expiresAt: number;
  attempts: number;
  lockedUntil: number | null;
  createdAt: number;
}

// ============================================================================
// Constants
// ============================================================================

const CODE_LENGTH = 6;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// Service
// ============================================================================

export class TerminalConfirmationService {
  // In-memory store (would be Redis in production)
  private codes: Map<string, StoredCode> = new Map();

  /**
   * Generate a 6-digit confirmation code for a device.
   */
  generateCode(
    tenantId: string,
    terminalId: string,
    employeeId: string,
  ): Result<ConfirmationCode, { message: string }> {
    const key = this.makeKey(tenantId, terminalId, employeeId);

    // Check for existing lockout
    const existing = this.codes.get(key);
    if (existing?.lockedUntil && Date.now() < existing.lockedUntil) {
      return {
        success: false,
        error: {
          message: `Dispositivo bloqueado hasta ${new Date(existing.lockedUntil).toLocaleTimeString()}`,
        },
      };
    }

    const code = this.createSecureCode();
    const now = Date.now();

    const stored: StoredCode = {
      codeHash: this.hashCode(code),
      terminalId,
      tenantId,
      employeeId,
      expiresAt: now + CODE_EXPIRY_MS,
      attempts: 0,
      lockedUntil: null,
      createdAt: now,
    };

    this.codes.set(key, stored);

    return {
      success: true,
      data: {
        code,
        terminalId,
        tenantId,
        employeeId,
        expiresAt: new Date(stored.expiresAt),
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        lockedUntil: null,
        createdAt: new Date(stored.createdAt),
      },
    };
  }

  /**
   * Verify a confirmation code.
   * Returns verified status, remaining attempts, and lockout time if locked.
   */
  verifyCode(
    tenantId: string,
    terminalId: string,
    employeeId: string,
    code: string,
  ): Result<VerifyResult, { message: string }> {
    const key = this.makeKey(tenantId, terminalId, employeeId);
    const stored = this.codes.get(key);

    if (!stored) {
      return {
        success: false,
        error: { message: 'No hay código de confirmación pendiente' },
      };
    }

    // Check lockout
    if (stored.lockedUntil && Date.now() < stored.lockedUntil) {
      return {
        success: true,
        data: {
          verified: false,
          attemptsRemaining: 0,
          lockedUntil: new Date(stored.lockedUntil),
        },
      };
    }

    // Reset lockout if it has passed
    if (stored.lockedUntil && Date.now() >= stored.lockedUntil) {
      stored.attempts = 0;
      stored.lockedUntil = null;
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
      this.codes.delete(key);
      return {
        success: false,
        error: { message: 'Código de confirmación expirado' },
      };
    }

    // Verify code
    const codeHash = this.hashCode(code);
    if (codeHash === stored.codeHash) {
      // Success — remove code
      this.codes.delete(key);
      return {
        success: true,
        data: { verified: true, attemptsRemaining: MAX_ATTEMPTS },
      };
    }

    // Wrong code — increment attempts
    stored.attempts += 1;
    const remaining = MAX_ATTEMPTS - stored.attempts;

    if (stored.attempts >= MAX_ATTEMPTS) {
      stored.lockedUntil = Date.now() + LOCKOUT_MS;
      return {
        success: true,
        data: {
          verified: false,
          attemptsRemaining: 0,
          lockedUntil: new Date(stored.lockedUntil),
        },
      };
    }

    return {
      success: true,
      data: { verified: false, attemptsRemaining: remaining },
    };
  }

  /**
   * Check if a device is currently locked out.
   */
  isLockedOut(
    tenantId: string,
    terminalId: string,
    employeeId: string,
  ): boolean {
    const key = this.makeKey(tenantId, terminalId, employeeId);
    const stored = this.codes.get(key);
    if (!stored?.lockedUntil) return false;
    return Date.now() < stored.lockedUntil;
  }

  /**
   * Clear all codes (for testing).
   */
  clear(): void {
    this.codes.clear();
  }

  // ============================================================================
  // Private
  // ============================================================================

  private makeKey(tenantId: string, terminalId: string, employeeId: string): string {
    return `${tenantId}:${terminalId}:${employeeId}`;
  }

  private createSecureCode(): string {
    const bytes = randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1000000;
    return num.toString().padStart(CODE_LENGTH, '0');
  }

  private hashCode(code: string): string {
    // Simple hash for in-memory comparison (not bcrypt since this is ephemeral)
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
