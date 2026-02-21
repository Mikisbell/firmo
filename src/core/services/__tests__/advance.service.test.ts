/**
 * AdvanceService Unit Tests
 *
 * Tests the AdvanceService with mocked Prisma client.
 * Verifies business rules, tenant isolation, event emission, and validation.
 *
 * Covers:
 * - request: validation of amount, employee existence, 50% salary cap
 * - approve: status transition from PENDING only
 * - reject: requires reason, status transition from PENDING only
 * - markAsPaid: status transition from APPROVED only
 * - getById: success and not found
 * - listByEmployee: with and without status filter
 * - getPendingTotal: sums APPROVED advances
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdvanceService, MAX_ADVANCE_SALARY_PERCENTAGE } from '../advance.service';
import type { RequestAdvanceInput } from '../advance.service';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (prisma: any, operation: any, _opts?: any) => {
    try {
      const result = await operation(prisma._mockTx || mockTx);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

// Shared mock transaction client
const mockTx: any = {
  employees: {
    findFirst: vi.fn(),
  },
  advances: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  events: {
    create: vi.fn(),
  },
};

// Mock PrismaClient that delegates reads to mockTx
const mockPrisma: any = {
  ...mockTx,
  _mockTx: mockTx,
};

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = '11111111-2222-3333-4444-555555555555';
const ACTOR_ID = '99999999-8888-7777-6666-555555555555';
const ADVANCE_ID = '00000000-aaaa-bbbb-cccc-dddddddddddd';
const BASE_SALARY = 200000; // S/2,000.00

function makeValidInput(overrides?: Partial<RequestAdvanceInput>): RequestAdvanceInput {
  return {
    employee_id: EMPLOYEE_ID,
    amount_cents: 50000, // S/500.00 (25% of 200000)
    reason: 'Emergency expense',
    requested_by: ACTOR_ID,
    ...overrides,
  };
}

function makeAdvanceRecord(overrides?: Record<string, any>): Record<string, any> {
  return {
    id: ADVANCE_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    amount_cents: 50000,
    reason: 'Emergency expense',
    status: 'PENDING',
    approved_by: null,
    approved_at: null,
    paid_at: null,
    deducted_from_payroll: null,
    rejection_reason: null,
    created_at: new Date('2026-02-19'),
    ...overrides,
  };
}

function makeEmployeeRecord(overrides?: Record<string, any>): Record<string, any> {
  return {
    id: EMPLOYEE_ID,
    tenant_id: TENANT_ID,
    name: 'Juan Perez',
    is_active: true,
    hire_date: new Date('2024-01-15'),
    base_salary_cents: BASE_SALARY,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('AdvanceService', () => {
  let service: AdvanceService;

  beforeEach(() => {
    service = new AdvanceService(mockPrisma);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // request
  // ==========================================================================

  describe('request', () => {
    it('creates an advance request with valid data', async () => {
      const input = makeValidInput();

      mockTx.employees.findFirst.mockResolvedValue(makeEmployeeRecord());
      mockTx.advances.create.mockImplementation(({ data }: any) => ({
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.request(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.amount_cents).toBe(50000);
        expect(result.data.reason).toBe('Emergency expense');
        expect(result.data.status).toBe('PENDING');
      }

      expect(mockTx.advances.create).toHaveBeenCalledTimes(1);
      expect(mockTx.events.create).toHaveBeenCalledTimes(1);
    });

    it('fails when employee not found', async () => {
      mockTx.employees.findFirst.mockResolvedValue(null);

      const result = await service.request(TENANT_ID, makeValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('fails when employee is not active', async () => {
      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ is_active: false }),
      );

      const result = await service.request(TENANT_ID, makeValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('not active');
      }
    });

    it('fails when amount <= 0', async () => {
      const result = await service.request(TENANT_ID, makeValidInput({
        amount_cents: 0,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('greater than 0');
      }
    });

    it('fails when amount is negative', async () => {
      const result = await service.request(TENANT_ID, makeValidInput({
        amount_cents: -1000,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when amount > 50% of salary', async () => {
      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ base_salary_cents: 200000 }),
      );

      const result = await service.request(TENANT_ID, makeValidInput({
        amount_cents: 150000, // 75% of 200000
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('50%');
      }
    });

    it('succeeds when amount is exactly 50% of salary', async () => {
      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ base_salary_cents: 200000 }),
      );
      mockTx.advances.create.mockImplementation(({ data }: any) => ({
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.request(TENANT_ID, makeValidInput({
        amount_cents: 100000, // exactly 50% of 200000
      }));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount_cents).toBe(100000);
      }
    });

    it('fails when amount is not integer', async () => {
      const result = await service.request(TENANT_ID, makeValidInput({
        amount_cents: 50000.5,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('integer');
      }
    });
  });

  // ==========================================================================
  // approve
  // ==========================================================================

  describe('approve', () => {
    it('approves a PENDING advance successfully', async () => {
      const record = makeAdvanceRecord({ status: 'PENDING' });
      mockTx.advances.findFirst.mockResolvedValue(record);
      mockTx.advances.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.approve(TENANT_ID, ADVANCE_ID, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('APPROVED');
        expect(result.data.approved_by).toBe(ACTOR_ID);
        expect(result.data.approved_at).toBeDefined();
      }

      expect(mockTx.events.create).toHaveBeenCalledTimes(1);
    });

    it('fails when advance is not PENDING', async () => {
      mockTx.advances.findFirst.mockResolvedValue(
        makeAdvanceRecord({ status: 'APPROVED' }),
      );

      const result = await service.approve(TENANT_ID, ADVANCE_ID, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('APPROVED');
      }
    });

    it('fails when advance not found', async () => {
      mockTx.advances.findFirst.mockResolvedValue(null);

      const result = await service.approve(TENANT_ID, 'nonexistent', ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // reject
  // ==========================================================================

  describe('reject', () => {
    it('rejects a PENDING advance with reason', async () => {
      const record = makeAdvanceRecord({ status: 'PENDING' });
      mockTx.advances.findFirst.mockResolvedValue(record);
      mockTx.advances.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));

      const result = await service.reject(TENANT_ID, ADVANCE_ID, ACTOR_ID, 'Budget exceeded');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('REJECTED');
        expect(result.data.rejection_reason).toBe('Budget exceeded');
      }
    });

    it('fails when reason is empty', async () => {
      const result = await service.reject(TENANT_ID, ADVANCE_ID, ACTOR_ID, '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Rejection reason');
      }
    });

    it('fails when advance is not PENDING', async () => {
      mockTx.advances.findFirst.mockResolvedValue(
        makeAdvanceRecord({ status: 'PAID' }),
      );

      const result = await service.reject(TENANT_ID, ADVANCE_ID, ACTOR_ID, 'Some reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when advance not found', async () => {
      mockTx.advances.findFirst.mockResolvedValue(null);

      const result = await service.reject(TENANT_ID, 'nonexistent', ACTOR_ID, 'Reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // markAsPaid
  // ==========================================================================

  describe('markAsPaid', () => {
    it('marks an APPROVED advance as PAID', async () => {
      const record = makeAdvanceRecord({ status: 'APPROVED' });
      mockTx.advances.findFirst.mockResolvedValue(record);
      mockTx.advances.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));

      const result = await service.markAsPaid(TENANT_ID, ADVANCE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PAID');
        expect(result.data.paid_at).toBeDefined();
      }
    });

    it('fails when advance is not APPROVED (PENDING)', async () => {
      mockTx.advances.findFirst.mockResolvedValue(
        makeAdvanceRecord({ status: 'PENDING' }),
      );

      const result = await service.markAsPaid(TENANT_ID, ADVANCE_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('PENDING');
      }
    });

    it('fails when advance is not APPROVED (REJECTED)', async () => {
      mockTx.advances.findFirst.mockResolvedValue(
        makeAdvanceRecord({ status: 'REJECTED' }),
      );

      const result = await service.markAsPaid(TENANT_ID, ADVANCE_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when advance not found', async () => {
      mockTx.advances.findFirst.mockResolvedValue(null);

      const result = await service.markAsPaid(TENANT_ID, 'nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // getById
  // ==========================================================================

  describe('getById', () => {
    it('returns the advance when found', async () => {
      const record = makeAdvanceRecord();
      mockTx.advances.findFirst.mockResolvedValue(record);

      const result = await service.getById(TENANT_ID, ADVANCE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(ADVANCE_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.amount_cents).toBe(50000);
      }
    });

    it('returns NOT_FOUND when advance does not exist', async () => {
      mockTx.advances.findFirst.mockResolvedValue(null);

      const result = await service.getById(TENANT_ID, 'nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // listByEmployee
  // ==========================================================================

  describe('listByEmployee', () => {
    it('returns all advances for employee', async () => {
      const records = [
        makeAdvanceRecord({ id: 'adv-1', amount_cents: 30000 }),
        makeAdvanceRecord({ id: 'adv-2', amount_cents: 50000 }),
      ];
      mockTx.advances.findMany.mockResolvedValue(records);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('filters by status', async () => {
      mockTx.advances.findMany.mockResolvedValue([
        makeAdvanceRecord({ status: 'APPROVED' }),
      ]);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID, {
        status: 'APPROVED',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('APPROVED');
      }

      expect(mockTx.advances.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });

    it('returns empty array when no advances exist', async () => {
      mockTx.advances.findMany.mockResolvedValue([]);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // getPendingTotal
  // ==========================================================================

  describe('getPendingTotal', () => {
    it('sums all APPROVED advance amounts', async () => {
      mockTx.advances.findMany.mockResolvedValue([
        { amount_cents: 30000 },
        { amount_cents: 20000 },
        { amount_cents: 10000 },
      ]);

      const result = await service.getPendingTotal(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(60000);
      }

      // Verify we queried only APPROVED
      expect(mockTx.advances.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });

    it('returns 0 when no approved advances', async () => {
      mockTx.advances.findMany.mockResolvedValue([]);

      const result = await service.getPendingTotal(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(0);
      }
    });
  });
});
