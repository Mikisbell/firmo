/**
 * Session Manager v2
 * 
 * Enhanced session management with fingerprint validation, risk scoring,
 * activity tracking, and automatic timeout.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { logger } from '@/src/core/observability/logger';
import type { FingerprintResult } from './fingerprint-v2';
import { calculateSimilarity } from './fingerprint-v2';
import type { TerminalDevice } from './terminal-registry';
import { v4 as uuidv4 } from 'uuid';

// ============ TYPES ============

export type EmployeeRole =
  | 'OWNER' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR'
  | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'COOK' | 'PACKER' | 'BAR'
  | 'DRIVER';
export type TerminalRole = 'CAJA' | 'MOZO' | 'KDS_COCINA' | 'KDS_HORNO' | 'KDS_BAR';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  pin: string;
}

export interface SecureSession {
  id: string;
  terminal_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: EmployeeRole;
  terminal_role: TerminalRole;
  fingerprint_at_login: string;
  fingerprint_signals_at_login: string; // JSON stringified signals
  risk_score_at_login: number;
  created_at: Date;
  last_activity_at: Date;
  last_fingerprint_check: Date;
  expires_at: Date;
}

export interface SessionValidation {
  valid: boolean;
  reason?: 'expired' | 'inactive' | 'fingerprint_changed' | 'superseded' | 'not_found';
  requiresReauth: boolean;
  session?: SecureSession;
}

// ============ CONSTANTS ============

const SESSION_TIMEOUT_MINUTES = 15;           // Inactivity timeout (Requirement 5.3)
const FINGERPRINT_CHECK_INTERVAL_MINUTES = 5; // Periodic check (Requirement 5.4)
const FINGERPRINT_DRIFT_THRESHOLD = 50;       // Below this requires re-auth (Requirement 5.5)

// ============ IN-MEMORY SESSION STORE ============

// In production, this would be Redis or similar
const sessions = new Map<string, SecureSession>();
const employeeSessions = new Map<string, string>(); // employee_id -> session_id

// ============ PERIODIC FINGERPRINT VALIDATION ============

let periodicCheckInterval: NodeJS.Timeout | null = null;
let fingerprintProvider: (() => Promise<FingerprintResult>) | null = null;

/**
 * Set the fingerprint provider for periodic checks
 * This should be called by the client to provide the current fingerprint
 */
export function setFingerprintProvider(provider: () => Promise<FingerprintResult>): void {
  fingerprintProvider = provider;
}

/**
 * Start periodic fingerprint validation for all active sessions
 * Checks every 5 minutes (Requirement 5.4)
 */
export function startPeriodicFingerprintValidation(): void {
  if (periodicCheckInterval) {
    logger.warn('PERIODIC_CHECK_ALREADY_RUNNING', 'Periodic fingerprint validation already running');
    return;
  }

  // Check every 5 minutes
  periodicCheckInterval = setInterval(async () => {
    if (!fingerprintProvider) {
      logger.warn('PERIODIC_CHECK_NO_PROVIDER', 'No fingerprint provider set, skipping periodic check');
      return;
    }

    const activeSessions = Array.from(sessions.values());
    
    if (activeSessions.length === 0) {
      return;
    }

    logger.info('PERIODIC_CHECK_STARTED', 'Starting periodic fingerprint validation', {
      session_count: activeSessions.length,
    });

    try {
      const currentFingerprint = await fingerprintProvider();

      for (const session of activeSessions) {
        // Check if this session needs validation
        if (!needsFingerprintCheck(session)) {
          continue;
        }

        const result = periodicFingerprintCheck(session.id, currentFingerprint);
        
        if (!result.valid) {
          logger.warn('PERIODIC_CHECK_FAILED', 'Session invalidated by periodic fingerprint check', {
            session_id: session.id,
            employee_id: session.employee_id,
            similarity: result.similarity,
          });
        }
      }
    } catch (error) {
      logger.error('PERIODIC_CHECK_ERROR', 'Error during periodic fingerprint validation', error as Error, {
        session_count: activeSessions.length,
      });
    }
  }, FINGERPRINT_CHECK_INTERVAL_MINUTES * 60 * 1000);

  logger.info('PERIODIC_CHECK_STARTED', 'Periodic fingerprint validation started', {
    interval_minutes: FINGERPRINT_CHECK_INTERVAL_MINUTES,
  });
}

/**
 * Stop periodic fingerprint validation
 */
export function stopPeriodicFingerprintValidation(): void {
  if (periodicCheckInterval) {
    clearInterval(periodicCheckInterval);
    periodicCheckInterval = null;
    logger.info('PERIODIC_CHECK_STOPPED', 'Periodic fingerprint validation stopped');
  }
}

/**
 * Check if periodic validation is running
 */
export function isPeriodicValidationRunning(): boolean {
  return periodicCheckInterval !== null;
}

// ============ SESSION MANAGER ============

/**
 * Create a new session
 * Requirements: 5.1, 5.6
 */
export function createSession(
  terminal: TerminalDevice,
  employee: Employee,
  fingerprint: FingerprintResult,
  riskScore: number
): SecureSession {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);

  // Invalidate any existing session for this employee (Requirement 5.6)
  const existingSessionId = employeeSessions.get(employee.id);
  if (existingSessionId) {
    sessions.delete(existingSessionId);
    logger.info('SESSION_SUPERSEDED', 'Previous session invalidated', {
      employee_id: employee.id,
      old_session_id: existingSessionId,
      new_session_id: sessionId,
    });
  }

  const session: SecureSession = {
    id: sessionId,
    terminal_id: terminal.terminal_id,
    employee_id: employee.id,
    employee_name: employee.name,
    employee_role: employee.role,
    terminal_role: terminal.role,
    fingerprint_at_login: fingerprint.hash,
    fingerprint_signals_at_login: JSON.stringify(fingerprint.signals),
    risk_score_at_login: riskScore,
    created_at: now,
    last_activity_at: now,
    last_fingerprint_check: now,
    expires_at: expiresAt,
  };

  sessions.set(sessionId, session);
  employeeSessions.set(employee.id, sessionId);

  logger.info('SESSION_CREATED', 'New session created', {
    session_id: sessionId,
    employee_id: employee.id,
    terminal_id: terminal.terminal_id,
    risk_score: riskScore,
  });

  return session;
}

/**
 * Validate an existing session
 * Requirements: 5.2, 5.3
 */
export function validateSession(sessionId: string): SessionValidation {
  const session = sessions.get(sessionId);

  if (!session) {
    return {
      valid: false,
      reason: 'not_found',
      requiresReauth: true,
    };
  }

  const now = new Date();

  // Check if session expired (Requirement 5.2)
  if (now > session.expires_at) {
    sessions.delete(sessionId);
    employeeSessions.delete(session.employee_id);
    
    logger.warn('SESSION_EXPIRED', 'Session expired', {
      session_id: sessionId,
      employee_id: session.employee_id,
      expired_at: session.expires_at.toISOString(),
    });

    return {
      valid: false,
      reason: 'expired',
      requiresReauth: true,
    };
  }

  // Check inactivity timeout (Requirement 5.3)
  const inactiveMinutes = (now.getTime() - session.last_activity_at.getTime()) / (1000 * 60);
  if (inactiveMinutes > SESSION_TIMEOUT_MINUTES) {
    sessions.delete(sessionId);
    employeeSessions.delete(session.employee_id);
    
    logger.warn('SESSION_INACTIVE', 'Session timed out due to inactivity', {
      session_id: sessionId,
      employee_id: session.employee_id,
      inactive_minutes: Math.round(inactiveMinutes),
    });

    return {
      valid: false,
      reason: 'inactive',
      requiresReauth: true,
    };
  }

  return {
    valid: true,
    requiresReauth: false,
    session,
  };
}

/**
 * Update session activity timestamp
 * Requirements: 5.2
 */
export function updateActivity(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const now = new Date();
  session.last_activity_at = now;
  
  // Extend expiration
  session.expires_at = new Date(now.getTime() + SESSION_TIMEOUT_MINUTES * 60 * 1000);
}

/**
 * Perform periodic fingerprint validation
 * Requirements: 5.4, 5.5
 */
export function periodicFingerprintCheck(
  sessionId: string,
  currentFingerprint: FingerprintResult
): { valid: boolean; similarity: number; requiresReauth: boolean } {
  const session = sessions.get(sessionId);
  if (!session) {
    return { valid: false, similarity: 0, requiresReauth: true };
  }

  const now = new Date();
  const minutesSinceLastCheck = (now.getTime() - session.last_fingerprint_check.getTime()) / (1000 * 60);

  // Only check if enough time has passed (Requirement 5.4)
  if (minutesSinceLastCheck < FINGERPRINT_CHECK_INTERVAL_MINUTES) {
    return { valid: true, similarity: 100, requiresReauth: false };
  }

  // Parse stored signals
  let storedSignals;
  try {
    storedSignals = JSON.parse(session.fingerprint_signals_at_login);
  } catch {
    logger.error('FINGERPRINT_CHECK_ERROR', 'Failed to parse stored fingerprint signals', undefined, {
      session_id: sessionId,
    });
    return { valid: false, similarity: 0, requiresReauth: true };
  }

  // Calculate similarity
  const similarity = calculateSimilarity(storedSignals, currentFingerprint.signals);

  // Update last check time
  session.last_fingerprint_check = now;

  // Check drift threshold (Requirement 5.5)
  if (similarity < FINGERPRINT_DRIFT_THRESHOLD) {
    sessions.delete(sessionId);
    employeeSessions.delete(session.employee_id);
    
    logger.warn('FINGERPRINT_DRIFT_DETECTED', 'Session invalidated due to fingerprint drift', {
      session_id: sessionId,
      employee_id: session.employee_id,
      similarity,
      threshold: FINGERPRINT_DRIFT_THRESHOLD,
    });

    return { valid: false, similarity, requiresReauth: true };
  }

  logger.info('FINGERPRINT_CHECK_PASSED', 'Periodic fingerprint check passed', {
    session_id: sessionId,
    similarity,
  });

  return { valid: true, similarity, requiresReauth: false };
}

/**
 * Invalidate all sessions for an employee
 * Requirements: 5.6
 */
export function invalidateEmployeeSessions(employeeId: string): void {
  const sessionId = employeeSessions.get(employeeId);
  if (sessionId) {
    sessions.delete(sessionId);
    employeeSessions.delete(employeeId);
    
    logger.info('SESSIONS_INVALIDATED', 'All sessions invalidated for employee', {
      employee_id: employeeId,
      session_id: sessionId,
    });
  }
}

/**
 * Logout and destroy session
 */
export function logout(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    sessions.delete(sessionId);
    employeeSessions.delete(session.employee_id);
    
    logger.info('SESSION_LOGOUT', 'Session logged out', {
      session_id: sessionId,
      employee_id: session.employee_id,
    });
  }
}

/**
 * Get session by ID
 */
export function getSession(sessionId: string): SecureSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Get session by employee ID
 */
export function getSessionByEmployee(employeeId: string): SecureSession | null {
  const sessionId = employeeSessions.get(employeeId);
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

/**
 * Get all active sessions (for admin/debugging)
 */
export function getAllSessions(): SecureSession[] {
  return Array.from(sessions.values());
}

/**
 * Clear all sessions (for testing/maintenance)
 */
export function clearAllSessions(): void {
  sessions.clear();
  employeeSessions.clear();
  logger.info('ALL_SESSIONS_CLEARED', 'All sessions cleared');
}

// ============ HELPER FUNCTIONS ============

/**
 * Check if session needs fingerprint validation
 */
export function needsFingerprintCheck(session: SecureSession): boolean {
  const now = new Date();
  const minutesSinceLastCheck = (now.getTime() - session.last_fingerprint_check.getTime()) / (1000 * 60);
  return minutesSinceLastCheck >= FINGERPRINT_CHECK_INTERVAL_MINUTES;
}

/**
 * Get session time remaining in minutes
 */
export function getSessionTimeRemaining(session: SecureSession): number {
  const now = new Date();
  const remainingMs = session.expires_at.getTime() - now.getTime();
  return Math.max(0, Math.floor(remainingMs / (1000 * 60)));
}

/**
 * Get session inactivity time in minutes
 */
export function getSessionInactivityTime(session: SecureSession): number {
  const now = new Date();
  const inactiveMs = now.getTime() - session.last_activity_at.getTime();
  return Math.floor(inactiveMs / (1000 * 60));
}
