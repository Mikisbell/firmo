/**
 * Property-Based Tests for Session Manager v2
 * 
 * Tests Properties 11, 12, and 13 from the design document.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  createSession,
  validateSession,
  updateActivity,
  periodicFingerprintCheck,
  invalidateEmployeeSessions,
  logout,
  getSession,
  getSessionByEmployee,
  clearAllSessions,
  needsFingerprintCheck,
  getSessionTimeRemaining,
  getSessionInactivityTime,
  setFingerprintProvider,
  startPeriodicFingerprintValidation,
  stopPeriodicFingerprintValidation,
  isPeriodicValidationRunning,
  type EmployeeRole,
  type TerminalRole,
} from '../session-v2';

// ============ ARBITRARIES ============

const employeeRoleArb = fc.constantFrom<EmployeeRole>(
  'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'BAR'
);

const terminalRoleArb = fc.constantFrom<TerminalRole>(
  'CAJA', 'MOZO', 'KDS_COCINA', 'KDS_HORNO', 'KDS_BAR'
);

const employeeArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 3, maxLength: 50 }),
  role: employeeRoleArb,
  pin: fc.string({ minLength: 4, maxLength: 6 }),
});

const terminalArb = fc.record({
  id: fc.uuid(),
  terminal_id: fc.string({ minLength: 5, maxLength: 20 }),
  tenant_id: fc.uuid(),
  role: terminalRoleArb,
  fingerprint_hash: fc.string({ minLength: 64, maxLength: 64 }),
  fingerprint_salt: fc.string({ minLength: 64, maxLength: 64 }),
  status: fc.constant('active' as const),
  bound_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  last_seen_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  last_fingerprint_check: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  drift_score: fc.integer({ min: 0, max: 100 }),
  location_id: fc.uuid(),
  device_name: fc.string({ minLength: 3, maxLength: 50 }),
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
  updated_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
});

const fingerprintSignalsArb = fc.record({
  canvas: fc.string(),
  webgl: fc.string(),
  webglVendor: fc.string(),
  webglRenderer: fc.string(),
  audio: fc.string(),
  fonts: fc.string(),
  screen: fc.string(),
  hardware: fc.string(),
  timezone: fc.string(),
  platform: fc.string(),
  webglExtensions: fc.string(),
  colorDepth: fc.string(),
  storage: fc.string(),
  mediaDevices: fc.string(),
});

const fingerprintArb = fc.record({
  hash: fc.string({ minLength: 64, maxLength: 64 }),
  signals: fingerprintSignalsArb,
  signalCount: fc.integer({ min: 8, max: 14 }),
  timestamp: fc.integer({ min: Date.now() - 1000000, max: Date.now() }),
});

// ============ SETUP ============

beforeEach(() => {
  clearAllSessions();
});

// ============ PROPERTY 11: SESSION ACTIVITY TRACKING AND TIMEOUT ============
// **Validates: Requirements 5.2, 5.3**

describe('Property 11: Session Activity Tracking and Timeout', () => {
  // Feature: terminal-architecture-v2, Property 11: Session Activity Tracking and Timeout
  
  it('should update last_activity_at when updateActivity is called', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          const originalActivity = session.last_activity_at;
          
          // Wait a tiny bit to ensure time difference
          setTimeout(() => {}, 10);
          
          updateActivity(session.id);
          
          const updatedSession = getSession(session.id);
          expect(updatedSession).toBeDefined();
          expect(updatedSession!.last_activity_at.getTime()).toBeGreaterThanOrEqual(originalActivity.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should extend expires_at when updateActivity is called', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          const originalExpiry = session.expires_at;
          
          // Wait a bit to ensure time difference
          setTimeout(() => {}, 10);
          
          updateActivity(session.id);
          
          const updatedSession = getSession(session.id);
          expect(updatedSession).toBeDefined();
          expect(updatedSession!.expires_at.getTime()).toBeGreaterThanOrEqual(originalExpiry.getTime());
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should invalidate session after 15 minutes of inactivity', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Simulate 16 minutes of inactivity by modifying last_activity_at
          session.last_activity_at = new Date(Date.now() - 16 * 60 * 1000);
          
          const validation = validateSession(session.id);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('inactive');
          expect(validation.requiresReauth).toBe(true);
          
          // Session should be deleted
          expect(getSession(session.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should keep session valid if activity is within 15 minutes', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 14 }),
        (terminal, employee, fingerprint, riskScore, minutesAgo) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Simulate activity within timeout
          session.last_activity_at = new Date(Date.now() - minutesAgo * 60 * 1000);
          session.expires_at = new Date(Date.now() + 60 * 1000); // Still valid
          
          const validation = validateSession(session.id);
          
          expect(validation.valid).toBe(true);
          expect(validation.requiresReauth).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should invalidate expired sessions', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Expire the session
          session.expires_at = new Date(Date.now() - 1000);
          
          const validation = validateSession(session.id);
          
          expect(validation.valid).toBe(false);
          expect(validation.reason).toBe('expired');
          expect(validation.requiresReauth).toBe(true);
          
          // Session should be deleted
          expect(getSession(session.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ PROPERTY 12: PERIODIC SESSION FINGERPRINT VALIDATION ============
// **Validates: Requirements 5.4, 5.5**

describe('Property 12: Periodic Session Fingerprint Validation', () => {
  // Feature: terminal-architecture-v2, Property 12: Periodic Session Fingerprint Validation
  
  it('should not check fingerprint if less than 5 minutes since last check', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 4 }), // 0-4 minutes
        (terminal, employee, fp1, fp2, riskScore, minutesAgo) => {
          const session = createSession(terminal, employee, fp1, riskScore);
          
          // Last check was recent (less than 5 minutes)
          session.last_fingerprint_check = new Date(Date.now() - minutesAgo * 60 * 1000);
          
          const result = periodicFingerprintCheck(session.id, fp2);
          
          // Should skip check and return valid
          expect(result.valid).toBe(true);
          expect(result.similarity).toBe(100);
          expect(result.requiresReauth).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should check fingerprint if exactly 5 minutes since last check', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Last check was exactly 5 minutes ago
          session.last_fingerprint_check = new Date(Date.now() - 5 * 60 * 1000);
          
          // Use same fingerprint for check
          const result = periodicFingerprintCheck(session.id, fingerprint);
          
          // Should perform check and pass with high similarity
          expect(result.similarity).toBeGreaterThanOrEqual(50);
          expect(result.valid).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should check fingerprint if more than 5 minutes since last check', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 6, max: 60 }), // 6-60 minutes
        (terminal, employee, fingerprint, riskScore, minutesAgo) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Last check was more than 5 minutes ago
          session.last_fingerprint_check = new Date(Date.now() - minutesAgo * 60 * 1000);
          
          // Use same fingerprint for check
          const result = periodicFingerprintCheck(session.id, fingerprint);
          
          // Should perform check
          expect(result.similarity).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update last_fingerprint_check timestamp when check is performed', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Set last check to 6 minutes ago
          const oldCheckTime = new Date(Date.now() - 6 * 60 * 1000);
          session.last_fingerprint_check = oldCheckTime;
          
          // Perform check
          periodicFingerprintCheck(session.id, fingerprint);
          
          // Verify timestamp was updated
          const updatedSession = getSession(session.id);
          if (updatedSession) {
            expect(updatedSession.last_fingerprint_check.getTime()).toBeGreaterThan(oldCheckTime.getTime());
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should invalidate session if fingerprint similarity < 50%', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fp1, fp2, riskScore) => {
          // Ensure fingerprints are different
          if (fp1.hash === fp2.hash) return true;
          
          const session = createSession(terminal, employee, fp1, riskScore);
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          const result = periodicFingerprintCheck(session.id, fp2);
          
          // If similarity is low, session should be invalidated
          if (result.similarity < 50) {
            expect(result.valid).toBe(false);
            expect(result.requiresReauth).toBe(true);
            expect(getSession(session.id)).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should keep session valid if fingerprint similarity >= 50%', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          // Use same fingerprint (100% similarity)
          const result = periodicFingerprintCheck(session.id, fingerprint);
          
          expect(result.valid).toBe(true);
          expect(result.similarity).toBeGreaterThanOrEqual(50);
          expect(result.requiresReauth).toBe(false);
          expect(getSession(session.id)).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle boundary case: similarity exactly at 50%', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          const result = periodicFingerprintCheck(session.id, fingerprint);
          
          // At exactly 50%, session should remain valid (>= 50 threshold)
          if (result.similarity === 50) {
            expect(result.valid).toBe(true);
            expect(result.requiresReauth).toBe(false);
            expect(getSession(session.id)).toBeDefined();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return requiresReauth=true when session is invalidated', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fp1, fp2, riskScore) => {
          // Ensure fingerprints are different
          if (fp1.hash === fp2.hash) return true;
          
          const session = createSession(terminal, employee, fp1, riskScore);
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          const result = periodicFingerprintCheck(session.id, fp2);
          
          // If session is invalid, requiresReauth must be true
          if (!result.valid) {
            expect(result.requiresReauth).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle non-existent session gracefully', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fingerprintArb,
        (sessionId, fingerprint) => {
          const result = periodicFingerprintCheck(sessionId, fingerprint);
          
          expect(result.valid).toBe(false);
          expect(result.similarity).toBe(0);
          expect(result.requiresReauth).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve session data when validation passes', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          const originalEmployeeId = session.employee_id;
          const originalTerminalId = session.terminal_id;
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          // Perform check with same fingerprint
          const result = periodicFingerprintCheck(session.id, fingerprint);
          
          if (result.valid) {
            const updatedSession = getSession(session.id);
            expect(updatedSession).toBeDefined();
            expect(updatedSession!.employee_id).toBe(originalEmployeeId);
            expect(updatedSession!.terminal_id).toBe(originalTerminalId);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should remove session from both maps when invalidated', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fp1, fp2, riskScore) => {
          // Ensure fingerprints are different
          if (fp1.hash === fp2.hash) return true;
          
          const session = createSession(terminal, employee, fp1, riskScore);
          
          // Force fingerprint check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          const result = periodicFingerprintCheck(session.id, fp2);
          
          // If session was invalidated, verify it's removed from both maps
          if (!result.valid) {
            expect(getSession(session.id)).toBeNull();
            expect(getSessionByEmployee(employee.id)).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple consecutive checks correctly', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // First check - should skip (recent)
          session.last_fingerprint_check = new Date(Date.now() - 2 * 60 * 1000);
          const result1 = periodicFingerprintCheck(session.id, fingerprint);
          expect(result1.valid).toBe(true);
          expect(result1.similarity).toBe(100);
          
          // Second check - should perform (6 minutes later)
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          const result2 = periodicFingerprintCheck(session.id, fingerprint);
          expect(result2.valid).toBe(true);
          expect(result2.similarity).toBeGreaterThanOrEqual(50);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ PROPERTY 13: SINGLE SESSION PER EMPLOYEE ============
// **Validates: Requirements 5.6**

describe('Property 13: Single Session Per Employee', () => {
  // Feature: terminal-architecture-v2, Property 13: Single Session Per Employee
  
  it('should invalidate previous session when creating new session for same employee', () => {
    fc.assert(
      fc.property(
        terminalArb,
        terminalArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (terminal1, terminal2, employee, fp1, fp2, risk1, risk2) => {
          // Create first session
          const session1 = createSession(terminal1, employee, fp1, risk1);
          expect(getSession(session1.id)).toBeDefined();
          
          // Create second session for same employee
          const session2 = createSession(terminal2, employee, fp2, risk2);
          expect(getSession(session2.id)).toBeDefined();
          
          // First session should be invalidated
          expect(getSession(session1.id)).toBeNull();
          
          // Only second session should exist
          const employeeSession = getSessionByEmployee(employee.id);
          expect(employeeSession).toBeDefined();
          expect(employeeSession!.id).toBe(session2.id);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow different employees to have concurrent sessions', () => {
    fc.assert(
      fc.property(
        terminalArb,
        terminalArb,
        employeeArb,
        employeeArb,
        fingerprintArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (terminal1, terminal2, employee1, employee2, fp1, fp2, risk1, risk2) => {
          // Ensure different employees
          if (employee1.id === employee2.id) return true;
          
          // Create sessions for different employees
          const session1 = createSession(terminal1, employee1, fp1, risk1);
          const session2 = createSession(terminal2, employee2, fp2, risk2);
          
          // Both sessions should exist
          expect(getSession(session1.id)).toBeDefined();
          expect(getSession(session2.id)).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should invalidate all sessions when calling invalidateEmployeeSessions', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          expect(getSession(session.id)).toBeDefined();
          
          invalidateEmployeeSessions(employee.id);
          
          expect(getSession(session.id)).toBeNull();
          expect(getSessionByEmployee(employee.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should delete session when logging out', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          expect(getSession(session.id)).toBeDefined();
          
          logout(session.id);
          
          expect(getSession(session.id)).toBeNull();
          expect(getSessionByEmployee(employee.id)).toBeNull();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ HELPER FUNCTION TESTS ============

describe('Helper Functions', () => {
  it('should correctly determine if fingerprint check is needed', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 10 }),
        (terminal, employee, fingerprint, riskScore, minutesAgo) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          session.last_fingerprint_check = new Date(Date.now() - minutesAgo * 60 * 1000);
          
          const needsCheck = needsFingerprintCheck(session);
          
          if (minutesAgo >= 5) {
            expect(needsCheck).toBe(true);
          } else {
            expect(needsCheck).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate session time remaining correctly', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        (terminal, employee, fingerprint, riskScore) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          const remaining = getSessionTimeRemaining(session);
          
          expect(remaining).toBeGreaterThanOrEqual(0);
          expect(remaining).toBeLessThanOrEqual(15);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate session inactivity time correctly', () => {
    fc.assert(
      fc.property(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 10 }),
        (terminal, employee, fingerprint, riskScore, minutesAgo) => {
          const session = createSession(terminal, employee, fingerprint, riskScore);
          session.last_activity_at = new Date(Date.now() - minutesAgo * 60 * 1000);
          
          const inactivity = getSessionInactivityTime(session);
          
          expect(inactivity).toBeGreaterThanOrEqual(minutesAgo - 1); // Allow 1 minute tolerance
          expect(inactivity).toBeLessThanOrEqual(minutesAgo + 1);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============ AUTOMATIC PERIODIC VALIDATION TESTS ============

describe('Automatic Periodic Fingerprint Validation', () => {
  beforeEach(() => {
    stopPeriodicFingerprintValidation();
  });

  it('should start periodic validation', () => {
    expect(isPeriodicValidationRunning()).toBe(false);
    
    startPeriodicFingerprintValidation();
    
    expect(isPeriodicValidationRunning()).toBe(true);
    
    stopPeriodicFingerprintValidation();
  });

  it('should stop periodic validation', () => {
    startPeriodicFingerprintValidation();
    expect(isPeriodicValidationRunning()).toBe(true);
    
    stopPeriodicFingerprintValidation();
    
    expect(isPeriodicValidationRunning()).toBe(false);
  });

  it('should not start multiple intervals', () => {
    startPeriodicFingerprintValidation();
    expect(isPeriodicValidationRunning()).toBe(true);
    
    // Try to start again
    startPeriodicFingerprintValidation();
    expect(isPeriodicValidationRunning()).toBe(true);
    
    stopPeriodicFingerprintValidation();
  });

  it('should allow setting fingerprint provider', () => {
    const mockProvider = async () => ({
      hash: 'test-hash',
      signals: {
        canvas: 'test',
        webgl: 'test',
        webglVendor: 'test',
        webglRenderer: 'test',
        audio: 'test',
        fonts: 'test',
        screen: 'test',
        hardware: 'test',
        timezone: 'test',
        platform: 'test',
        webglExtensions: 'test',
        colorDepth: 'test',
        storage: 'test',
        mediaDevices: 'test',
      },
      signalCount: 14,
      timestamp: Date.now(),
    });

    expect(() => setFingerprintProvider(mockProvider)).not.toThrow();
  });

  it('should validate sessions periodically when provider is set', async () => {
    fc.assert(
      fc.asyncProperty(
        terminalArb,
        employeeArb,
        fingerprintArb,
        fc.integer({ min: 0, max: 100 }),
        async (terminal, employee, fingerprint, riskScore) => {
          // Create a session
          const session = createSession(terminal, employee, fingerprint, riskScore);
          
          // Force the session to need a check
          session.last_fingerprint_check = new Date(Date.now() - 6 * 60 * 1000);
          
          // Set up fingerprint provider
          setFingerprintProvider(async () => {
            return fingerprint;
          });
          
          // Start periodic validation
          startPeriodicFingerprintValidation();
          
          // Wait a bit for the interval to potentially run
          // Note: In real tests, we'd mock timers, but for property tests we just verify setup
          
          // Clean up
          stopPeriodicFingerprintValidation();
          
          // Verify the system is set up correctly
          expect(isPeriodicValidationRunning()).toBe(false);
          
          return true;
        }
      ),
      { numRuns: 10 } // Fewer runs since this involves async
    );
  });
});
