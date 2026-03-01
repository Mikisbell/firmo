/**
 * Tests for Rate Limiter Module
 *
 * Tests transaction limits, price change limits, refund limits,
 * limit CRUD operations, and audit logging.
 *
 * Uses vi.mock for Prisma and includes property-based tests
 * for limit enforcement invariants.
 *
 * @module core/security/__tests__/rate-limiter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock Prisma before importing module under test
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    transaction_limits: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    session_audit_log: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import prisma from '@/src/core/db/prisma';
import {
  getOrCreateLimits,
  checkTransactionLimit,
  checkPriceChangeLimit,
  checkRefundLimit,
  updateLimits,
  logAction,
} from '../rate-limiter';

// Configure fast-check
fc.configureGlobal({
  numRuns: 100,
  verbose: false,
});

// Arbitraries
const tenantIdArb = fc.uuid();
const employeeIdArb = fc.uuid();
const amountCentsArb = fc.integer({ min: 1, max: 500000 }); // 1 centavo to 5000 soles

// Default limits as returned by the service when creating
const DEFAULT_LIMITS = {
  id: 'limit-1',
  tenant_id: 'tenant-1',
  employee_id: 'emp-1',
  max_transactions_per_hour: 100,
  max_transactions_per_day: 500,
  max_amount_per_transaction: 100000, // 1000 soles in centavos
  max_price_changes_per_hour: 20,
  max_refunds_per_day: 10,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeLimits(overrides?: Partial<typeof DEFAULT_LIMITS>) {
  return { ...DEFAULT_LIMITS, ...overrides };
}

describe('Rate Limiter Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateLimits', () => {
    it('should return existing limits if found', async () => {
      const existing = makeLimits();
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(existing as never);

      const result = await getOrCreateLimits('tenant-1', 'emp-1');

      expect(result).toEqual(existing);
      expect(prisma.transaction_limits.create).not.toHaveBeenCalled();
    });

    it('should create default limits if none exist', async () => {
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(null);
      const created = makeLimits();
      vi.mocked(prisma.transaction_limits.create).mockResolvedValue(created as never);

      const result = await getOrCreateLimits('tenant-1', 'emp-1');

      expect(prisma.transaction_limits.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 'tenant-1',
          employee_id: 'emp-1',
          max_transactions_per_hour: 100,
          max_transactions_per_day: 500,
          max_amount_per_transaction: 100000,
          max_price_changes_per_hour: 20,
          max_refunds_per_day: 10,
        },
      });
      expect(result).toEqual(created);
    });

    it('should query with correct composite key', async () => {
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(makeLimits() as never);

      await getOrCreateLimits('t-abc', 'e-xyz');

      expect(prisma.transaction_limits.findUnique).toHaveBeenCalledWith({
        where: {
          tenant_id_employee_id: {
            tenant_id: 't-abc',
            employee_id: 'e-xyz',
          },
        },
      });
    });
  });

  describe('checkTransactionLimit', () => {
    it('should reject transactions exceeding max amount', async () => {
      const limits = makeLimits({ max_amount_per_transaction: 50000 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);

      const result = await checkTransactionLimit('t1', 'e1', 60000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('excede');
      expect(result.limit).toBe(50000);
    });

    it('should allow transactions within max amount', async () => {
      const limits = makeLimits({ max_amount_per_transaction: 100000 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

      const result = await checkTransactionLimit('t1', 'e1', 50000);

      expect(result.allowed).toBe(true);
    });

    it('should reject when hourly transaction limit reached', async () => {
      const limits = makeLimits({ max_transactions_per_hour: 10 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      // First count call = hourly check, returns 10 (at limit)
      vi.mocked(prisma.session_audit_log.count).mockResolvedValueOnce(10);

      const result = await checkTransactionLimit('t1', 'e1', 100);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('hora');
      expect(result.remaining).toBe(0);
    });

    it('should reject when daily transaction limit reached', async () => {
      const limits = makeLimits({
        max_transactions_per_hour: 100,
        max_transactions_per_day: 5,
      });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      // Hourly check passes (2 < 100)
      vi.mocked(prisma.session_audit_log.count)
        .mockResolvedValueOnce(2) // hourly: OK
        .mockResolvedValueOnce(5); // daily: at limit

      const result = await checkTransactionLimit('t1', 'e1', 100);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('día');
      expect(result.remaining).toBe(0);
    });

    it('should return remaining count when allowed', async () => {
      const limits = makeLimits({ max_transactions_per_hour: 100 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count)
        .mockResolvedValueOnce(30) // hourly: 30 of 100
        .mockResolvedValueOnce(50); // daily: 50 of 500

      const result = await checkTransactionLimit('t1', 'e1', 100);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(70); // 100 - 30
      expect(result.limit).toBe(100);
    });

    it('should check amount limit before count limits', async () => {
      const limits = makeLimits({ max_amount_per_transaction: 1000 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);

      const result = await checkTransactionLimit('t1', 'e1', 2000);

      expect(result.allowed).toBe(false);
      // Should not have queried audit log (amount check is first)
      expect(prisma.session_audit_log.count).not.toHaveBeenCalled();
    });

    it('should count only TRANSACTION actions in audit log', async () => {
      const limits = makeLimits();
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

      await checkTransactionLimit('t1', 'e1', 100);

      // Both hourly and daily counts should filter by action: TRANSACTION
      const calls = vi.mocked(prisma.session_audit_log.count).mock.calls;
      expect(calls.length).toBe(2);
      expect(calls[0][0]?.where?.action).toBe('TRANSACTION');
      expect(calls[1][0]?.where?.action).toBe('TRANSACTION');
    });
  });

  describe('checkPriceChangeLimit', () => {
    it('should allow price changes within limit', async () => {
      const limits = makeLimits({ max_price_changes_per_hour: 20 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(5);

      const result = await checkPriceChangeLimit('t1', 'e1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15); // 20 - 5
      expect(result.limit).toBe(20);
    });

    it('should reject price changes when limit reached', async () => {
      const limits = makeLimits({ max_price_changes_per_hour: 10 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(10);

      const result = await checkPriceChangeLimit('t1', 'e1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('precio');
      expect(result.remaining).toBe(0);
    });

    it('should reject price changes when over limit', async () => {
      const limits = makeLimits({ max_price_changes_per_hour: 5 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(8);

      const result = await checkPriceChangeLimit('t1', 'e1');

      expect(result.allowed).toBe(false);
    });

    it('should count only PRICE_CHANGE actions', async () => {
      const limits = makeLimits();
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

      await checkPriceChangeLimit('t1', 'e1');

      const call = vi.mocked(prisma.session_audit_log.count).mock.calls[0][0];
      expect(call?.where?.action).toBe('PRICE_CHANGE');
    });
  });

  describe('checkRefundLimit', () => {
    it('should allow refunds within daily limit', async () => {
      const limits = makeLimits({ max_refunds_per_day: 10 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(3);

      const result = await checkRefundLimit('t1', 'e1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 3
      expect(result.limit).toBe(10);
    });

    it('should reject refunds when daily limit reached', async () => {
      const limits = makeLimits({ max_refunds_per_day: 5 });
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(5);

      const result = await checkRefundLimit('t1', 'e1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('devoluciones');
      expect(result.remaining).toBe(0);
    });

    it('should count only REFUND actions', async () => {
      const limits = makeLimits();
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

      await checkRefundLimit('t1', 'e1');

      const call = vi.mocked(prisma.session_audit_log.count).mock.calls[0][0];
      expect(call?.where?.action).toBe('REFUND');
    });

    it('should filter by start of today for daily count', async () => {
      const limits = makeLimits();
      vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
      vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

      await checkRefundLimit('t1', 'e1');

      const call = vi.mocked(prisma.session_audit_log.count).mock.calls[0][0] as any;
      const gteDate = call?.where?.created_at?.gte as Date;

      // Should be start of today
      expect(gteDate.getHours()).toBe(0);
      expect(gteDate.getMinutes()).toBe(0);
      expect(gteDate.getSeconds()).toBe(0);
    });
  });

  describe('updateLimits', () => {
    it('should upsert with correct composite key', async () => {
      vi.mocked(prisma.transaction_limits.upsert).mockResolvedValue(makeLimits() as never);

      await updateLimits('t1', 'e1', { max_refunds_per_day: 20 });

      expect(prisma.transaction_limits.upsert).toHaveBeenCalledWith({
        where: {
          tenant_id_employee_id: {
            tenant_id: 't1',
            employee_id: 'e1',
          },
        },
        update: {
          max_refunds_per_day: 20,
          updated_at: expect.any(Date),
        },
        create: {
          tenant_id: 't1',
          employee_id: 'e1',
          max_refunds_per_day: 20,
        },
      });
    });

    it('should pass partial updates correctly', async () => {
      vi.mocked(prisma.transaction_limits.upsert).mockResolvedValue(makeLimits() as never);

      await updateLimits('t1', 'e1', {
        max_transactions_per_hour: 200,
        max_amount_per_transaction: 50000,
      });

      const call = vi.mocked(prisma.transaction_limits.upsert).mock.calls[0][0];
      expect(call.update.max_transactions_per_hour).toBe(200);
      expect(call.update.max_amount_per_transaction).toBe(50000);
      expect(call.update.updated_at).toBeInstanceOf(Date);
    });

    it('should handle empty updates', async () => {
      vi.mocked(prisma.transaction_limits.upsert).mockResolvedValue(makeLimits() as never);

      await updateLimits('t1', 'e1', {});

      expect(prisma.transaction_limits.upsert).toHaveBeenCalled();
      const call = vi.mocked(prisma.transaction_limits.upsert).mock.calls[0][0];
      expect(call.update.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('logAction', () => {
    it('should create audit log with all fields', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as never);

      await logAction('t1', 'e1', 'REFUND', 'order-123', '192.168.1.1', { reason: 'customer request' });

      expect(prisma.session_audit_log.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 't1',
          employee_id: 'e1',
          action: 'REFUND',
          resource: 'order-123',
          ip_address: '192.168.1.1',
          details: { reason: 'customer request' },
        },
      });
    });

    it('should handle optional fields as undefined', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as never);

      await logAction('t1', 'e1', 'LOGIN');

      const callData = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0].data;
      expect(callData.resource).toBeUndefined();
      expect(callData.ip_address).toBeUndefined();
      expect(callData.details).toBeUndefined();
    });

    it('should always include tenant_id and employee_id', async () => {
      vi.mocked(prisma.session_audit_log.create).mockResolvedValue({} as never);

      await logAction('tenant-abc', 'emp-xyz', 'TRANSACTION');

      const callData = vi.mocked(prisma.session_audit_log.create).mock.calls[0][0].data;
      expect(callData.tenant_id).toBe('tenant-abc');
      expect(callData.employee_id).toBe('emp-xyz');
    });
  });

  describe('Property: Transaction amount limit enforcement', () => {
    it('should always reject amounts exceeding the max (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 1, max: 100000 }), // max limit
          async (tenantId, employeeId, maxAmount) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_amount_per_transaction: maxAmount,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);

            // Amount that exceeds the limit
            const overAmount = maxAmount + 1;
            const result = await checkTransactionLimit(tenantId, employeeId, overAmount);

            expect(result.allowed).toBe(false);
            expect(result.limit).toBe(maxAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always allow amounts at or below the max when counts are zero (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 1, max: 100000 }), // max limit
          async (tenantId, employeeId, maxAmount) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_amount_per_transaction: maxAmount,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

            // Amount at or below the limit
            const amount = fc.sample(fc.integer({ min: 1, max: maxAmount }), 1)[0];
            const result = await checkTransactionLimit(tenantId, employeeId, amount);

            expect(result.allowed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Rate limit remaining count is non-negative', () => {
    it('should never return negative remaining for transaction checks (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 10, max: 200 }), // hourly limit
          fc.integer({ min: 0, max: 200 }), // current count
          async (tenantId, employeeId, hourlyLimit, currentCount) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_transactions_per_hour: hourlyLimit,
              max_transactions_per_day: 10000, // large daily limit to not interfere
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            vi.mocked(prisma.session_audit_log.count)
              .mockResolvedValueOnce(currentCount) // hourly
              .mockResolvedValueOnce(0); // daily

            const result = await checkTransactionLimit(tenantId, employeeId, 1);

            if (result.remaining !== undefined) {
              expect(result.remaining).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never return negative remaining for price change checks (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 1, max: 100 }), // price change limit
          fc.integer({ min: 0, max: 100 }), // current count
          async (tenantId, employeeId, priceLimit, currentCount) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_price_changes_per_hour: priceLimit,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            vi.mocked(prisma.session_audit_log.count).mockResolvedValue(currentCount);

            const result = await checkPriceChangeLimit(tenantId, employeeId);

            if (result.remaining !== undefined) {
              expect(result.remaining).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never return negative remaining for refund checks (100 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 1, max: 50 }), // refund limit
          fc.integer({ min: 0, max: 50 }), // current count
          async (tenantId, employeeId, refundLimit, currentCount) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_refunds_per_day: refundLimit,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            vi.mocked(prisma.session_audit_log.count).mockResolvedValue(currentCount);

            const result = await checkRefundLimit(tenantId, employeeId);

            if (result.remaining !== undefined) {
              expect(result.remaining).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Consistency between allowed and remaining', () => {
    it('should have remaining > 0 when allowed is true for transactions (50 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 10, max: 200 }),
          async (tenantId, employeeId, hourlyLimit) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_transactions_per_hour: hourlyLimit,
              max_transactions_per_day: 10000,
              max_amount_per_transaction: 999999,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            // Well below the limit
            vi.mocked(prisma.session_audit_log.count).mockResolvedValue(0);

            const result = await checkTransactionLimit(tenantId, employeeId, 1);

            if (result.allowed) {
              expect(result.remaining).toBeDefined();
              expect(result.remaining!).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have remaining === 0 when allowed is false due to count limit (50 runs)', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          employeeIdArb,
          fc.integer({ min: 1, max: 50 }),
          async (tenantId, employeeId, refundLimit) => {
            const limits = makeLimits({
              tenant_id: tenantId,
              employee_id: employeeId,
              max_refunds_per_day: refundLimit,
            });
            vi.mocked(prisma.transaction_limits.findUnique).mockResolvedValue(limits as never);
            // At or above the limit
            vi.mocked(prisma.session_audit_log.count).mockResolvedValue(refundLimit);

            const result = await checkRefundLimit(tenantId, employeeId);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
