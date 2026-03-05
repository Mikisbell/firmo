/**
 * HR Self-Service (/api/hr/me/*) API Unit Tests
 *
 * Tests all 6 self-service route files:
 * - GET  /api/hr/me                  (own profile)
 * - GET  /api/hr/me/attendance       (own attendance)
 * - GET  /api/hr/me/payslips         (own payroll history)
 * - GET  /api/hr/me/vacation-balance (own vacation balance)
 * - GET  /api/hr/me/leave-requests   (own leave requests)
 * - POST /api/hr/me/leave-requests   (submit leave request)
 * - GET  /api/hr/me/schedule         (own weekly schedule)
 *
 * Strategy: Mock all services at the module level so the route-level
 * `const service = new XService(prisma)` receives our mock instance.
 * Uses requirePosAuth (not requireAdminAuth) since these are employee
 * self-service endpoints where the employee ID comes from the JWT.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───

const {
  // EmployeeService
  mockGetById,
  // AttendanceService
  mockGetByEmployee,
  // PayrollService
  mockGetHistory,
  // LeaveRequestService
  mockGetVacationBalance,
  mockListByEmployee,
  mockCreateLeaveRequest,
  // ScheduleService
  mockGetWeeklyCalendar,
  // Prisma direct access (schedule route)
  mockFindFirst,
} = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockGetByEmployee: vi.fn(),
  mockGetHistory: vi.fn(),
  mockGetVacationBalance: vi.fn(),
  mockListByEmployee: vi.fn(),
  mockCreateLeaveRequest: vi.fn(),
  mockGetWeeklyCalendar: vi.fn(),
  mockFindFirst: vi.fn(),
}));

// Mock EmployeeService as a class
vi.mock('@/src/core/services/employee.service', () => ({
  EmployeeService: class MockEmployeeService {
    getById = mockGetById;
  },
}));

// Mock AttendanceService as a class
vi.mock('@/src/core/services/attendance.service', () => ({
  AttendanceService: class MockAttendanceService {
    getByEmployee = mockGetByEmployee;
  },
}));

// Mock PayrollService as a class
vi.mock('@/src/core/services/payroll.service', () => ({
  PayrollService: class MockPayrollService {
    getHistory = mockGetHistory;
  },
}));

// Mock LeaveRequestService as a class
vi.mock('@/src/core/services/leave-request.service', () => ({
  LeaveRequestService: class MockLeaveRequestService {
    getVacationBalance = mockGetVacationBalance;
    listByEmployee = mockListByEmployee;
    create = mockCreateLeaveRequest;
  },
}));

// Mock ScheduleService as a class
vi.mock('@/src/core/services/schedule.service', () => ({
  ScheduleService: class MockScheduleService {
    getWeeklyCalendar = mockGetWeeklyCalendar;
  },
}));

// Mock Prisma — schedule route uses prisma directly for employee_schedules
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    employee_schedules: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

// Mock POS auth (NOT admin auth) — all /me routes use requirePosAuth
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: (...args: unknown[]) => mockAuth(...args),
}));

// Mock structured logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── NOW import route handlers (after all mocks) ───
import { GET as ProfileGET } from '../route';
import { GET as AttendanceGET } from '../attendance/route';
import { GET as PayslipsGET } from '../payslips/route';
import { GET as VacationBalanceGET } from '../vacation-balance/route';
import { GET as LeaveRequestsGET, POST as LeaveRequestsPOST } from '../leave-requests/route';
import { GET as ScheduleGET } from '../schedule/route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

function authorizedEmployee() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: EMPLOYEE_ID,
      role: 'CASHIER',
      name: 'Maria Garcia',
      tenantId: TENANT_ID,
      sessionId: 'sess-emp-1',
    },
  });
}

function unauthorizedUser() {
  const { NextResponse } = require('next/server');
  mockAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
  });
}

function makeRequest(url: string, method: string = 'GET', body?: unknown): NextRequest {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as Parameters<typeof NextRequest>[1]);
}

// ─── Tests ───

describe('HR Self-Service API — /api/hr/me/*', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedEmployee();
  });

  // ==========================================================================
  // GET /api/hr/me — Own Profile
  // ==========================================================================
  describe('GET /api/hr/me', () => {
    const mockEmployee = {
      id: EMPLOYEE_ID,
      tenant_id: TENANT_ID,
      first_name: 'Maria',
      last_name: 'Garcia',
      email: 'maria@example.com',
      role: 'CASHIER',
      status: 'ACTIVE',
      hire_date: '2025-01-15',
    };

    it('should return the authenticated employee profile', async () => {
      mockGetById.mockResolvedValue({ success: true, data: mockEmployee });

      const req = makeRequest('http://localhost:3000/api/hr/me');
      const res = await ProfileGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(EMPLOYEE_ID);
      expect(data.first_name).toBe('Maria');
      expect(mockGetById).toHaveBeenCalledWith(TENANT_ID, EMPLOYEE_ID);
    });

    it('should return 404 when employee not found', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Empleado no encontrado', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me');
      const res = await ProfileGET(req);

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me');
      const res = await ProfileGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me');
      const res = await ProfileGET(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/me/attendance — Own Attendance
  // ==========================================================================
  describe('GET /api/hr/me/attendance', () => {
    const mockRecord = {
      id: 'att-1',
      tenant_id: TENANT_ID,
      employee_id: EMPLOYEE_ID,
      date: '2026-03-05',
      clock_in: '2026-03-05T08:00:00Z',
      clock_out: '2026-03-05T17:00:00Z',
      status: 'PRESENT',
      worked_minutes: 540,
    };

    it('should return attendance for the specified month', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [mockRecord] });

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=2026-03');
      const res = await AttendanceGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('PRESENT');
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        expect.any(Date), // start of March 2026
        expect.any(Date), // end of March 2026
      );
    });

    it('should default to current month when month param is not provided', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance');
      const res = await AttendanceGET(req);

      expect(res.status).toBe(200);
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should ignore invalid month format and default to current month', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=invalid');
      const res = await AttendanceGET(req);

      expect(res.status).toBe(200);
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should return empty array when no records found', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=2026-03');
      const res = await AttendanceGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 500 when service fails', async () => {
      mockGetByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=2026-03');
      const res = await AttendanceGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=2026-03');
      const res = await AttendanceGET(req);

      expect(res.status).toBe(401);
    });

    it('should use employee ID from JWT, not from query params', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      // Even if someone passes a different employee_id, it should use the JWT one
      const req = makeRequest('http://localhost:3000/api/hr/me/attendance?month=2026-03&employee_id=other-id');
      const res = await AttendanceGET(req);

      expect(res.status).toBe(200);
      // The service should be called with the JWT employee ID, not 'other-id'
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        expect.any(Date),
        expect.any(Date),
      );
    });
  });

  // ==========================================================================
  // GET /api/hr/me/payslips — Own Payroll History
  // ==========================================================================
  describe('GET /api/hr/me/payslips', () => {
    const mockPayslips = [
      {
        id: 'pay-1',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        period: '2026-02',
        gross_pay_cents: 350000,
        net_pay_cents: 280000,
        status: 'PAID',
      },
      {
        id: 'pay-2',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        period: '2026-01',
        gross_pay_cents: 350000,
        net_pay_cents: 280000,
        status: 'PAID',
      },
    ];

    it('should return payroll history for authenticated employee', async () => {
      mockGetHistory.mockResolvedValue({ success: true, data: mockPayslips });

      const req = makeRequest('http://localhost:3000/api/hr/me/payslips');
      const res = await PayslipsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].period).toBe('2026-02');
      expect(mockGetHistory).toHaveBeenCalledWith(TENANT_ID, EMPLOYEE_ID);
    });

    it('should return empty array when no payslips exist', async () => {
      mockGetHistory.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/payslips');
      const res = await PayslipsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 500 when service fails', async () => {
      mockGetHistory.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/payslips');
      const res = await PayslipsGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/payslips');
      const res = await PayslipsGET(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/me/vacation-balance — Own Vacation Balance
  // ==========================================================================
  describe('GET /api/hr/me/vacation-balance', () => {
    const mockBalance = {
      employee_id: EMPLOYEE_ID,
      total_days: 30,
      used_days: 12,
      pending_days: 3,
      available_days: 15,
    };

    it('should return vacation balance for authenticated employee', async () => {
      mockGetVacationBalance.mockResolvedValue({ success: true, data: mockBalance });

      const req = makeRequest('http://localhost:3000/api/hr/me/vacation-balance');
      const res = await VacationBalanceGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total_days).toBe(30);
      expect(data.available_days).toBe(15);
      expect(mockGetVacationBalance).toHaveBeenCalledWith(TENANT_ID, EMPLOYEE_ID);
    });

    it('should return 404 when employee not found', async () => {
      mockGetVacationBalance.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Empleado no encontrado', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/vacation-balance');
      const res = await VacationBalanceGET(req);

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails', async () => {
      mockGetVacationBalance.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/vacation-balance');
      const res = await VacationBalanceGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/vacation-balance');
      const res = await VacationBalanceGET(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/me/leave-requests — List Own Leave Requests
  // ==========================================================================
  describe('GET /api/hr/me/leave-requests', () => {
    const mockLeaveRequests = [
      {
        id: 'lr-1',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        leave_type: 'VACATION',
        start_date: '2026-04-01',
        end_date: '2026-04-05',
        days_requested: 5,
        status: 'APPROVED',
        reason: 'Vacaciones familiares',
      },
      {
        id: 'lr-2',
        tenant_id: TENANT_ID,
        employee_id: EMPLOYEE_ID,
        leave_type: 'SICK',
        start_date: '2026-02-10',
        end_date: '2026-02-11',
        days_requested: 2,
        status: 'APPROVED',
        reason: 'Gripe',
      },
    ];

    it('should return leave requests for authenticated employee', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: mockLeaveRequests });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests');
      const res = await LeaveRequestsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        { status: undefined, leave_type: undefined },
      );
    });

    it('should filter by status query param', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [mockLeaveRequests[0]] });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests?status=APPROVED');
      const res = await LeaveRequestsGET(req);

      expect(res.status).toBe(200);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        { status: 'APPROVED', leave_type: undefined },
      );
    });

    it('should filter by leave_type query param', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [mockLeaveRequests[1]] });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests?leave_type=SICK');
      const res = await LeaveRequestsGET(req);

      expect(res.status).toBe(200);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        { status: undefined, leave_type: 'SICK' },
      );
    });

    it('should filter by both status and leave_type', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests?status=PENDING&leave_type=VACATION');
      const res = await LeaveRequestsGET(req);

      expect(res.status).toBe(200);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMPLOYEE_ID,
        { status: 'PENDING', leave_type: 'VACATION' },
      );
    });

    it('should return empty array when no leave requests', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests');
      const res = await LeaveRequestsGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 500 when service fails', async () => {
      mockListByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests');
      const res = await LeaveRequestsGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests');
      const res = await LeaveRequestsGET(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/me/leave-requests — Submit Leave Request
  // ==========================================================================
  describe('POST /api/hr/me/leave-requests', () => {
    const validBody = {
      leave_type: 'VACATION',
      start_date: '2026-05-01',
      end_date: '2026-05-05',
      days_requested: 5,
      reason: 'Vacaciones planificadas',
      with_pay: true,
    };

    const mockCreatedRequest = {
      id: 'lr-new-1',
      tenant_id: TENANT_ID,
      employee_id: EMPLOYEE_ID,
      ...validBody,
      status: 'PENDING',
      created_by: EMPLOYEE_ID,
    };

    it('should create a leave request successfully', async () => {
      mockCreateLeaveRequest.mockResolvedValue({ success: true, data: mockCreatedRequest });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', validBody);
      const res = await LeaveRequestsPOST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.id).toBe('lr-new-1');
      expect(data.status).toBe('PENDING');
      expect(mockCreateLeaveRequest).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          employee_id: EMPLOYEE_ID,
          leave_type: 'VACATION',
          days_requested: 5,
          reason: 'Vacaciones planificadas',
          with_pay: true,
          created_by: EMPLOYEE_ID,
          start_date: expect.any(Date),
          end_date: expect.any(Date),
        }),
      );
    });

    it('should create a sick leave request with certificate', async () => {
      const sickBody = {
        leave_type: 'SICK',
        start_date: '2026-03-10',
        end_date: '2026-03-12',
        days_requested: 3,
        reason: 'Enfermedad',
        with_pay: true,
        certificate_url: 'https://storage.example.com/cert-123.pdf',
      };
      mockCreateLeaveRequest.mockResolvedValue({
        success: true,
        data: { ...mockCreatedRequest, ...sickBody, id: 'lr-sick-1', status: 'PENDING' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', sickBody);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(201);
      expect(mockCreateLeaveRequest).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          employee_id: EMPLOYEE_ID,
          leave_type: 'SICK',
          certificate_url: 'https://storage.example.com/cert-123.pdf',
          created_by: EMPLOYEE_ID,
        }),
      );
    });

    it('should force employee_id from JWT, ignoring body', async () => {
      mockCreateLeaveRequest.mockResolvedValue({ success: true, data: mockCreatedRequest });

      const bodyWithDifferentId = { ...validBody, employee_id: 'attacker-id' };
      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', bodyWithDifferentId);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(201);
      // The route overrides employee_id with the JWT user ID
      expect(mockCreateLeaveRequest).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          employee_id: EMPLOYEE_ID,
          created_by: EMPLOYEE_ID,
        }),
      );
    });

    it('should return 409 on conflict (e.g., overlapping dates)', async () => {
      mockCreateLeaveRequest.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Ya existe una solicitud para estas fechas', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', validBody);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(409);
    });

    it('should return 400 on validation error from service', async () => {
      mockCreateLeaveRequest.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Fechas invalidas', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', validBody);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when request body is invalid JSON', async () => {
      const req = new NextRequest('http://localhost:3000/api/hr/me/leave-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      const res = await LeaveRequestsPOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('inválido');
    });

    it('should return 500 when service fails unexpectedly', async () => {
      mockCreateLeaveRequest.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', validBody);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/leave-requests', 'POST', validBody);
      const res = await LeaveRequestsPOST(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/me/schedule — Own Weekly Schedule
  // ==========================================================================
  describe('GET /api/hr/me/schedule', () => {
    const mockAssignment = {
      id: 'es-1',
      tenant_id: TENANT_ID,
      employee_id: EMPLOYEE_ID,
      schedule_template_id: 'tpl-1',
      is_active: true,
      template: {
        id: 'tpl-1',
        tenant_id: TENANT_ID,
        location_id: 'loc-1',
        name: 'Turno manana',
      },
    };

    const mockScheduleEntries = [
      { employee_id: EMPLOYEE_ID, date: '2026-03-03', shift_start: '08:00', shift_end: '16:00' },
      { employee_id: EMPLOYEE_ID, date: '2026-03-04', shift_start: '08:00', shift_end: '16:00' },
      { employee_id: 'other-emp', date: '2026-03-04', shift_start: '16:00', shift_end: '00:00' },
      { employee_id: EMPLOYEE_ID, date: '2026-03-05', shift_start: '08:00', shift_end: '16:00' },
    ];

    it('should return weekly schedule for the authenticated employee', async () => {
      mockFindFirst.mockResolvedValue(mockAssignment);
      mockGetWeeklyCalendar.mockResolvedValue({ success: true, data: mockScheduleEntries });

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      // Should only include the current employee's entries, not 'other-emp'
      expect(data).toHaveLength(3);
      expect(data.every((entry: { employee_id: string }) => entry.employee_id === EMPLOYEE_ID)).toBe(true);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            employee_id: EMPLOYEE_ID,
            is_active: true,
          },
          include: { template: true },
        }),
      );
      expect(mockGetWeeklyCalendar).toHaveBeenCalledWith(
        TENANT_ID,
        'loc-1',
        expect.any(Date), // monday of current week
      );
    });

    it('should return empty array when no schedule assignment exists', async () => {
      mockFindFirst.mockResolvedValue(null);

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
      // Should not call getWeeklyCalendar when no assignment
      expect(mockGetWeeklyCalendar).not.toHaveBeenCalled();
    });

    it('should filter out other employees from the calendar', async () => {
      mockFindFirst.mockResolvedValue(mockAssignment);
      const mixedEntries = [
        { employee_id: EMPLOYEE_ID, date: '2026-03-03', shift_start: '08:00', shift_end: '16:00' },
        { employee_id: 'other-1', date: '2026-03-03', shift_start: '16:00', shift_end: '00:00' },
        { employee_id: 'other-2', date: '2026-03-04', shift_start: '08:00', shift_end: '16:00' },
      ];
      mockGetWeeklyCalendar.mockResolvedValue({ success: true, data: mixedEntries });

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].employee_id).toBe(EMPLOYEE_ID);
    });

    it('should return 500 when schedule service fails', async () => {
      mockFindFirst.mockResolvedValue(mockAssignment);
      mockGetWeeklyCalendar.mockResolvedValue({
        success: false,
        error: { message: 'Error al obtener calendario' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);

      expect(res.status).toBe(500);
    });

    it('should return 500 when prisma query throws', async () => {
      mockFindFirst.mockRejectedValue(new Error('Connection lost'));

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Error al obtener horario');
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/me/schedule');
      const res = await ScheduleGET(req);

      expect(res.status).toBe(401);
    });
  });
});
