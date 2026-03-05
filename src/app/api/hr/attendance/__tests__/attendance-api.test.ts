/**
 * Attendance API Unit Tests
 *
 * Tests all 4 attendance route files:
 * - GET  /api/hr/attendance         (list by employee + date range)
 * - POST /api/hr/attendance         (clock in)
 * - POST /api/hr/attendance/[id]/clock-out
 * - POST /api/hr/attendance/[id]/justify
 * - GET  /api/hr/attendance/report  (monthly report)
 *
 * Strategy: Mock AttendanceService at the module level so the route-level
 * `const service = new AttendanceService(prisma)` receives our mock instance.
 * This avoids the module-level instantiation problem entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───
const {
  mockClockIn,
  mockClockOut,
  mockGetByEmployee,
  mockJustifyAbsence,
  mockGetMonthlyReport,
} = vi.hoisted(() => ({
  mockClockIn: vi.fn(),
  mockClockOut: vi.fn(),
  mockGetByEmployee: vi.fn(),
  mockJustifyAbsence: vi.fn(),
  mockGetMonthlyReport: vi.fn(),
}));

// Mock AttendanceService as a class so `new AttendanceService(prisma)` works
vi.mock('@/src/core/services/attendance.service', () => {
  return {
    AttendanceService: class MockAttendanceService {
      clockIn = mockClockIn;
      clockOut = mockClockOut;
      getByEmployee = mockGetByEmployee;
      justifyAbsence = mockJustifyAbsence;
      getMonthlyReport = mockGetMonthlyReport;
      detectAbsences = vi.fn();
      calculateHoursWorked = vi.fn();
      calculateOvertime = vi.fn();
      calculateLateness = vi.fn();
    },
  };
});

// Mock Prisma (AttendanceService constructor receives it, but we don't use it)
vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

// Mock admin auth — all requests are authorized by default
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: unknown[]) => mockAuth(...args),
}));

// Mock structured logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── NOW import route handlers (after all mocks) ───
import { GET, POST } from '../route';
import { POST as ClockOutPOST } from '../[id]/clock-out/route';
import { POST as JustifyPOST } from '../[id]/justify/route';
import { GET as ReportGET } from '../report/route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function authorizedUser() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: TENANT_ID,
      sessionId: 'sess-1',
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

const EMP_ID = '00000000-0000-0000-0000-000000000002';
const ATT_ID = '11111111-1111-1111-1111-111111111111';

function mockAttendanceRecord(overrides?: Record<string, unknown>) {
  return {
    id: ATT_ID,
    tenant_id: TENANT_ID,
    location_id: '',
    employee_id: EMP_ID,
    schedule_id: null,
    date: new Date('2026-03-05'),
    clock_in: new Date('2026-03-05T08:00:00Z'),
    clock_out: null,
    breaks: [],
    scheduled_minutes: 480,
    worked_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    early_leave_minutes: 0,
    status: 'PRESENT',
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ───

describe('Attendance API — /api/hr/attendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedUser();
  });

  // ==========================================================================
  // GET /api/hr/attendance — List attendance by employee
  // ==========================================================================
  describe('GET /api/hr/attendance', () => {
    it('should return attendance records for employee', async () => {
      const records = [mockAttendanceRecord(), mockAttendanceRecord({ id: 'att-2', status: 'LATE', late_minutes: 15 })];
      mockGetByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(
        `http://localhost:3000/api/hr/attendance?employee_id=${EMP_ID}&start_date=2026-03-01&end_date=2026-03-31`,
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should return 400 when employee_id is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('employee_id');
    });

    it('should default to current month when dates not provided', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`http://localhost:3000/api/hr/attendance?employee_id=${EMP_ID}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(mockGetByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        expect.any(Date), // start of current month
        expect.any(Date), // end of current month
      );
    });

    it('should return empty array when no records found', async () => {
      mockGetByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`http://localhost:3000/api/hr/attendance?employee_id=${EMP_ID}`);
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 500 when service fails', async () => {
      mockGetByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/attendance?employee_id=${EMP_ID}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/attendance?employee_id=${EMP_ID}`);
      const res = await GET(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/attendance — Clock In
  // ==========================================================================
  describe('POST /api/hr/attendance', () => {
    it('should clock in successfully', async () => {
      const record = mockAttendanceRecord();
      mockClockIn.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {
        employee_id: EMP_ID,
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.employee_id).toBe(EMP_ID);
      expect(data.status).toBe('PRESENT');
      expect(mockClockIn).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        expect.any(Date),
        undefined,
      );
    });

    it('should clock in with explicit time and schedule', async () => {
      const scheduleId = '22222222-2222-2222-2222-222222222222';
      const record = mockAttendanceRecord({ schedule_id: scheduleId, late_minutes: 10, status: 'LATE' });
      mockClockIn.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {
        employee_id: EMP_ID,
        clock_in_time: '2026-03-05T08:10:00Z',
        schedule_id: scheduleId,
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.status).toBe('LATE');
      expect(mockClockIn).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        expect.any(Date),
        scheduleId,
      );
    });

    it('should return 409 on duplicate clock-in', async () => {
      mockClockIn.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Employee already clocked in for this date' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {
        employee_id: EMP_ID,
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already clocked in');
    });

    it('should return 400 for invalid employee_id format', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {
        employee_id: 'not-a-uuid',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should return 400 when employee_id is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {});
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('should return 404 when employee not found', async () => {
      mockClockIn.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/attendance', 'POST', {
        employee_id: EMP_ID,
      });
      const res = await POST(req);

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // POST /api/hr/attendance/[id]/clock-out
  // ==========================================================================
  describe('POST /api/hr/attendance/[id]/clock-out', () => {
    it('should clock out successfully', async () => {
      const record = mockAttendanceRecord({
        clock_out: new Date('2026-03-05T17:00:00Z'),
        worked_minutes: 540,
        overtime_minutes: 60,
      });
      mockClockOut.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/clock-out', 'POST', {});
      const res = await ClockOutPOST(req, { params: Promise.resolve({ id: ATT_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.worked_minutes).toBe(540);
      expect(mockClockOut).toHaveBeenCalledWith(TENANT_ID, ATT_ID, expect.any(Date));
    });

    it('should clock out with explicit time', async () => {
      const record = mockAttendanceRecord({ clock_out: new Date('2026-03-05T16:30:00Z'), worked_minutes: 510 });
      mockClockOut.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/clock-out', 'POST', {
        clock_out_time: '2026-03-05T16:30:00Z',
      });
      const res = await ClockOutPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(200);
      expect(mockClockOut).toHaveBeenCalledWith(
        TENANT_ID,
        ATT_ID,
        new Date('2026-03-05T16:30:00Z'),
      );
    });

    it('should return 404 when attendance record not found', async () => {
      mockClockOut.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attendance not found' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/bad-id/clock-out', 'POST', {});
      const res = await ClockOutPOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when already clocked out', async () => {
      mockClockOut.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Employee already clocked out' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/clock-out', 'POST', {});
      const res = await ClockOutPOST(req, { params: Promise.resolve({ id: ATT_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already clocked out');
    });
  });

  // ==========================================================================
  // POST /api/hr/attendance/[id]/justify
  // ==========================================================================
  describe('POST /api/hr/attendance/[id]/justify', () => {
    it('should justify absence successfully', async () => {
      const record = mockAttendanceRecord({ status: 'JUSTIFIED', notes: 'Medical leave' });
      mockJustifyAbsence.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {
        justification: 'Medical leave',
      });
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('JUSTIFIED');
      expect(mockJustifyAbsence).toHaveBeenCalledWith(
        TENANT_ID,
        ATT_ID,
        'Medical leave',
        undefined,
      );
    });

    it('should justify with certificate URL', async () => {
      const record = mockAttendanceRecord({
        status: 'JUSTIFIED',
        notes: 'Sick | Certificate: https://example.com/cert.pdf',
      });
      mockJustifyAbsence.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {
        justification: 'Sick',
        certificate_url: 'https://example.com/cert.pdf',
      });
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(200);
      expect(mockJustifyAbsence).toHaveBeenCalledWith(
        TENANT_ID,
        ATT_ID,
        'Sick',
        'https://example.com/cert.pdf',
      );
    });

    it('should return 400 when justification is empty', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {
        justification: '',
      });
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(400);
    });

    it('should return 400 when justification is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {});
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(400);
    });

    it('should return 404 when attendance not found', async () => {
      mockJustifyAbsence.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Attendance not found' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {
        justification: 'Reason',
      });
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid certificate URL', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance/att-1/justify', 'POST', {
        justification: 'Sick',
        certificate_url: 'not-a-url',
      });
      const res = await JustifyPOST(req, { params: Promise.resolve({ id: ATT_ID }) });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /api/hr/attendance/report — Monthly Report
  // ==========================================================================
  describe('GET /api/hr/attendance/report', () => {
    it('should return monthly report', async () => {
      const report = {
        employee_id: EMP_ID,
        month: '2026-03',
        total_days: 22,
        present_days: 18,
        absent_days: 2,
        late_days: 3,
        justified_days: 1,
        total_worked_minutes: 8640,
        total_overtime_minutes: 120,
        total_late_minutes: 45,
      };
      mockGetMonthlyReport.mockResolvedValue({ success: true, data: report });

      const req = makeRequest(
        `http://localhost:3000/api/hr/attendance/report?employee_id=${EMP_ID}&month=2026-03`,
      );
      const res = await ReportGET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.present_days).toBe(18);
      expect(data.absent_days).toBe(2);
      expect(data.late_days).toBe(3);
      expect(mockGetMonthlyReport).toHaveBeenCalledWith(TENANT_ID, EMP_ID, '2026-03');
    });

    it('should return 400 when employee_id is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/attendance/report?month=2026-03');
      const res = await ReportGET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('employee_id');
    });

    it('should return 400 when month is missing', async () => {
      const req = makeRequest(`http://localhost:3000/api/hr/attendance/report?employee_id=${EMP_ID}`);
      const res = await ReportGET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('month');
    });

    it('should return 400 for invalid month format', async () => {
      const req = makeRequest(
        `http://localhost:3000/api/hr/attendance/report?employee_id=${EMP_ID}&month=March`,
      );
      const res = await ReportGET(req);

      expect(res.status).toBe(400);
    });

    it('should return 500 when service fails', async () => {
      mockGetMonthlyReport.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error' },
      });

      const req = makeRequest(
        `http://localhost:3000/api/hr/attendance/report?employee_id=${EMP_ID}&month=2026-03`,
      );
      const res = await ReportGET(req);

      expect(res.status).toBe(500);
    });
  });
});
