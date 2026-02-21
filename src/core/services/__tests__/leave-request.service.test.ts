/**
 * LeaveRequestService Unit Tests
 *
 * Tests the LeaveRequestService with mocked Prisma client.
 * Verifies business rules, tenant isolation, event emission, and validation.
 *
 * Covers:
 * - create: validation of dates, days_requested, employee existence
 * - approve: status transition from PENDING only
 * - reject: requires reason, status transition from PENDING only
 * - cancel: status transition from PENDING only
 * - getById: success and not found
 * - listByEmployee: filtering by status and leave_type
 * - getVacationBalance: Peru 30 days/year calculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeaveRequestService, PERU_VACATION_DAYS_PER_YEAR } from '../leave-request.service';
import type { CreateLeaveRequestInput } from '../leave-request.service';

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
  leave_requests: {
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
const REQUEST_ID = '00000000-aaaa-bbbb-cccc-dddddddddddd';

function makeValidInput(overrides?: Partial<CreateLeaveRequestInput>): CreateLeaveRequestInput {
  return {
    employee_id: EMPLOYEE_ID,
    leave_type: 'VACATION',
    start_date: new Date('2026-03-01'),
    end_date: new Date('2026-03-10'),
    days_requested: 10,
    reason: 'Family trip',
    with_pay: true,
    created_by: ACTOR_ID,
    ...overrides,
  };
}

function makeLeaveRequestRecord(overrides?: Record<string, any>): Record<string, any> {
  return {
    id: REQUEST_ID,
    tenant_id: TENANT_ID,
    employee_id: EMPLOYEE_ID,
    leave_type: 'VACATION',
    start_date: new Date('2026-03-01'),
    end_date: new Date('2026-03-10'),
    days_requested: 10,
    reason: 'Family trip',
    with_pay: true,
    status: 'PENDING',
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    certificate_url: null,
    created_at: new Date('2026-02-19'),
    updated_at: new Date('2026-02-19'),
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
    base_salary_cents: 200000,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;

  beforeEach(() => {
    service = new LeaveRequestService(mockPrisma);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // create
  // ==========================================================================

  describe('create', () => {
    it('creates a leave request with valid data', async () => {
      const input = makeValidInput();

      mockTx.employees.findFirst.mockResolvedValue(makeEmployeeRecord());
      mockTx.leave_requests.create.mockImplementation(({ data }: any) => ({
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
        expect(result.data.leave_type).toBe('VACATION');
        expect(result.data.days_requested).toBe(10);
        expect(result.data.status).toBe('PENDING');
        expect(result.data.with_pay).toBe(true);
      }

      expect(mockTx.leave_requests.create).toHaveBeenCalledTimes(1);
      expect(mockTx.events.create).toHaveBeenCalledTimes(1);
    });

    it('fails when employee not found', async () => {
      mockTx.employees.findFirst.mockResolvedValue(null);

      const result = await service.create(TENANT_ID, makeValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('fails when employee is not active', async () => {
      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ is_active: false }),
      );

      const result = await service.create(TENANT_ID, makeValidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('not active');
      }
    });

    it('fails when start_date > end_date', async () => {
      const result = await service.create(TENANT_ID, makeValidInput({
        start_date: new Date('2026-03-15'),
        end_date: new Date('2026-03-01'),
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Start date');
      }
    });

    it('fails when days_requested <= 0', async () => {
      const result = await service.create(TENANT_ID, makeValidInput({
        days_requested: 0,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('greater than 0');
      }
    });

    it('fails when days_requested is negative', async () => {
      const result = await service.create(TENANT_ID, makeValidInput({
        days_requested: -5,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when days_requested is not integer', async () => {
      const result = await service.create(TENANT_ID, makeValidInput({
        days_requested: 5.5,
      }));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('integer');
      }
    });

    it('creates with default with_pay=true when not specified', async () => {
      const input = makeValidInput({ with_pay: undefined });

      mockTx.employees.findFirst.mockResolvedValue(makeEmployeeRecord());
      mockTx.leave_requests.create.mockImplementation(({ data }: any) => ({
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.create(TENANT_ID, input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.with_pay).toBe(true);
      }
    });
  });

  // ==========================================================================
  // approve
  // ==========================================================================

  describe('approve', () => {
    it('approves a PENDING request successfully', async () => {
      const record = makeLeaveRequestRecord({ status: 'PENDING' });
      mockTx.leave_requests.findFirst.mockResolvedValue(record);
      mockTx.leave_requests.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.approve(TENANT_ID, REQUEST_ID, ACTOR_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('APPROVED');
        expect(result.data.approved_by).toBe(ACTOR_ID);
        expect(result.data.approved_at).toBeDefined();
      }

      expect(mockTx.events.create).toHaveBeenCalledTimes(1);
    });

    it('fails when request is not PENDING', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(
        makeLeaveRequestRecord({ status: 'APPROVED' }),
      );

      const result = await service.approve(TENANT_ID, REQUEST_ID, ACTOR_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('APPROVED');
      }
    });

    it('fails when request not found', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(null);

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
    it('rejects a PENDING request with reason', async () => {
      const record = makeLeaveRequestRecord({ status: 'PENDING' });
      mockTx.leave_requests.findFirst.mockResolvedValue(record);
      mockTx.leave_requests.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));
      mockTx.events.create.mockResolvedValue({});

      const result = await service.reject(TENANT_ID, REQUEST_ID, ACTOR_ID, 'Insufficient staff');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('REJECTED');
        expect(result.data.rejection_reason).toBe('Insufficient staff');
      }

      expect(mockTx.events.create).toHaveBeenCalledTimes(1);
    });

    it('fails when reason is empty', async () => {
      const result = await service.reject(TENANT_ID, REQUEST_ID, ACTOR_ID, '');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('Rejection reason');
      }
    });

    it('fails when reason is only whitespace', async () => {
      const result = await service.reject(TENANT_ID, REQUEST_ID, ACTOR_ID, '   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when request is not PENDING', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(
        makeLeaveRequestRecord({ status: 'REJECTED' }),
      );

      const result = await service.reject(TENANT_ID, REQUEST_ID, ACTOR_ID, 'Some reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when request not found', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(null);

      const result = await service.reject(TENANT_ID, 'nonexistent', ACTOR_ID, 'Reason');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // cancel
  // ==========================================================================

  describe('cancel', () => {
    it('cancels a PENDING request successfully', async () => {
      const record = makeLeaveRequestRecord({ status: 'PENDING' });
      mockTx.leave_requests.findFirst.mockResolvedValue(record);
      mockTx.leave_requests.update.mockImplementation(({ data }: any) => ({
        ...record,
        ...data,
      }));

      const result = await service.cancel(TENANT_ID, REQUEST_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('CANCELLED');
      }
    });

    it('fails when request is not PENDING (APPROVED)', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(
        makeLeaveRequestRecord({ status: 'APPROVED' }),
      );

      const result = await service.cancel(TENANT_ID, REQUEST_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('APPROVED');
      }
    });

    it('fails when request is not PENDING (REJECTED)', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(
        makeLeaveRequestRecord({ status: 'REJECTED' }),
      );

      const result = await service.cancel(TENANT_ID, REQUEST_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('fails when request not found', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(null);

      const result = await service.cancel(TENANT_ID, 'nonexistent');

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
    it('returns the leave request when found', async () => {
      const record = makeLeaveRequestRecord();
      mockTx.leave_requests.findFirst.mockResolvedValue(record);

      const result = await service.getById(TENANT_ID, REQUEST_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(REQUEST_ID);
        expect(result.data.tenant_id).toBe(TENANT_ID);
        expect(result.data.employee_id).toBe(EMPLOYEE_ID);
      }
    });

    it('returns NOT_FOUND when request does not exist', async () => {
      mockTx.leave_requests.findFirst.mockResolvedValue(null);

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
    it('returns all leave requests for employee', async () => {
      const records = [
        makeLeaveRequestRecord({ id: 'req-1' }),
        makeLeaveRequestRecord({ id: 'req-2', leave_type: 'SICK_LEAVE' }),
      ];
      mockTx.leave_requests.findMany.mockResolvedValue(records);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('filters by status', async () => {
      mockTx.leave_requests.findMany.mockResolvedValue([
        makeLeaveRequestRecord({ status: 'APPROVED' }),
      ]);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID, {
        status: 'APPROVED',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].status).toBe('APPROVED');
      }

      // Verify the query included the status filter
      expect(mockTx.leave_requests.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
    });

    it('filters by leave_type', async () => {
      mockTx.leave_requests.findMany.mockResolvedValue([
        makeLeaveRequestRecord({ leave_type: 'SICK_LEAVE' }),
      ]);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID, {
        leave_type: 'SICK_LEAVE',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].leave_type).toBe('SICK_LEAVE');
      }

      expect(mockTx.leave_requests.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ leave_type: 'SICK_LEAVE' }),
        }),
      );
    });

    it('returns empty array when no results', async () => {
      mockTx.leave_requests.findMany.mockResolvedValue([]);

      const result = await service.listByEmployee(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // getVacationBalance
  // ==========================================================================

  describe('getVacationBalance', () => {
    it('calculates balance for employee with 1 year = 30 days', async () => {
      const hireDate = new Date();
      hireDate.setFullYear(hireDate.getFullYear() - 1);
      hireDate.setDate(hireDate.getDate() - 10); // slightly over 1 year

      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ hire_date: hireDate }),
      );
      mockTx.leave_requests.findMany.mockResolvedValue([]);

      const result = await service.getVacationBalance(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.years_of_service).toBe(1);
        expect(result.data.total_earned_days).toBe(30);
        expect(result.data.total_used_days).toBe(0);
        expect(result.data.available_days).toBe(30);
      }
    });

    it('deducts used vacation days', async () => {
      const hireDate = new Date();
      hireDate.setFullYear(hireDate.getFullYear() - 2);
      hireDate.setDate(hireDate.getDate() - 10); // slightly over 2 years

      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ hire_date: hireDate }),
      );
      mockTx.leave_requests.findMany.mockResolvedValue([
        { days_requested: 10 },
        { days_requested: 5 },
      ]);

      const result = await service.getVacationBalance(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.years_of_service).toBe(2);
        expect(result.data.total_earned_days).toBe(60);
        expect(result.data.total_used_days).toBe(15);
        expect(result.data.available_days).toBe(45);
      }
    });

    it('handles new employee with 0 years of service', async () => {
      const hireDate = new Date(); // hired today

      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ hire_date: hireDate }),
      );
      mockTx.leave_requests.findMany.mockResolvedValue([]);

      const result = await service.getVacationBalance(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.years_of_service).toBe(0);
        expect(result.data.total_earned_days).toBe(0);
        expect(result.data.available_days).toBe(0);
      }
    });

    it('returns NOT_FOUND when employee does not exist', async () => {
      mockTx.employees.findFirst.mockResolvedValue(null);

      const result = await service.getVacationBalance(TENANT_ID, 'nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('available days is never negative even when used > earned', async () => {
      const hireDate = new Date();
      hireDate.setFullYear(hireDate.getFullYear() - 1);
      hireDate.setDate(hireDate.getDate() - 10);

      mockTx.employees.findFirst.mockResolvedValue(
        makeEmployeeRecord({ hire_date: hireDate }),
      );
      // More days used than earned
      mockTx.leave_requests.findMany.mockResolvedValue([
        { days_requested: 20 },
        { days_requested: 20 },
      ]);

      const result = await service.getVacationBalance(TENANT_ID, EMPLOYEE_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.years_of_service).toBe(1);
        expect(result.data.total_earned_days).toBe(30);
        expect(result.data.total_used_days).toBe(40);
        expect(result.data.available_days).toBe(0); // max(0, 30 - 40) = 0
      }
    });
  });
});
