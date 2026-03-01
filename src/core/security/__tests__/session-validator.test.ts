/**
 * Unit + Property Tests for Session Validator
 *
 * Tests cover:
 * 1. detectSimultaneousLogin — returns active sessions on different devices
 * 2. createActiveSession — persists a new active session with correct fields
 * 3. getLastSession — retrieves most recent active session
 * 4. closeSession — deactivates session by token
 * 5. validateSession — checks validity and updates last_activity_at
 * 6. markSessionAsSuspicious — flags session with reason
 * 7. getEmployeeActiveSessions — lists all active sessions
 * 8. closeAllSessionsExcept — closes all but one session
 * 9. Property: createActiveSession always produces a valid UUID token
 *
 * @module core/security/__tests__/session-validator.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------- mocks (before any SUT import) ----------
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    active_sessions: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => '00000000-0000-0000-0000-000000000001'),
}));

import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import {
  detectSimultaneousLogin,
  createActiveSession,
  getLastSession,
  closeSession,
  validateSession,
  markSessionAsSuspicious,
  getEmployeeActiveSessions,
  closeAllSessionsExcept,
} from '../session-validator';
import type { SessionContext } from '../session-validator';

// ============================================================================
// Arbitraries
// ============================================================================

const tenantIdArb = fc.uuid();
const employeeIdArb = fc.uuid();
const terminalIdArb = fc.uuid();
const deviceIdArb = fc.uuid();
const sessionTokenArb = fc.uuid();
const ipAddressArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const macAddressArb = fc
  .array(
    fc.integer({ min: 0, max: 255 }).map((n) => n.toString(16).padStart(2, '0')),
    { minLength: 6, maxLength: 6 }
  )
  .map((parts) => parts.join(':'));

const sessionContextArb = fc.record({
  employeeId: employeeIdArb,
  terminalId: terminalIdArb,
  deviceId: deviceIdArb,
  macAddress: macAddressArb,
  ipAddress: ipAddressArb,
  userAgent: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  location: fc.option(
    fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    }),
    { nil: undefined }
  ),
}) as fc.Arbitrary<SessionContext>;

// ============================================================================
// Helpers
// ============================================================================

function makeContext(overrides?: Partial<SessionContext>): SessionContext {
  return {
    employeeId: 'emp-1',
    terminalId: 'term-1',
    deviceId: 'dev-1',
    macAddress: 'aa:bb:cc:dd:ee:ff',
    ipAddress: '192.168.1.1',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Session Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- detectSimultaneousLogin ----------
  describe('detectSimultaneousLogin', () => {
    it('returns hasActiveSession: true when another device has an active session', async () => {
      const existingSession = {
        id: 'session-abc',
        tenant_id: 'tenant-1',
        employee_id: 'emp-1',
        terminal_id: 'term-1',
        device_id: 'dev-other',
        is_active: true,
      };

      vi.mocked(prisma.active_sessions.findMany).mockResolvedValue([existingSession] as never);

      const result = await detectSimultaneousLogin('tenant-1', 'emp-1', 'term-1', 'dev-1');

      expect(result.hasActiveSession).toBe(true);
      expect(result.session).toEqual(existingSession);
      expect(prisma.active_sessions.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          terminal_id: 'term-1',
          is_active: true,
          device_id: { not: 'dev-1' },
        },
      });
    });

    it('returns hasActiveSession: false when no other device has an active session', async () => {
      vi.mocked(prisma.active_sessions.findMany).mockResolvedValue([]);

      const result = await detectSimultaneousLogin('tenant-1', 'emp-1', 'term-1', 'dev-1');

      expect(result.hasActiveSession).toBe(false);
      expect(result.session).toBeUndefined();
    });

    it('filters by the correct tenant_id (never leaks across tenants)', async () => {
      vi.mocked(prisma.active_sessions.findMany).mockResolvedValue([]);

      await detectSimultaneousLogin('tenant-X', 'emp-1', 'term-1', 'dev-1');

      const call = vi.mocked(prisma.active_sessions.findMany).mock.calls[0][0] as any;
      expect(call.where.tenant_id).toBe('tenant-X');
    });
  });

  // ---------- createActiveSession ----------
  describe('createActiveSession', () => {
    it('creates a session and returns sessionToken + sessionId', async () => {
      vi.mocked(prisma.active_sessions.create).mockResolvedValue({} as never);

      const ctx = makeContext();
      const result = await createActiveSession('tenant-1', ctx);

      expect(result.sessionToken).toBe('00000000-0000-0000-0000-000000000001');
      expect(result.sessionId).toBe('00000000-0000-0000-0000-000000000001');
      expect(prisma.active_sessions.create).toHaveBeenCalledTimes(1);
    });

    it('passes all context fields to prisma.create', async () => {
      vi.mocked(prisma.active_sessions.create).mockResolvedValue({} as never);

      const ctx = makeContext({
        userAgent: 'TestBrowser/1.0',
        location: { lat: -12.04, lng: -77.03 },
      });

      await createActiveSession('tenant-1', ctx);

      const createArg = vi.mocked(prisma.active_sessions.create).mock.calls[0][0] as any;
      expect(createArg.data.employee_id).toBe('emp-1');
      expect(createArg.data.terminal_id).toBe('term-1');
      expect(createArg.data.device_id).toBe('dev-1');
      expect(createArg.data.mac_address).toBe('aa:bb:cc:dd:ee:ff');
      expect(createArg.data.ip_address).toBe('192.168.1.1');
      expect(createArg.data.user_agent).toBe('TestBrowser/1.0');
      expect(createArg.data.location_lat).toBe(-12.04);
      expect(createArg.data.location_lng).toBe(-77.03);
      expect(createArg.data.is_active).toBe(true);
      expect(createArg.data.is_suspicious).toBe(false);
    });

    it('handles missing optional location correctly', async () => {
      vi.mocked(prisma.active_sessions.create).mockResolvedValue({} as never);

      const ctx = makeContext({ location: undefined, userAgent: undefined });
      await createActiveSession('tenant-1', ctx);

      const createArg = vi.mocked(prisma.active_sessions.create).mock.calls[0][0] as any;
      expect(createArg.data.location_lat).toBeUndefined();
      expect(createArg.data.location_lng).toBeUndefined();
      expect(createArg.data.user_agent).toBeUndefined();
    });
  });

  // ---------- getLastSession ----------
  describe('getLastSession', () => {
    it('returns the most recent active session', async () => {
      const session = { id: 'session-1', employee_id: 'emp-1', is_active: true };
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(session as never);

      const result = await getLastSession('tenant-1', 'emp-1');

      expect(result).toEqual(session);
      expect(prisma.active_sessions.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          is_active: true,
        },
        orderBy: { last_activity_at: 'desc' },
      });
    });

    it('returns null when no active sessions exist', async () => {
      vi.mocked(prisma.active_sessions.findFirst).mockResolvedValue(null);

      const result = await getLastSession('tenant-1', 'emp-1');

      expect(result).toBeNull();
    });
  });

  // ---------- closeSession ----------
  describe('closeSession', () => {
    it('deactivates a session by token', async () => {
      vi.mocked(prisma.active_sessions.updateMany).mockResolvedValue({ count: 1 } as never);

      await closeSession('token-abc');

      const updateArg = vi.mocked(prisma.active_sessions.updateMany).mock.calls[0][0] as any;
      expect(updateArg.where.session_token).toBe('token-abc');
      expect(updateArg.data.is_active).toBe(false);
      expect(updateArg.data.ended_at).toBeInstanceOf(Date);
    });

    it('passes the optional reason to blocked_reason', async () => {
      vi.mocked(prisma.active_sessions.updateMany).mockResolvedValue({ count: 1 } as never);

      await closeSession('token-abc', 'User requested logout');

      const updateArg = vi.mocked(prisma.active_sessions.updateMany).mock.calls[0][0] as any;
      expect(updateArg.data.blocked_reason).toBe('User requested logout');
    });

    it('passes undefined blocked_reason when no reason given', async () => {
      vi.mocked(prisma.active_sessions.updateMany).mockResolvedValue({ count: 1 } as never);

      await closeSession('token-abc');

      const updateArg = vi.mocked(prisma.active_sessions.updateMany).mock.calls[0][0] as any;
      expect(updateArg.data.blocked_reason).toBeUndefined();
    });
  });

  // ---------- validateSession ----------
  describe('validateSession', () => {
    it('returns valid: true for an active session and updates last_activity_at', async () => {
      const session = { session_token: 'token-1', is_active: true };
      vi.mocked(prisma.active_sessions.findUnique).mockResolvedValue(session as never);
      vi.mocked(prisma.active_sessions.update).mockResolvedValue({} as never);

      const result = await validateSession('token-1');

      expect(result.valid).toBe(true);
      expect(result.session).toEqual(session);
      expect(prisma.active_sessions.update).toHaveBeenCalledWith({
        where: { session_token: 'token-1' },
        data: { last_activity_at: expect.any(Date) },
      });
    });

    it('returns valid: false when session not found', async () => {
      vi.mocked(prisma.active_sessions.findUnique).mockResolvedValue(null);

      const result = await validateSession('non-existent-token');

      expect(result.valid).toBe(false);
      expect(result.session).toBeUndefined();
      expect(prisma.active_sessions.update).not.toHaveBeenCalled();
    });

    it('returns valid: false when session is inactive', async () => {
      const session = { session_token: 'token-1', is_active: false };
      vi.mocked(prisma.active_sessions.findUnique).mockResolvedValue(session as never);

      const result = await validateSession('token-1');

      expect(result.valid).toBe(false);
      expect(prisma.active_sessions.update).not.toHaveBeenCalled();
    });
  });

  // ---------- markSessionAsSuspicious ----------
  describe('markSessionAsSuspicious', () => {
    it('sets is_suspicious to true with the given reason', async () => {
      vi.mocked(prisma.active_sessions.update).mockResolvedValue({} as never);

      await markSessionAsSuspicious('session-1', 'IP mismatch detected');

      expect(prisma.active_sessions.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          is_suspicious: true,
          blocked_reason: 'IP mismatch detected',
        },
      });
    });
  });

  // ---------- getEmployeeActiveSessions ----------
  describe('getEmployeeActiveSessions', () => {
    it('returns active sessions ordered by started_at desc', async () => {
      const sessions = [
        { id: 's1', started_at: new Date('2026-01-02') },
        { id: 's2', started_at: new Date('2026-01-01') },
      ];
      vi.mocked(prisma.active_sessions.findMany).mockResolvedValue(sessions as never);

      const result = await getEmployeeActiveSessions('tenant-1', 'emp-1');

      expect(result).toHaveLength(2);
      expect(prisma.active_sessions.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          is_active: true,
        },
        orderBy: { started_at: 'desc' },
      });
    });

    it('returns empty array when employee has no active sessions', async () => {
      vi.mocked(prisma.active_sessions.findMany).mockResolvedValue([]);

      const result = await getEmployeeActiveSessions('tenant-1', 'emp-1');

      expect(result).toEqual([]);
    });
  });

  // ---------- closeAllSessionsExcept ----------
  describe('closeAllSessionsExcept', () => {
    it('closes all sessions except the specified one', async () => {
      vi.mocked(prisma.active_sessions.updateMany).mockResolvedValue({ count: 3 } as never);

      await closeAllSessionsExcept('tenant-1', 'emp-1', 'keep-this-token');

      const updateArg = vi.mocked(prisma.active_sessions.updateMany).mock.calls[0][0] as any;
      expect(updateArg.where.tenant_id).toBe('tenant-1');
      expect(updateArg.where.employee_id).toBe('emp-1');
      expect(updateArg.where.is_active).toBe(true);
      expect(updateArg.where.session_token).toEqual({ not: 'keep-this-token' });
      expect(updateArg.data.is_active).toBe(false);
      expect(updateArg.data.ended_at).toBeInstanceOf(Date);
      expect(updateArg.data.blocked_reason).toBe('Closed due to new login');
    });
  });
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Session Validator - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Invariant 1: createActiveSession always sets is_active=true and is_suspicious=false
   * regardless of whatever context data is provided.
   */
  it('Invariant 1: New sessions are always active and non-suspicious (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(tenantIdArb, sessionContextArb, async (tenantId, ctx) => {
        vi.clearAllMocks();
        vi.mocked(uuidv4).mockReturnValue('uuid-test' as never);
        vi.mocked(prisma.active_sessions.create).mockResolvedValue({} as never);

        await createActiveSession(tenantId, ctx);

        const calls = vi.mocked(prisma.active_sessions.create).mock.calls;
        const createArg = calls[calls.length - 1][0] as any;
        expect(createArg.data.is_active).toBe(true);
        expect(createArg.data.is_suspicious).toBe(false);
        expect(createArg.data.tenant_id).toBe(tenantId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 2: detectSimultaneousLogin always excludes the current device from the query.
   */
  it('Invariant 2: Simultaneous login detection excludes the querying device (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        employeeIdArb,
        terminalIdArb,
        deviceIdArb,
        async (tenantId, employeeId, terminalId, deviceId) => {
          vi.clearAllMocks();
          vi.mocked(prisma.active_sessions.findMany).mockResolvedValue([]);

          await detectSimultaneousLogin(tenantId, employeeId, terminalId, deviceId);

          const calls = vi.mocked(prisma.active_sessions.findMany).mock.calls;
          const call = calls[calls.length - 1][0] as any;
          expect(call.where.device_id).toEqual({ not: deviceId });
          expect(call.where.tenant_id).toBe(tenantId);
          expect(call.where.employee_id).toBe(employeeId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 3: validateSession never updates last_activity_at for invalid sessions.
   */
  it('Invariant 3: Invalid sessions never trigger a last_activity_at update (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(sessionTokenArb, async (token) => {
        // Scenario A: session not found
        vi.mocked(prisma.active_sessions.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.active_sessions.update).mockClear();

        const resultA = await validateSession(token);
        expect(resultA.valid).toBe(false);
        expect(prisma.active_sessions.update).not.toHaveBeenCalled();

        // Scenario B: session inactive
        vi.mocked(prisma.active_sessions.findUnique).mockResolvedValue({
          session_token: token,
          is_active: false,
        } as never);
        vi.mocked(prisma.active_sessions.update).mockClear();

        const resultB = await validateSession(token);
        expect(resultB.valid).toBe(false);
        expect(prisma.active_sessions.update).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});
