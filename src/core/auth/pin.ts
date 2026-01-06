// src/core/auth/pin.ts
// PIN hashing and verification

const SALT = 'PARK_POS_2026_'; // In production, use per-user salt from DB

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
}

// Rate limiting for PIN attempts
const PIN_ATTEMPTS_KEY = 'park_pin_attempts';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 5;

interface PinAttempts {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export function getPinAttempts(): PinAttempts {
  if (typeof window === 'undefined') return { count: 0, lastAttempt: 0 };
  const data = localStorage.getItem(PIN_ATTEMPTS_KEY);
  if (!data) return { count: 0, lastAttempt: 0 };
  try {
    return JSON.parse(data);
  } catch {
    return { count: 0, lastAttempt: 0 };
  }
}

export function recordPinAttempt(success: boolean): { locked: boolean; remainingAttempts: number; lockoutMinutes?: number } {
  const attempts = getPinAttempts();
  const now = Date.now();
  
  // Check if currently locked
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    const remainingMs = attempts.lockedUntil - now;
    return { 
      locked: true, 
      remainingAttempts: 0, 
      lockoutMinutes: Math.ceil(remainingMs / 60000) 
    };
  }
  
  if (success) {
    // Reset on success
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    return { locked: false, remainingAttempts: MAX_ATTEMPTS };
  }
  
  // Failed attempt
  const newAttempts: PinAttempts = {
    count: attempts.count + 1,
    lastAttempt: now,
  };
  
  if (newAttempts.count >= MAX_ATTEMPTS) {
    newAttempts.lockedUntil = now + (LOCKOUT_MINUTES * 60 * 1000);
    localStorage.setItem(PIN_ATTEMPTS_KEY, JSON.stringify(newAttempts));
    return { locked: true, remainingAttempts: 0, lockoutMinutes: LOCKOUT_MINUTES };
  }
  
  localStorage.setItem(PIN_ATTEMPTS_KEY, JSON.stringify(newAttempts));
  return { locked: false, remainingAttempts: MAX_ATTEMPTS - newAttempts.count };
}

export function isLocked(): { locked: boolean; remainingMinutes?: number } {
  const attempts = getPinAttempts();
  const now = Date.now();
  
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    const remainingMs = attempts.lockedUntil - now;
    return { locked: true, remainingMinutes: Math.ceil(remainingMs / 60000) };
  }
  
  return { locked: false };
}
