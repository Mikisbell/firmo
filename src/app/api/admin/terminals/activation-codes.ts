/**
 * Terminal Activation Code Service
 * Manages activation codes for terminal registration
 * 
 * Requirements: 5.2
 */

import { randomBytes } from 'crypto';

// Store codes in memory (in production, use Redis or database)
const activationCodes = new Map<string, { tenantId: string; expiresAt: Date }>();

// Generate 12-character alphanumeric code
export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  const bytes = randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function createActivationCode(tenantId: string): { code: string; expiresAt: Date } {
  // Generate unique code
  let code: string;
  do {
    code = generateCode();
  } while (activationCodes.has(code));
  
  // Set expiration to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  // Store code
  activationCodes.set(code, { tenantId, expiresAt });
  
  // Clean up expired codes
  cleanupExpiredCodes();
  
  return { code, expiresAt };
}

export function cleanupExpiredCodes(): void {
  const now = new Date();
  for (const [key, value] of activationCodes.entries()) {
    if (value.expiresAt < now) {
      activationCodes.delete(key);
    }
  }
}

export function validateActivationCode(code: string): { valid: boolean; tenantId?: string } {
  const entry = activationCodes.get(code);
  if (!entry) return { valid: false };
  if (entry.expiresAt < new Date()) {
    activationCodes.delete(code);
    return { valid: false };
  }
  return { valid: true, tenantId: entry.tenantId };
}

export function consumeActivationCode(code: string): boolean {
  const entry = activationCodes.get(code);
  if (!entry || entry.expiresAt < new Date()) return false;
  activationCodes.delete(code);
  return true;
}
