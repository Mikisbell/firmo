/**
 * ContingencyManager Unit Tests — Prisma-backed persistence
 *
 * Tests the refactored ContingencyManager that uses Prisma instead of
 * in-memory state. Verifies:
 * - Activate persists to DB
 * - Register invoice persists + increments pending_count
 * - Deactivate persists
 * - Reconcile updates DB + decrements pending_count
 * - State survives "restart" (new instance reads from DB)
 * - Urgent reconciliations query
 * - Overdue invoices query
 * - Cannot deactivate with overdue invoices
 *
 * @module core/integrations/sunat/__tests__/contingency.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContingencyManager } from '../contingency';
import type { ContingencyReason } from '../contingency';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ============================================================================
// Mock Prisma Factory
// ============================================================================

const TENANT_ID = 'tenant-test-001';
const CONTINGENCY_ID = 'contingency-001';
const INVOICE_ID = 'invoice-001';
const USER_ID = 'user-001';

function createMockPrisma() {
  // In-memory stores for simulating Prisma behavior
  let contingencies: any[] = [];
  let contingencyInvoices: any[] = [];
  let idCounter = 0;

  const generateId = () => `mock-id-${++idCounter}`;

  const mockContingency = {
    findFirst: vi.fn().mockImplementation(({ where }: any) => {
      return contingencies.find((c) => {
        let match = true;
        if (where.tenant_id !== undefined) match = match && c.tenant_id === where.tenant_id;
        if (where.active !== undefined) match = match && c.active === where.active;
        if (where.id !== undefined) match = match && c.id === where.id;
        return match;
      }) ?? null;
    }),
    create: vi.fn().mockImplementation(({ data }: any) => {
      const record = {
        id: generateId(),
        ...data,
        created_at: data.created_at ?? new Date(),
      };
      contingencies.push(record);
      return record;
    }),
    update: vi.fn().mockImplementation(({ where, data }: any) => {
      const record = contingencies.find((c) => c.id === where.id);
      if (!record) throw new Error(`Contingency not found: ${where.id}`);
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
          // Handle Prisma increment/decrement operations
          const op = value as Record<string, number>;
          if ('increment' in op) {
            (record as any)[key] = ((record as any)[key] || 0) + op.increment;
          } else if ('decrement' in op) {
            (record as any)[key] = Math.max(0, ((record as any)[key] || 0) - op.decrement);
          } else {
            (record as any)[key] = value;
          }
        } else {
          (record as any)[key] = value;
        }
      }
      return record;
    }),
  };

  const mockContingencyInvoices = {
    findFirst: vi.fn().mockImplementation(({ where }: any) => {
      return contingencyInvoices.find((ci) => {
        let match = true;
        if (where.tenant_id !== undefined) match = match && ci.tenant_id === where.tenant_id;
        if (where.invoice_id !== undefined) match = match && ci.invoice_id === where.invoice_id;
        if (where.reconciled_at === null) match = match && ci.reconciled_at === null;
        if (where.id !== undefined) match = match && ci.id === where.id;
        return match;
      }) ?? null;
    }),
    create: vi.fn().mockImplementation(({ data }: any) => {
      const record = {
        id: generateId(),
        ...data,
        reconciled_at: data.reconciled_at ?? null,
        created_at: data.created_at ?? new Date(),
      };
      contingencyInvoices.push(record);
      return record;
    }),
    update: vi.fn().mockImplementation(({ where, data }: any) => {
      const record = contingencyInvoices.find((ci) => ci.id === where.id);
      if (!record) throw new Error(`Contingency invoice not found: ${where.id}`);
      Object.assign(record, data);
      return record;
    }),
    findMany: vi.fn().mockImplementation(({ where }: any) => {
      return contingencyInvoices.filter((ci) => {
        let match = true;
        if (where.tenant_id !== undefined) match = match && ci.tenant_id === where.tenant_id;
        if (where.reconciled_at === null) match = match && ci.reconciled_at === null;
        if (where.reconcile_by) {
          if (where.reconcile_by.lte) match = match && new Date(ci.reconcile_by) <= new Date(where.reconcile_by.lte);
          if (where.reconcile_by.lt) match = match && new Date(ci.reconcile_by) < new Date(where.reconcile_by.lt);
        }
        return match;
      });
    }),
  };

  const mockPrisma = {
    sunat_contingency: mockContingency,
    sunat_contingency_invoices: mockContingencyInvoices,
    $transaction: vi.fn().mockImplementation(async (operations: any[]) => {
      // Execute all operations (they are promises from mock fns)
      const results = [];
      for (const op of operations) {
        results.push(await op);
      }
      return results;
    }),
    // Expose for test assertions
    _stores: { contingencies, contingencyInvoices },
    _reset: () => {
      contingencies = [];
      contingencyInvoices = [];
      idCounter = 0;
      // Re-bind stores reference after reset
      (mockPrisma as any)._stores = { contingencies, contingencyInvoices };
    },
  };

  return mockPrisma;
}

// ============================================================================
// Tests
// ============================================================================

describe('ContingencyManager (Prisma-backed)', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let manager: ContingencyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    manager = new ContingencyManager(mockPrisma as any);
  });

  // ========================================================================
  // Activation
  // ========================================================================

  describe('activate', () => {
    it('should persist contingency state to DB', async () => {
      const state = await manager.activate(
        TENANT_ID,
        'SUNAT_UNREACHABLE',
        USER_ID,
      );

      expect(state.active).toBe(true);
      expect(state.reason).toBe('SUNAT_UNREACHABLE');
      expect(state.activatedBy).toBe(USER_ID);
      expect(state.pendingCount).toBe(0);
      expect(state.autoActivated).toBe(false);
      expect(state.tenantId).toBe(TENANT_ID);

      // Verify Prisma create was called
      expect(mockPrisma.sunat_contingency.create).toHaveBeenCalledTimes(1);
      const createCall = mockPrisma.sunat_contingency.create.mock.calls[0][0];
      expect(createCall.data.tenant_id).toBe(TENANT_ID);
      expect(createCall.data.reason).toBe('SUNAT_UNREACHABLE');
      expect(createCall.data.active).toBe(true);
    });

    it('should set auto_activated flag when auto-triggered', async () => {
      const state = await manager.activate(
        TENANT_ID,
        'NETWORK_OUTAGE',
        undefined,
        true,
      );

      expect(state.autoActivated).toBe(true);
      const createCall = mockPrisma.sunat_contingency.create.mock.calls[0][0];
      expect(createCall.data.auto_activated).toBe(true);
    });

    it('should return existing state if already active', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);
      const state2 = await manager.activate(TENANT_ID, 'NETWORK_OUTAGE', USER_ID);

      // Should NOT create a new record
      expect(mockPrisma.sunat_contingency.create).toHaveBeenCalledTimes(1);
      expect(state2.reason).toBe('SUNAT_UNREACHABLE'); // Original reason kept
    });
  });

  // ========================================================================
  // Deactivation
  // ========================================================================

  describe('deactivate', () => {
    it('should persist deactivation to DB', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);
      const result = await manager.deactivate(TENANT_ID);

      expect(result).toBe(true);
      expect(mockPrisma.sunat_contingency.update).toHaveBeenCalled();

      const updateCall = mockPrisma.sunat_contingency.update.mock.calls[0][0];
      expect(updateCall.data.active).toBe(false);
      expect(updateCall.data.deactivated_at).toBeInstanceOf(Date);
    });

    it('should return false if no active contingency', async () => {
      const result = await manager.deactivate(TENANT_ID);
      expect(result).toBe(false);
    });

    it('should fail if overdue invoices exist', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      // Register an invoice with a past reconcile_by date
      const pastDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
        issuedAt: pastDate,
      });

      const result = await manager.deactivate(TENANT_ID);
      expect(result).toBe(false);
    });

    it('should allow forced deactivation even with overdue invoices', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      const pastDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
        issuedAt: pastDate,
      });

      const result = await manager.deactivate(TENANT_ID, { force: true });
      expect(result).toBe(true);
    });
  });

  // ========================================================================
  // isActive
  // ========================================================================

  describe('isActive', () => {
    it('should return false when no contingency exists', async () => {
      expect(await manager.isActive(TENANT_ID)).toBe(false);
    });

    it('should return true when contingency is active', async () => {
      await manager.activate(TENANT_ID, 'MANUAL_ACTIVATION', USER_ID);
      expect(await manager.isActive(TENANT_ID)).toBe(true);
    });

    it('should return false after deactivation', async () => {
      await manager.activate(TENANT_ID, 'MANUAL_ACTIVATION', USER_ID);
      await manager.deactivate(TENANT_ID);
      expect(await manager.isActive(TENANT_ID)).toBe(false);
    });
  });

  // ========================================================================
  // Register Contingency Invoice
  // ========================================================================

  describe('registerContingencyInvoice', () => {
    it('should persist invoice to DB and increment pending_count', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      const invoice = await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
      });

      expect(invoice.invoiceId).toBe(INVOICE_ID);
      expect(invoice.series).toBe('B001');
      expect(invoice.number).toBe('00000001');
      expect(invoice.reconciledAt).toBeNull();

      // reconcile_by should be 7 days from issuedAt
      const daysDiff =
        (invoice.reconcileBy.getTime() - invoice.issuedAt.getTime()) /
        (24 * 60 * 60 * 1000);
      expect(daysDiff).toBe(7);

      // Verify $transaction was called (create invoice + update pending_count)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw if no active contingency', async () => {
      await expect(
        manager.registerContingencyInvoice({
          tenantId: TENANT_ID,
          invoiceId: INVOICE_ID,
          series: 'B001',
          number: '00000001',
        }),
      ).rejects.toThrow('No active contingency');
    });

    it('should use custom issuedAt when provided', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      const customDate = new Date('2026-02-20T10:00:00Z');
      const invoice = await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
        issuedAt: customDate,
      });

      expect(invoice.issuedAt.getTime()).toBe(customDate.getTime());
      // reconcile_by = Feb 27
      const expected = new Date('2026-02-27T10:00:00Z');
      expect(invoice.reconcileBy.getTime()).toBe(expected.getTime());
    });
  });

  // ========================================================================
  // Mark Reconciled
  // ========================================================================

  describe('markReconciled', () => {
    it('should update reconciled_at in DB and decrement pending_count', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
      });

      const result = await manager.markReconciled(TENANT_ID, INVOICE_ID);
      expect(result).toBe(true);

      // Verify transaction was called with update + decrement
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return false if invoice not found', async () => {
      const result = await manager.markReconciled(TENANT_ID, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return false if already reconciled', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
      });

      // First reconciliation
      await manager.markReconciled(TENANT_ID, INVOICE_ID);

      // Second attempt should fail (reconciled_at is now set)
      const result = await manager.markReconciled(TENANT_ID, INVOICE_ID);
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // State Survives "Restart"
  // ========================================================================

  describe('state persistence across instances', () => {
    it('should read existing state from DB with a new instance', async () => {
      // Activate with first instance
      await manager.activate(TENANT_ID, 'CERTIFICATE_ERROR', USER_ID);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: INVOICE_ID,
        series: 'B001',
        number: '00000001',
      });

      // Create NEW instance with same Prisma mock (simulates restart)
      const manager2 = new ContingencyManager(mockPrisma as any);

      const state = await manager2.getState(TENANT_ID);
      expect(state).not.toBeNull();
      expect(state!.active).toBe(true);
      expect(state!.reason).toBe('CERTIFICATE_ERROR');

      // New instance can read pending invoices
      const pending = await manager2.getPendingInvoices(TENANT_ID);
      expect(pending.length).toBe(1);
      expect(pending[0].invoiceId).toBe(INVOICE_ID);
    });

    it('should allow operations from new instance after restart', async () => {
      await manager.activate(TENANT_ID, 'NETWORK_OUTAGE', USER_ID);

      // New instance
      const manager2 = new ContingencyManager(mockPrisma as any);

      // Should be able to deactivate from new instance
      const result = await manager2.deactivate(TENANT_ID);
      expect(result).toBe(true);

      // Verify it's actually deactivated
      const isActive = await manager2.isActive(TENANT_ID);
      expect(isActive).toBe(false);
    });
  });

  // ========================================================================
  // Get Pending Invoices
  // ========================================================================

  describe('getPendingInvoices', () => {
    it('should return only non-reconciled invoices', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'inv-1',
        series: 'B001',
        number: '00000001',
      });

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'inv-2',
        series: 'B001',
        number: '00000002',
      });

      // Reconcile first one
      await manager.markReconciled(TENANT_ID, 'inv-1');

      const pending = await manager.getPendingInvoices(TENANT_ID);
      expect(pending.length).toBe(1);
      expect(pending[0].invoiceId).toBe('inv-2');
    });

    it('should return empty array when no pending invoices', async () => {
      const pending = await manager.getPendingInvoices(TENANT_ID);
      expect(pending).toEqual([]);
    });
  });

  // ========================================================================
  // Urgent Reconciliations
  // ========================================================================

  describe('getUrgentReconciliations', () => {
    it('should return invoices with reconcile_by within threshold', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      // Invoice issued 6.5 days ago => reconcile_by is in ~12 hours
      const sixAndHalfDaysAgo = new Date(
        Date.now() - 6.5 * 24 * 60 * 60 * 1000,
      );

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'urgent-1',
        series: 'B001',
        number: '00000001',
        issuedAt: sixAndHalfDaysAgo,
      });

      // Invoice issued 1 day ago => reconcile_by is in 6 days
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'not-urgent-1',
        series: 'B001',
        number: '00000002',
        issuedAt: oneDayAgo,
      });

      const urgent = await manager.getUrgentReconciliations(TENANT_ID, 24);
      expect(urgent.length).toBe(1);
      expect(urgent[0].invoiceId).toBe('urgent-1');
    });

    it('should use default threshold of 24 hours', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      // Invoice expiring in 23 hours
      const issuedAt = new Date(
        Date.now() - (7 * 24 - 23) * 60 * 60 * 1000,
      );

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'inv-almost-due',
        series: 'B001',
        number: '00000001',
        issuedAt,
      });

      const urgent = await manager.getUrgentReconciliations(TENANT_ID);
      expect(urgent.length).toBe(1);
    });
  });

  // ========================================================================
  // Overdue Invoices
  // ========================================================================

  describe('getOverdueInvoices', () => {
    it('should return invoices past reconciliation deadline', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      // Invoice issued 8 days ago => reconcile_by was 1 day ago (overdue)
      const eightDaysAgo = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      );

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'overdue-1',
        series: 'B001',
        number: '00000001',
        issuedAt: eightDaysAgo,
      });

      // Invoice issued 1 day ago => not overdue
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'not-overdue-1',
        series: 'B001',
        number: '00000002',
        issuedAt: oneDayAgo,
      });

      const overdue = await manager.getOverdueInvoices(TENANT_ID);
      expect(overdue.length).toBe(1);
      expect(overdue[0].invoiceId).toBe('overdue-1');
    });

    it('should not return reconciled invoices even if past deadline', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      const eightDaysAgo = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      );

      await manager.registerContingencyInvoice({
        tenantId: TENANT_ID,
        invoiceId: 'overdue-reconciled',
        series: 'B001',
        number: '00000001',
        issuedAt: eightDaysAgo,
      });

      // Reconcile it
      await manager.markReconciled(TENANT_ID, 'overdue-reconciled');

      const overdue = await manager.getOverdueInvoices(TENANT_ID);
      expect(overdue.length).toBe(0);
    });
  });

  // ========================================================================
  // Increment Failure Count
  // ========================================================================

  describe('incrementFailureCount', () => {
    it('should increment failure_count on active contingency', async () => {
      await manager.activate(TENANT_ID, 'SUNAT_UNREACHABLE', USER_ID);

      await manager.incrementFailureCount(TENANT_ID);

      const state = await manager.getState(TENANT_ID);
      expect(state!.failureCount).toBe(1);
    });

    it('should be no-op if no active contingency', async () => {
      // Should not throw
      await manager.incrementFailureCount(TENANT_ID);
      expect(mockPrisma.sunat_contingency.update).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // No In-Memory State
  // ========================================================================

  describe('no in-memory state dependency', () => {
    it('should not have any private state arrays or singleton patterns', () => {
      // The refactored class has no pendingInvoices array
      const instance = manager as any;
      expect(instance.pendingInvoices).toBeUndefined();
      expect(instance.state).toBeUndefined();
      expect(instance.healthCheckTimer).toBeUndefined();
    });
  });
});
