/**
 * Payroll API Unit Tests
 * Tests for Payroll operations (calculate, history)
 * Requirements: HR payroll management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock service methods at module level using vi.hoisted() ───
const { mockCalculateForEmployee, mockCalculateMonthly, mockGetHistory } = vi.hoisted(() => ({
  mockCalculateForEmployee: vi.fn(),
  mockCalculateMonthly: vi.fn(),
  mockGetHistory: vi.fn(),
}));

// ─── Mock ALL dependencies BEFORE importing route handlers ───

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    payroll: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock admin auth middleware
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(async () => ({
    authorized: true,
    user: {
      id: 'test-admin-id',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      sessionId: 'test-session-id',
    },
  })),
}));

// Mock structured logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock PayrollService with class
vi.mock('@/src/core/services/payroll.service', () => ({
  PayrollService: class MockPayrollService {
    calculateForEmployee = mockCalculateForEmployee;
    calculateMonthly = mockCalculateMonthly;
    getHistory = mockGetHistory;
  },
}));

// ─── NOW import route handlers (after all mocks are registered) ───
import { POST as CALCULATE_POST } from '../calculate/route';
import { GET as HISTORY_GET } from '../[employeeId]/route';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567891';

function createMockRequest(body: any, method: string = 'POST'): NextRequest {
  const url = 'http://localhost:3000/api/hr/payroll/calculate';
  const init: RequestInit = {
    method,
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer test-token',
    },
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(url, init as any);
}

describe('Payroll API Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/hr/payroll/calculate - Calculate Payroll', () => {
    it('should calculate payroll for single employee', async () => {
      const calculateData = {
        period_month: '2026-03',
        employee_id: EMPLOYEE_ID,
      };

      const mockPayroll = {
        id: 'payroll-123',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        period_month: '2026-03',
        base_salary_cents: 250000, // S/. 2500.00
        worked_days: 30,
        total_earnings_cents: 250000,
        total_deductions_cents: 0,
        net_pay_cents: 250000,
        status: 'CALCULATED',
        created_at: new Date(),
      };

      mockCalculateForEmployee.mockResolvedValue({
        success: true,
        data: mockPayroll,
      });

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.employee_id).toBe(EMPLOYEE_ID);
      expect(data.period_month).toBe('2026-03');
      expect(data.net_pay_cents).toBe(250000);
    });

    it('should calculate payroll for all employees (batch)', async () => {
      const calculateData = {
        period_month: '2026-03',
      };

      const mockBatchResult = {
        period_month: '2026-03',
        total_employees: 5,
        successful: 5,
        failed: 0,
        payrolls: [
          { employee_id: 'emp-1', net_pay_cents: 250000 },
          { employee_id: 'emp-2', net_pay_cents: 300000 },
        ],
      };

      mockCalculateMonthly.mockResolvedValue({
        success: true,
        data: mockBatchResult,
      });

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.period_month).toBe('2026-03');
      expect(data.total_employees).toBe(5);
      expect(data.successful).toBe(5);
    });

    it('should reject invalid period format', async () => {
      const calculateData = {
        period_month: '2026/03', // Invalid format
        employee_id: EMPLOYEE_ID,
      };

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should reject missing period_month', async () => {
      const calculateData = {
        employee_id: EMPLOYEE_ID,
      };

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should return 404 when employee not found', async () => {
      const calculateData = {
        period_month: '2026-03',
        employee_id: EMPLOYEE_ID,
      };

      mockCalculateForEmployee.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 500 on service error', async () => {
      const calculateData = {
        period_month: '2026-03',
        employee_id: EMPLOYEE_ID,
      };

      mockCalculateForEmployee.mockResolvedValue({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database error',
        },
      });

      const request = createMockRequest(calculateData);
      const response = await CALCULATE_POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/hr/payroll/[employeeId] - Get Payroll History', () => {
    it('should return payroll history for employee', async () => {
      const mockHistory = [
        {
          id: 'payroll-1',
          employee_id: EMPLOYEE_ID,
          period_month: '2026-03',
          net_pay_cents: 250000,
          status: 'PAID',
        },
        {
          id: 'payroll-2',
          employee_id: EMPLOYEE_ID,
          period_month: '2026-02',
          net_pay_cents: 250000,
          status: 'PAID',
        },
      ];

      mockGetHistory.mockResolvedValue({
        success: true,
        data: mockHistory,
      });

      const url = `http://localhost:3000/api/hr/payroll/${EMPLOYEE_ID}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await HISTORY_GET(request, {
        params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(2);
      expect(data[0].employee_id).toBe(EMPLOYEE_ID);
    });

    it('should return empty array when no history exists', async () => {
      mockGetHistory.mockResolvedValue({
        success: true,
        data: [],
      });

      const url = `http://localhost:3000/api/hr/payroll/${EMPLOYEE_ID}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await HISTORY_GET(request, {
        params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it('should return 500 on service error', async () => {
      mockGetHistory.mockResolvedValue({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database error',
        },
      });

      const url = `http://localhost:3000/api/hr/payroll/${EMPLOYEE_ID}`;
      const request = new NextRequest(url, {
        method: 'GET',
        headers: { 'authorization': 'Bearer test-token' },
      });

      const response = await HISTORY_GET(request, {
        params: Promise.resolve({ employeeId: EMPLOYEE_ID }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
