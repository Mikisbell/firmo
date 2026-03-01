/**
 * Unit + Property Tests for Alert Service
 *
 * Tests cover:
 * 1. createAlert — creates a security alert with correct fields
 * 2. getUnresolvedAlerts — returns only unresolved alerts
 * 3. getEmployeeAlerts — returns alerts for a specific employee
 * 4. resolveAlert — marks an alert as resolved
 * 5. getAlertsByType — filters alerts by type
 * 6. getAlertStats — computes stats correctly
 * 7. cleanupOldAlerts — deletes resolved alerts older than 30 days
 * 8. Property: AlertType exhaustiveness, stats invariants
 *
 * @module core/security/__tests__/alert-service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ---------- mocks (before any SUT import) ----------
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    session_alerts: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'alert-uuid-001'),
}));

import prisma from '@/src/core/db/prisma';
import {
  createAlert,
  getUnresolvedAlerts,
  getEmployeeAlerts,
  resolveAlert,
  getAlertsByType,
  getAlertStats,
  cleanupOldAlerts,
} from '../alert-service';
import type { AlertType, AlertContext } from '../alert-service';

// ============================================================================
// Arbitraries
// ============================================================================

const ALL_ALERT_TYPES: AlertType[] = [
  'SIMULTANEOUS_LOGIN',
  'SUSPICIOUS_IP',
  'IMPOSSIBLE_TRAVEL',
  'RATE_LIMIT_EXCEEDED',
  'PRICE_CHANGE_LIMIT',
  'REFUND_LIMIT_EXCEEDED',
  'NEW_DEVICE',
  'BLOCKED_DEVICE',
  'DEVICE_MISMATCH',
  'UNAUTHORIZED_TERMINAL_ACCESS',
];

const alertTypeArb = fc.constantFrom<AlertType>(...ALL_ALERT_TYPES);
const tenantIdArb = fc.uuid();
const employeeIdArb = fc.uuid();
const alertIdArb = fc.uuid();

const reasonArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter(
    (s) =>
      s.trim().length > 0 &&
      !s.includes('__proto__') &&
      !s.includes('constructor') &&
      !s.includes('prototype')
  );

const ipAddressArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const alertContextArb: fc.Arbitrary<AlertContext> = fc.record({
  employeeId: employeeIdArb,
  alertType: alertTypeArb,
  reason: reasonArb,
  ipAddress: fc.option(ipAddressArb, { nil: undefined }),
  location: fc.option(
    fc.record({
      lat: fc.double({ min: -90, max: 90, noNaN: true }),
      lng: fc.double({ min: -180, max: 180, noNaN: true }),
    }),
    { nil: undefined }
  ),
});

// ============================================================================
// Helpers
// ============================================================================

function makeContext(overrides?: Partial<AlertContext>): AlertContext {
  return {
    employeeId: 'emp-1',
    alertType: 'SIMULTANEOUS_LOGIN',
    reason: 'Duplicate login detected',
    ...overrides,
  };
}

function makeAlert(overrides?: Record<string, unknown>) {
  return {
    id: 'alert-1',
    tenant_id: 'tenant-1',
    employee_id: 'emp-1',
    alert_type: 'SIMULTANEOUS_LOGIN',
    reason: 'Test',
    ip_address: null,
    location_lat: null,
    location_lng: null,
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    resolution_notes: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Unit Tests
// ============================================================================

describe('Alert Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- createAlert ----------
  describe('createAlert', () => {
    it('creates an alert and returns the alertId', async () => {
      vi.mocked(prisma.session_alerts.create).mockResolvedValue({} as never);

      const ctx = makeContext();
      const id = await createAlert('tenant-1', ctx);

      expect(id).toBe('alert-uuid-001');
      expect(prisma.session_alerts.create).toHaveBeenCalledTimes(1);
    });

    it('passes all fields to prisma.create', async () => {
      vi.mocked(prisma.session_alerts.create).mockResolvedValue({} as never);

      const ctx = makeContext({
        ipAddress: '192.168.1.1',
        location: { lat: -12.04, lng: -77.03 },
      });
      await createAlert('tenant-1', ctx);

      const createArg = vi.mocked(prisma.session_alerts.create).mock.calls[0][0] as any;
      expect(createArg.data.tenant_id).toBe('tenant-1');
      expect(createArg.data.employee_id).toBe('emp-1');
      expect(createArg.data.alert_type).toBe('SIMULTANEOUS_LOGIN');
      expect(createArg.data.reason).toBe('Duplicate login detected');
      expect(createArg.data.ip_address).toBe('192.168.1.1');
      expect(createArg.data.location_lat).toBe(-12.04);
      expect(createArg.data.location_lng).toBe(-77.03);
      expect(createArg.data.is_resolved).toBe(false);
    });

    it('handles missing optional fields', async () => {
      vi.mocked(prisma.session_alerts.create).mockResolvedValue({} as never);

      const ctx = makeContext({ ipAddress: undefined, location: undefined });
      await createAlert('tenant-1', ctx);

      const createArg = vi.mocked(prisma.session_alerts.create).mock.calls[0][0] as any;
      expect(createArg.data.ip_address).toBeUndefined();
      expect(createArg.data.location_lat).toBeUndefined();
      expect(createArg.data.location_lng).toBeUndefined();
    });
  });

  // ---------- getUnresolvedAlerts ----------
  describe('getUnresolvedAlerts', () => {
    it('returns only unresolved alerts ordered by created_at desc', async () => {
      const alerts = [
        makeAlert({ id: 'a1', is_resolved: false }),
        makeAlert({ id: 'a2', is_resolved: false }),
      ];
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue(alerts as never);

      const result = await getUnresolvedAlerts('tenant-1');

      expect(result).toHaveLength(2);
      expect(prisma.session_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          is_resolved: false,
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('returns empty array when all alerts are resolved', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      const result = await getUnresolvedAlerts('tenant-1');

      expect(result).toEqual([]);
    });
  });

  // ---------- getEmployeeAlerts ----------
  describe('getEmployeeAlerts', () => {
    it('returns alerts for a specific employee with default limit', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([makeAlert()] as never);

      const result = await getEmployeeAlerts('tenant-1', 'emp-1');

      expect(result).toHaveLength(1);
      expect(prisma.session_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    it('respects custom limit', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      await getEmployeeAlerts('tenant-1', 'emp-1', 10);

      const callArg = vi.mocked(prisma.session_alerts.findMany).mock.calls[0][0] as any;
      expect(callArg.take).toBe(10);
    });
  });

  // ---------- resolveAlert ----------
  describe('resolveAlert', () => {
    it('marks an alert as resolved with resolver info', async () => {
      vi.mocked(prisma.session_alerts.update).mockResolvedValue({} as never);

      await resolveAlert('alert-1', 'admin-1', 'False positive');

      expect(prisma.session_alerts.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: {
          is_resolved: true,
          resolved_by: 'admin-1',
          resolved_at: expect.any(Date),
          resolution_notes: 'False positive',
        },
      });
    });

    it('handles missing notes', async () => {
      vi.mocked(prisma.session_alerts.update).mockResolvedValue({} as never);

      await resolveAlert('alert-1', 'admin-1');

      const updateArg = vi.mocked(prisma.session_alerts.update).mock.calls[0][0] as any;
      expect(updateArg.data.resolution_notes).toBeUndefined();
    });
  });

  // ---------- getAlertsByType ----------
  describe('getAlertsByType', () => {
    it('filters by alert type with default limit', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      await getAlertsByType('tenant-1', 'SUSPICIOUS_IP');

      expect(prisma.session_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: 'tenant-1',
          alert_type: 'SUSPICIOUS_IP',
        },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    });

    it('respects custom limit', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      await getAlertsByType('tenant-1', 'NEW_DEVICE', 5);

      const callArg = vi.mocked(prisma.session_alerts.findMany).mock.calls[0][0] as any;
      expect(callArg.take).toBe(5);
    });
  });

  // ---------- getAlertStats ----------
  describe('getAlertStats', () => {
    it('returns correct stats with mixed alerts', async () => {
      const alerts = [
        makeAlert({ alert_type: 'SIMULTANEOUS_LOGIN', is_resolved: false }),
        makeAlert({ alert_type: 'SIMULTANEOUS_LOGIN', is_resolved: true }),
        makeAlert({ alert_type: 'SUSPICIOUS_IP', is_resolved: false }),
        makeAlert({ alert_type: 'IMPOSSIBLE_TRAVEL', is_resolved: false }),
      ];
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue(alerts as never);

      const stats = await getAlertStats('tenant-1');

      expect(stats.total).toBe(4);
      expect(stats.unresolved).toBe(3);
      expect(stats.byType.SIMULTANEOUS_LOGIN).toBe(2);
      expect(stats.byType.SUSPICIOUS_IP).toBe(1);
      expect(stats.byType.IMPOSSIBLE_TRAVEL).toBe(1);
      expect(stats.byType.NEW_DEVICE).toBe(0);
    });

    it('returns zeroes for empty tenant', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      const stats = await getAlertStats('tenant-1');

      expect(stats.total).toBe(0);
      expect(stats.unresolved).toBe(0);
      for (const type of ALL_ALERT_TYPES) {
        expect(stats.byType[type]).toBe(0);
      }
    });

    it('counts all 10 alert types in byType', async () => {
      vi.mocked(prisma.session_alerts.findMany).mockResolvedValue([]);

      const stats = await getAlertStats('tenant-1');

      expect(Object.keys(stats.byType)).toHaveLength(10);
    });
  });

  // ---------- cleanupOldAlerts ----------
  describe('cleanupOldAlerts', () => {
    it('deletes resolved alerts older than 30 days', async () => {
      vi.mocked(prisma.session_alerts.deleteMany).mockResolvedValue({ count: 5 } as never);

      const count = await cleanupOldAlerts('tenant-1');

      expect(count).toBe(5);
      const deleteArg = vi.mocked(prisma.session_alerts.deleteMany).mock.calls[0][0] as any;
      expect(deleteArg.where.tenant_id).toBe('tenant-1');
      expect(deleteArg.where.is_resolved).toBe(true);
      expect(deleteArg.where.created_at.lt).toBeInstanceOf(Date);

      // The cutoff date should be approximately 30 days ago
      const cutoff = deleteArg.where.created_at.lt as Date;
      const daysDiff = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(29.9);
      expect(daysDiff).toBeLessThan(30.1);
    });

    it('returns 0 when no old alerts exist', async () => {
      vi.mocked(prisma.session_alerts.deleteMany).mockResolvedValue({ count: 0 } as never);

      const count = await cleanupOldAlerts('tenant-1');

      expect(count).toBe(0);
    });

    it('scopes cleanup to the given tenant_id', async () => {
      vi.mocked(prisma.session_alerts.deleteMany).mockResolvedValue({ count: 0 } as never);

      await cleanupOldAlerts('specific-tenant');

      const deleteArg = vi.mocked(prisma.session_alerts.deleteMany).mock.calls[0][0] as any;
      expect(deleteArg.where.tenant_id).toBe('specific-tenant');
    });
  });
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Alert Service - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Invariant 1: createAlert always sets is_resolved=false and uses the correct tenant_id.
   */
  it('Invariant 1: New alerts are always unresolved and scoped to tenant (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(tenantIdArb, alertContextArb, async (tenantId, ctx) => {
        vi.clearAllMocks();
        vi.mocked(prisma.session_alerts.create).mockResolvedValue({} as never);

        await createAlert(tenantId, ctx);

        const calls = vi.mocked(prisma.session_alerts.create).mock.calls;
        const createArg = calls[calls.length - 1][0] as any;
        expect(createArg.data.is_resolved).toBe(false);
        expect(createArg.data.tenant_id).toBe(tenantId);
        expect(createArg.data.employee_id).toBe(ctx.employeeId);
        expect(createArg.data.alert_type).toBe(ctx.alertType);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 2: getAlertStats.total always equals sum of all byType counts.
   */
  it('Invariant 2: stats.total === sum(byType) for any set of alerts (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            alert_type: alertTypeArb,
            is_resolved: fc.boolean(),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        async (alertSpecs) => {
          vi.clearAllMocks();
          const alerts = alertSpecs.map((spec, i) =>
            makeAlert({
              id: `alert-${i}`,
              alert_type: spec.alert_type,
              is_resolved: spec.is_resolved,
            })
          );

          vi.mocked(prisma.session_alerts.findMany).mockResolvedValue(alerts as never);

          const stats = await getAlertStats('tenant-1');

          // total === sum of all byType values
          const sumByType = Object.values(stats.byType).reduce((a, b) => a + b, 0);
          expect(stats.total).toBe(sumByType);

          // unresolved count matches
          const expectedUnresolved = alertSpecs.filter((s) => !s.is_resolved).length;
          expect(stats.unresolved).toBe(expectedUnresolved);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant 3: AlertType has exactly 10 known types.
   */
  it('Invariant 3: AlertType enumeration has exactly 10 types', () => {
    expect(ALL_ALERT_TYPES).toHaveLength(10);

    // Verify all types are unique
    const uniqueTypes = new Set(ALL_ALERT_TYPES);
    expect(uniqueTypes.size).toBe(10);
  });

  /**
   * Invariant 4: cleanupOldAlerts always scopes deletion to the given tenant_id
   * and only deletes resolved alerts.
   */
  it('Invariant 4: Cleanup is always tenant-scoped and only targets resolved alerts (50 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(tenantIdArb, async (tenantId) => {
        vi.clearAllMocks();
        vi.mocked(prisma.session_alerts.deleteMany).mockResolvedValue({ count: 0 } as never);

        await cleanupOldAlerts(tenantId);

        const calls = vi.mocked(prisma.session_alerts.deleteMany).mock.calls;
        const deleteArg = calls[calls.length - 1][0] as any;
        expect(deleteArg.where.tenant_id).toBe(tenantId);
        expect(deleteArg.where.is_resolved).toBe(true);
        expect(deleteArg.where.created_at.lt).toBeInstanceOf(Date);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Invariant 5: resolveAlert always sets is_resolved=true and resolved_at to a Date.
   */
  it('Invariant 5: Resolving an alert always sets is_resolved=true with a Date (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        alertIdArb,
        employeeIdArb,
        fc.option(reasonArb, { nil: undefined }),
        async (alertId, resolvedBy, notes) => {
          vi.clearAllMocks();
          vi.mocked(prisma.session_alerts.update).mockResolvedValue({} as never);

          await resolveAlert(alertId, resolvedBy, notes);

          const calls = vi.mocked(prisma.session_alerts.update).mock.calls;
          const updateArg = calls[calls.length - 1][0] as any;
          expect(updateArg.where.id).toBe(alertId);
          expect(updateArg.data.is_resolved).toBe(true);
          expect(updateArg.data.resolved_by).toBe(resolvedBy);
          expect(updateArg.data.resolved_at).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });
});
