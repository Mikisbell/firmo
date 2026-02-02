'use server';

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
export async function hashPin(pin: string): Promise<string> {
  return createHash('sha256').update(SALT + pin).digest('hex');
}

/**
 * Verify a PIN against a hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  return computed === hash;
}

/**
 * Generate a random token
 */
export async function generateToken(length: number = 32): Promise<string> {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a token hash (for session tokens)
 */
export async function generateTokenHash(): Promise<string> {
  const token = await generateToken(32);
  return createHash('sha256').update(token).digest('hex');
}
