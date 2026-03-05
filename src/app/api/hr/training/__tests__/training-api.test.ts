/**
 * Training API Unit Tests
 *
 * Tests all 6 training route files:
 * - POST /api/hr/training                                  (record training)
 * - GET  /api/hr/training/[id]                             (get by ID)
 * - GET  /api/hr/training/employee/[employeeId]            (list by employee)
 * - GET  /api/hr/training/employee/[employeeId]/compliance (compliance status)
 * - GET  /api/hr/training/employee/[employeeId]/hours      (training hours)
 * - GET  /api/hr/training/type/[type]                      (list by type)
 *
 * Strategy: Mock TrainingService at the module level so the route-level
 * `const service = new TrainingService(prisma)` receives our mock instance.
 * This avoids the module-level instantiation problem entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───
const {
  mockRecord,
  mockGetById,
  mockListByEmployee,
  mockGetComplianceStatus,
  mockGetEmployeeTrainingHours,
  mockListByType,
} = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockGetById: vi.fn(),
  mockListByEmployee: vi.fn(),
  mockGetComplianceStatus: vi.fn(),
  mockGetEmployeeTrainingHours: vi.fn(),
  mockListByType: vi.fn(),
}));

// Mock TrainingService as a class so `new TrainingService(prisma)` works
vi.mock('@/src/core/services/training.service', () => ({
  TrainingService: class MockTrainingService {
    record = mockRecord;
    getById = mockGetById;
    listByEmployee = mockListByEmployee;
    getComplianceStatus = mockGetComplianceStatus;
    getEmployeeTrainingHours = mockGetEmployeeTrainingHours;
    listByType = mockListByType;
  },
}));

// Mock Prisma (TrainingService constructor receives it, but we don't use it)
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
import { POST } from '../route';
import { GET as GetByIdGET } from '../[id]/route';
import { GET as EmployeeGET } from '../employee/[employeeId]/route';
import { GET as ComplianceGET } from '../employee/[employeeId]/compliance/route';
import { GET as HoursGET } from '../employee/[employeeId]/hours/route';
import { GET as TypeGET } from '../type/[type]/route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMP_ID = '00000000-0000-0000-0000-000000000002';
const TRAINING_ID = '11111111-1111-1111-1111-111111111111';
const ADMIN_ID = 'admin-1';

function authorizedUser() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: ADMIN_ID,
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

function mockTrainingRecord(overrides?: Record<string, unknown>) {
  return {
    id: TRAINING_ID,
    tenant_id: TENANT_ID,
    employee_id: EMP_ID,
    training_name: 'Food Safety Certification',
    training_type: 'COMPLIANCE',
    provider: 'DIGESA',
    duration_hours: 8,
    completion_date: new Date('2026-02-15'),
    certificate_url: 'https://example.com/cert.pdf',
    score: 95,
    notes: null,
    assigned_by: null,
    recorded_by: ADMIN_ID,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

const BASE_URL = 'http://localhost:3000/api/hr/training';

// ─── Tests ───

describe('Training API — /api/hr/training', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedUser();
  });

  // ==========================================================================
  // POST /api/hr/training — Record training
  // ==========================================================================
  describe('POST /api/hr/training', () => {
    const validBody = {
      employee_id: EMP_ID,
      training_name: 'Food Safety Certification',
      training_type: 'COMPLIANCE',
      provider: 'DIGESA',
      duration_hours: 8,
      completion_date: '2026-02-15',
      certificate_url: 'https://example.com/cert.pdf',
      score: 95,
      notes: 'Passed with distinction',
      assigned_by: null,
    };

    it('should record training successfully', async () => {
      const record = mockTrainingRecord();
      mockRecord.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.training_name).toBe('Food Safety Certification');
      expect(data.employee_id).toBe(EMP_ID);
      expect(mockRecord).toHaveBeenCalledWith(TENANT_ID, {
        employee_id: EMP_ID,
        training_name: 'Food Safety Certification',
        training_type: 'COMPLIANCE',
        provider: 'DIGESA',
        duration_hours: 8,
        completion_date: expect.any(Date),
        certificate_url: 'https://example.com/cert.pdf',
        score: 95,
        notes: 'Passed with distinction',
        assigned_by: null,
        recorded_by: ADMIN_ID,
      });
    });

    it('should record training with minimal fields', async () => {
      const record = mockTrainingRecord({ certificate_url: null, score: null, notes: null });
      mockRecord.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(BASE_URL, 'POST', {
        employee_id: EMP_ID,
        training_name: 'Basic Training',
        training_type: 'ONBOARDING',
        duration_hours: 2,
        completion_date: '2026-03-01',
      });
      const res = await POST(req);

      expect(res.status).toBe(201);
      expect(mockRecord).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          employee_id: EMP_ID,
          training_name: 'Basic Training',
          recorded_by: ADMIN_ID,
        }),
      );
    });

    it('should return 400 when body is invalid JSON', async () => {
      const req = new NextRequest(BASE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when service returns VALIDATION_ERROR', async () => {
      mockRecord.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'employee_id is required', name: 'DomainError' },
      });

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('employee_id');
    });

    it('should return 404 when employee not found', async () => {
      mockRecord.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);

      expect(res.status).toBe(404);
    });

    it('should return 409 on duplicate training record', async () => {
      mockRecord.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Training already recorded', name: 'DomainError' },
      });

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);

      expect(res.status).toBe(409);
    });

    it('should return 500 on internal service error', async () => {
      mockRecord.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(BASE_URL, 'POST', validBody);
      const res = await POST(req);

      expect(res.status).toBe(401);
      expect(mockRecord).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/hr/training/[id] — Get by ID
  // ==========================================================================
  describe('GET /api/hr/training/[id]', () => {
    it('should return training record by ID', async () => {
      const record = mockTrainingRecord();
      mockGetById.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`${BASE_URL}/${TRAINING_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: TRAINING_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(TRAINING_ID);
      expect(data.training_name).toBe('Food Safety Certification');
      expect(mockGetById).toHaveBeenCalledWith(TENANT_ID, TRAINING_ID);
    });

    it('should return 404 when training not found', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Training record not found', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/nonexistent-id`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: 'nonexistent-id' }) });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBeDefined();
    });

    it('should return 500 on internal error', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/${TRAINING_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: TRAINING_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`${BASE_URL}/${TRAINING_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: TRAINING_ID }) });

      expect(res.status).toBe(401);
      expect(mockGetById).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/hr/training/employee/[employeeId] — List by employee
  // ==========================================================================
  describe('GET /api/hr/training/employee/[employeeId]', () => {
    it('should return training records for employee', async () => {
      const records = [
        mockTrainingRecord(),
        mockTrainingRecord({ id: 'training-2', training_name: 'Fire Safety', training_type: 'SAFETY' }),
      ];
      mockListByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}`);
      const res = await EmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        { training_type: undefined },
      );
    });

    it('should filter by training_type query param', async () => {
      const records = [mockTrainingRecord()];
      mockListByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}?training_type=COMPLIANCE`);
      const res = await EmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        { training_type: 'COMPLIANCE' },
      );
    });

    it('should return empty array when no records found', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}`);
      const res = await EmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 500 when service fails', async () => {
      mockListByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}`);
      const res = await EmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}`);
      const res = await EmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
      expect(mockListByEmployee).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/hr/training/employee/[employeeId]/compliance — Compliance status
  // ==========================================================================
  describe('GET /api/hr/training/employee/[employeeId]/compliance', () => {
    const complianceData = {
      employee_id: EMP_ID,
      compliant: true,
      required_trainings: [
        { name: 'Food Safety', required: true, completed: true, expiry_date: '2027-02-15' },
        { name: 'Fire Safety', required: true, completed: true, expiry_date: '2027-01-10' },
      ],
      missing_trainings: [],
      expired_trainings: [],
    };

    it('should return compliance status for employee', async () => {
      mockGetComplianceStatus.mockResolvedValue({ success: true, data: complianceData });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/compliance`);
      const res = await ComplianceGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.compliant).toBe(true);
      expect(data.employee_id).toBe(EMP_ID);
      expect(data.required_trainings).toHaveLength(2);
      expect(mockGetComplianceStatus).toHaveBeenCalledWith(TENANT_ID, EMP_ID);
    });

    it('should return non-compliant status with missing trainings', async () => {
      const nonCompliant = {
        ...complianceData,
        compliant: false,
        missing_trainings: [{ name: 'Hygiene Protocol', required: true, completed: false }],
      };
      mockGetComplianceStatus.mockResolvedValue({ success: true, data: nonCompliant });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/compliance`);
      const res = await ComplianceGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.compliant).toBe(false);
      expect(data.missing_trainings).toHaveLength(1);
    });

    it('should return 404 when employee not found', async () => {
      mockGetComplianceStatus.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/employee/nonexistent/compliance`);
      const res = await ComplianceGET(req, { params: Promise.resolve({ employeeId: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('should return 500 on internal error', async () => {
      mockGetComplianceStatus.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/compliance`);
      const res = await ComplianceGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/compliance`);
      const res = await ComplianceGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
      expect(mockGetComplianceStatus).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/hr/training/employee/[employeeId]/hours — Training hours
  // ==========================================================================
  describe('GET /api/hr/training/employee/[employeeId]/hours', () => {
    const hoursData = {
      employee_id: EMP_ID,
      total_hours: 40,
      by_type: {
        COMPLIANCE: 16,
        SAFETY: 8,
        ONBOARDING: 4,
        SKILL_DEVELOPMENT: 12,
      },
    };

    it('should return training hours for employee', async () => {
      mockGetEmployeeTrainingHours.mockResolvedValue({ success: true, data: hoursData });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/hours`);
      const res = await HoursGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total_hours).toBe(40);
      expect(data.employee_id).toBe(EMP_ID);
      expect(data.by_type.COMPLIANCE).toBe(16);
      expect(mockGetEmployeeTrainingHours).toHaveBeenCalledWith(TENANT_ID, EMP_ID);
    });

    it('should return zero hours for employee with no training', async () => {
      const zeroHours = { employee_id: EMP_ID, total_hours: 0, by_type: {} };
      mockGetEmployeeTrainingHours.mockResolvedValue({ success: true, data: zeroHours });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/hours`);
      const res = await HoursGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total_hours).toBe(0);
    });

    it('should return 404 when employee not found', async () => {
      mockGetEmployeeTrainingHours.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/employee/nonexistent/hours`);
      const res = await HoursGET(req, { params: Promise.resolve({ employeeId: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('should return 500 on internal error', async () => {
      mockGetEmployeeTrainingHours.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/hours`);
      const res = await HoursGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`${BASE_URL}/employee/${EMP_ID}/hours`);
      const res = await HoursGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
      expect(mockGetEmployeeTrainingHours).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // GET /api/hr/training/type/[type] — List by training type
  // ==========================================================================
  describe('GET /api/hr/training/type/[type]', () => {
    it('should return training records by type', async () => {
      const records = [
        mockTrainingRecord(),
        mockTrainingRecord({ id: 'training-2', employee_id: 'emp-2' }),
      ];
      mockListByType.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`${BASE_URL}/type/COMPLIANCE`);
      const res = await TypeGET(req, { params: Promise.resolve({ type: 'COMPLIANCE' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockListByType).toHaveBeenCalledWith(TENANT_ID, 'COMPLIANCE');
    });

    it('should return empty array when no records for type', async () => {
      mockListByType.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`${BASE_URL}/type/UNKNOWN_TYPE`);
      const res = await TypeGET(req, { params: Promise.resolve({ type: 'UNKNOWN_TYPE' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should handle different training types', async () => {
      const types = ['COMPLIANCE', 'SAFETY', 'ONBOARDING', 'SKILL_DEVELOPMENT'];

      for (const type of types) {
        mockListByType.mockResolvedValue({ success: true, data: [] });

        const req = makeRequest(`${BASE_URL}/type/${type}`);
        const res = await TypeGET(req, { params: Promise.resolve({ type }) });

        expect(res.status).toBe(200);
        expect(mockListByType).toHaveBeenCalledWith(TENANT_ID, type);
      }
    });

    it('should return 500 on internal error', async () => {
      mockListByType.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`${BASE_URL}/type/COMPLIANCE`);
      const res = await TypeGET(req, { params: Promise.resolve({ type: 'COMPLIANCE' }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`${BASE_URL}/type/COMPLIANCE`);
      const res = await TypeGET(req, { params: Promise.resolve({ type: 'COMPLIANCE' }) });

      expect(res.status).toBe(401);
      expect(mockListByType).not.toHaveBeenCalled();
    });
  });
});
