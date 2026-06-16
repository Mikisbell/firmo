'use server';

/**
 * Crypto utilities
 * 
 * This module uses WebCrypto API which is natively supported in Edge (Cloudflare Workers).
 * 
 * @module crypto-utils
 */

const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';

/**
 * Hash a PIN using SHA256 + salt via WebCrypto
 */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, length);
}

/**
 * Generate a token hash (for session tokens)
 */
export async function generateTokenHash(): Promise<string> {
  const token = await generateToken(32);
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
