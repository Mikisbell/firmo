/**
 * Crypto utilities
 * 
 * This module uses Node.js crypto which is only available on the server.
 * Import this only in server-side code (API routes, server actions, etc.)
 * 
 * @module crypto-utils
 */

import { createHash, randomBytes } from 'crypto';

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

/**
 * Hash a PIN using SHA256 + salt
 */
export function hashPin(pin: string): string {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

/**
 * Verify a PIN against a hash
 */
export function verifyPin(pin: string, hash: string): boolean {
  return hashPin(pin) === hash;
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a token hash (for session tokens)
 */
export function generateTokenHash(): string {
  return createHash('sha256').update(generateToken(32)).digest('hex');
}
