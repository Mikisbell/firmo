/**
 * Offline Authentication Cache
 * 
 * Provides offline authentication capabilities by caching credentials locally.
 * Includes integrity verification using HMAC to detect tampering.
 * 
 * Requirements: 8.1, 8.2, 8.5 (Terminal Architecture v2)
 */

import { logger } from '@/src/core/observability/logger';
import type { TerminalDevice } from './terminal-registry';

// ============ TYPES ============

export interface Employee {
  id: string;
  name: string;
  pin_hash: string;
  role: string;
}

export interface CachedCredentials {
  terminal_id: string;
  fingerprint_hash: string;
  employee_pins: Record<string, string>; // employee_id -> hashed PIN
  cached_at: string;
  expires_at: string; // 24 hours from cache
  integrity_hash: string; // HMAC of all data
}

export interface PendingAuthEvent {
  id: string;
  terminal_id: string;
  employee_id: string;
  event_type: 'login_success' | 'login_failed' | 'logout';
  timestamp: string;
  metadata: Record<string, unknown>;
}

// ============ CONSTANTS ============

const CACHE_KEY = 'park_offline_auth_cache';
const PENDING_EVENTS_KEY = 'park_pending_auth_events';
const CACHE_EXPIRY_HOURS = 24;
const HMAC_SECRET_KEY = 'park_pos_offline_cache_v1'; // In production, use env variable

// ============ HELPER FUNCTIONS ============

/**
 * Generate HMAC-SHA256 for data integrity verification
 * Requirements: 8.5
 */
async function generateHMAC(data: string, secret: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    // Fallback for environments without crypto.subtle
    return simpleHash(data + secret);
  }

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(data);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Generate HMAC
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logger.warn('HMAC_GENERATION_FAILED', 'Failed to generate HMAC, using fallback', { error });
    return simpleHash(data + secret);
  }
}

/**
 * Simple hash fallback for environments without crypto.subtle
 */
function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Hash a PIN using SHA-256
 * Requirements: 8.2
 */
async function hashPIN(pin: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return simpleHash(pin + salt);
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return simpleHash(pin + salt);
  }
}

/**
 * Get data from localStorage safely
 */
function getFromStorage<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null;
  
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    logger.warn('STORAGE_READ_ERROR', 'Failed to read from localStorage', { key, error });
    return null;
  }
}

/**
 * Set data to localStorage safely
 */
function setToStorage<T>(key: string, value: T): boolean {
  if (typeof localStorage === 'undefined') return false;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.warn('STORAGE_WRITE_ERROR', 'Failed to write to localStorage', { key, error });
    return false;
  }
}

/**
 * Remove data from localStorage safely
 */
function removeFromStorage(key: string): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    logger.warn('STORAGE_DELETE_ERROR', 'Failed to delete from localStorage', { key, error });
  }
}

// ============ OFFLINE AUTH CACHE SERVICE ============

/**
 * Cache credentials for offline authentication
 * Requirements: 8.1
 */
export async function cacheCredentials(
  terminal: TerminalDevice,
  employees: Employee[]
): Promise<void> {
  if (!terminal.fingerprint_hash) {
    logger.warn('CACHE_FAILED', 'Cannot cache credentials without fingerprint', {
      terminal_id: terminal.terminal_id,
    });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_HOURS * 60 * 60 * 1000);

  // Build employee PIN map
  const employeePins: Record<string, string> = {};
  for (const employee of employees) {
    employeePins[employee.id] = employee.pin_hash;
  }

  // Create cache data (without integrity hash)
  const cacheData = {
    terminal_id: terminal.terminal_id,
    fingerprint_hash: terminal.fingerprint_hash,
    employee_pins: employeePins,
    cached_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // Generate integrity hash
  const dataString = JSON.stringify(cacheData);
  const integrityHash = await generateHMAC(dataString, HMAC_SECRET_KEY);

  // Add integrity hash
  const cachedCredentials: CachedCredentials = {
    ...cacheData,
    integrity_hash: integrityHash,
  };

  // Store in localStorage
  const success = setToStorage(CACHE_KEY, cachedCredentials);

  if (success) {
    logger.info('CREDENTIALS_CACHED', 'Credentials cached for offline use', {
      terminal_id: terminal.terminal_id,
      employee_count: employees.length,
      expires_at: expiresAt.toISOString(),
    });
  }
}

/**
 * Validate credentials offline against cached hash
 * Requirements: 8.2
 */
export async function validateOffline(
  terminalId: string,
  employeeId: string,
  pin: string
): Promise<{ valid: boolean; reason?: string }> {
  // Get cached credentials
  const cached = getFromStorage<CachedCredentials>(CACHE_KEY);

  if (!cached) {
    return { valid: false, reason: 'No cached credentials available' };
  }

  // Verify terminal ID matches
  if (cached.terminal_id !== terminalId) {
    return { valid: false, reason: 'Terminal ID mismatch' };
  }

  // Check if cache is expired (Requirement 8.4)
  const now = new Date();
  const expiresAt = new Date(cached.expires_at);
  if (now > expiresAt) {
    logger.warn('CACHE_EXPIRED', 'Cached credentials expired', {
      terminal_id: terminalId,
      expired_at: cached.expires_at,
    });
    return { valid: false, reason: 'Cache expired - online authentication required' };
  }

  // Verify integrity (Requirement 8.5)
  const isValid = await verifyIntegrity(cached);
  if (!isValid) {
    logger.error('CACHE_TAMPERED', 'Cache integrity check failed', undefined, {
      terminal_id: terminalId,
    });
    // Clear tampered cache
    clearCache();
    return { valid: false, reason: 'Cache integrity check failed - online authentication required' };
  }

  // Check if employee exists in cache
  // Use hasOwnProperty to avoid prototype pollution
  if (!Object.prototype.hasOwnProperty.call(cached.employee_pins, employeeId)) {
    return { valid: false, reason: 'Employee not found in cache' };
  }
  
  const cachedPinHash = cached.employee_pins[employeeId];

  // Validate PIN against cached hash
  const pinHash = await hashPIN(pin, terminalId); // Use terminal_id as salt
  const pinMatches = pinHash === cachedPinHash;

  if (pinMatches) {
    logger.info('OFFLINE_AUTH_SUCCESS', 'Offline authentication successful', {
      terminal_id: terminalId,
      employee_id: employeeId,
    });

    // Add to pending events for sync
    await addPendingEvent({
      id: crypto.randomUUID(),
      terminal_id: terminalId,
      employee_id: employeeId,
      event_type: 'login_success',
      timestamp: new Date().toISOString(),
      metadata: { offline: true },
    });

    return { valid: true };
  } else {
    logger.warn('OFFLINE_AUTH_FAILED', 'Offline authentication failed - PIN mismatch', {
      terminal_id: terminalId,
      employee_id: employeeId,
    });

    // Add to pending events for sync
    await addPendingEvent({
      id: crypto.randomUUID(),
      terminal_id: terminalId,
      employee_id: employeeId,
      event_type: 'login_failed',
      timestamp: new Date().toISOString(),
      metadata: { offline: true, reason: 'PIN mismatch' },
    });

    return { valid: false, reason: 'Invalid PIN' };
  }
}

/**
 * Verify cache integrity using HMAC
 * Requirements: 8.5
 */
export async function verifyIntegrity(cached?: CachedCredentials): Promise<boolean> {
  const cacheData = cached || getFromStorage<CachedCredentials>(CACHE_KEY);

  if (!cacheData) {
    return false;
  }

  // Extract integrity hash
  const { integrity_hash, ...dataWithoutHash } = cacheData;

  // Recalculate integrity hash
  const dataString = JSON.stringify(dataWithoutHash);
  const calculatedHash = await generateHMAC(dataString, HMAC_SECRET_KEY);

  // Compare hashes
  return calculatedHash === integrity_hash;
}

/**
 * Check if cache is expired
 * Requirements: 8.4
 */
export function isExpired(): boolean {
  const cached = getFromStorage<CachedCredentials>(CACHE_KEY);

  if (!cached) {
    return true;
  }

  const now = new Date();
  const expiresAt = new Date(cached.expires_at);

  return now > expiresAt;
}

/**
 * Get cached credentials (for inspection)
 */
export function getCachedCredentials(): CachedCredentials | null {
  return getFromStorage<CachedCredentials>(CACHE_KEY);
}

/**
 * Clear cached credentials
 */
export function clearCache(): void {
  removeFromStorage(CACHE_KEY);
  logger.info('CACHE_CLEARED', 'Offline cache cleared');
}

// ============ PENDING EVENTS MANAGEMENT ============

/**
 * Add a pending auth event for later sync
 * Requirements: 8.3
 */
async function addPendingEvent(event: PendingAuthEvent): Promise<void> {
  const pending = getFromStorage<PendingAuthEvent[]>(PENDING_EVENTS_KEY) || [];
  pending.push(event);
  setToStorage(PENDING_EVENTS_KEY, pending);

  logger.info('PENDING_EVENT_ADDED', 'Auth event queued for sync', {
    event_type: event.event_type,
    terminal_id: event.terminal_id,
  });
}

/**
 * Get all pending auth events
 * Requirements: 8.3
 */
export function getPendingEvents(): PendingAuthEvent[] {
  return getFromStorage<PendingAuthEvent[]>(PENDING_EVENTS_KEY) || [];
}

/**
 * Clear pending events (after successful sync)
 * Requirements: 8.3
 */
export function clearPendingEvents(): void {
  removeFromStorage(PENDING_EVENTS_KEY);
  logger.info('PENDING_EVENTS_CLEARED', 'Pending events cleared after sync');
}

/**
 * Sync pending events to server
 * Requirements: 8.3
 */
export async function syncPendingEvents(): Promise<{ success: boolean; synced: number; failed: number }> {
  const pending = getPendingEvents();

  if (pending.length === 0) {
    return { success: true, synced: 0, failed: 0 };
  }

  logger.info('SYNC_PENDING_EVENTS', 'Syncing pending auth events', {
    count: pending.length,
  });

  let synced = 0;
  let failed = 0;
  const failedEvents: PendingAuthEvent[] = [];

  // Sync each event to server
  for (const event of pending) {
    try {
      // Call server API to log the auth event
      const response = await fetch('/api/auth/events/offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      logger.info('EVENT_SYNCED', 'Auth event synced to server', {
        event_id: event.id,
        event_type: event.event_type,
      });
      synced++;
    } catch (error) {
      logger.error('EVENT_SYNC_FAILED', 'Failed to sync auth event', error instanceof Error ? error : undefined, {
        event_id: event.id,
      });
      failed++;
      failedEvents.push(event);
    }
  }

  // Clear all events if all synced successfully
  if (failed === 0) {
    clearPendingEvents();
  } else {
    // Keep only failed events for retry
    setToStorage(PENDING_EVENTS_KEY, failedEvents);
  }

  return { success: failed === 0, synced, failed };
}

// ============ UTILITY FUNCTIONS ============

/**
 * Get cache status information
 */
export function getCacheStatus(): {
  cached: boolean;
  expired: boolean;
  terminal_id?: string;
  cached_at?: string;
  expires_at?: string;
  employee_count?: number;
  pending_events: number;
} {
  const cached = getFromStorage<CachedCredentials>(CACHE_KEY);
  const pending = getPendingEvents();

  if (!cached) {
    return {
      cached: false,
      expired: true,
      pending_events: pending.length,
    };
  }

  return {
    cached: true,
    expired: isExpired(),
    terminal_id: cached.terminal_id,
    cached_at: cached.cached_at,
    expires_at: cached.expires_at,
    employee_count: Object.keys(cached.employee_pins).length,
    pending_events: pending.length,
  };
}

/**
 * Check if offline authentication is available
 */
export function isOfflineAuthAvailable(terminalId: string): boolean {
  const cached = getFromStorage<CachedCredentials>(CACHE_KEY);

  if (!cached) return false;
  if (cached.terminal_id !== terminalId) return false;
  if (isExpired()) return false;

  return true;
}
