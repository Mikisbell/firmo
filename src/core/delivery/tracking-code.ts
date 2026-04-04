/**
 * Tracking Code Generator
 * Generates short, unique tracking codes for customer-facing delivery tracking.
 * Format: PARK-XXXXXX (6 uppercase alphanumeric characters)
 */

import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion
const CODE_LENGTH = 6;
const PREFIX = 'PARK';

/**
 * Generate a random tracking code like PARK-A3F7K2
 * Uses crypto.randomBytes for unbiased randomness.
 */
export function generateTrackingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${PREFIX}-${code}`;
}
