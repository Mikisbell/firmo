/**
 * Device ID Service
 * 
 * Manages persistent device identification.
 * Device ID is generated once and stored in localStorage.
 * Used to bind a physical device to a terminal permanently.
 * 
 * Requirements: Terminal Architecture v2 - Requirement 2.4
 */

import { safeStorage } from '@/src/lib/storage';

const DEVICE_ID_KEY = 'park_pos_device_id';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get or create device ID
 * 
 * This ID is generated ONCE and persists in localStorage.
 * It uniquely identifies this physical device.
 * 
 * @returns Device ID (UUID v4)
 */
export function getOrCreateDeviceId(): string {
  // Try to get from localStorage
  if (typeof window !== 'undefined') {
    const stored = safeStorage.getItem(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }
    
    // Generate new UUID
    const deviceId = generateUUID();
    safeStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }
  
  // Server-side: generate temporary UUID
  return generateUUID();
}

/**
 * Get device ID if it exists (without creating)
 */
export function getDeviceId(): string | null {
  if (typeof window !== 'undefined') {
    return safeStorage.getItem(DEVICE_ID_KEY);
  }
  return null;
}

/**
 * Clear device ID (for testing or device reset)
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    safeStorage.removeItem(DEVICE_ID_KEY);
  }
}

/**
 * Check if device is already registered
 */
export function isDeviceRegistered(): boolean {
  if (typeof window !== 'undefined') {
    return safeStorage.getItem(DEVICE_ID_KEY) !== null;
  }
  return false;
}
