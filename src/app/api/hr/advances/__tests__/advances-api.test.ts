/**
 * Advances API Unit Tests
 *
 * Tests all 6 advance route files:
 * - POST /api/hr/advances              (request advance)
 * - GET  /api/hr/advances/[id]         (get by id)
 * - POST /api/hr/advances/[id]/approve (approve advance)
 * - POST /api/hr/advances/[id]/mark-paid (mark as paid)
 * - POST /api/hr/advances/[id]/reject  (reject with reason)
 * - GET  /api/hr/advances/employee/[employeeId] (list by employee)
 *
 * Strategy: Mock AdvanceService at the module level so the route-level
 * `const service = new AdvanceService(prisma)` receives our mock instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───
const {
  mockRequest,
  mockGetById,
  mockApprove,
  mockMarkAsPaid,
  mockReject,
  mockListByEmployee,
} = vi.hoisted(() => ({
  mockRequest: vi.fn(),
  mockGetById: vi.fn(),
  mockApprove: vi.fn(),
  mockMarkAsPaid: vi.fn(),
  mockReject: vi.fn(),
  mockListByEmployee: vi.fn(),
}));

// Mock AdvanceService as a class so `new AdvanceService(prisma)` works
vi.mock('@/src/core/services/advance.service', () => ({
  AdvanceService: class MockAdvanceService {
    request = mockRequest;
    getById = mockGetById;
    approve = mockApprove;
    markAsPaid = mockMarkAsPaid;
    reject = mockReject;
    listByEmployee = mockListByEmployee;
  },
}));

// Mock Prisma (AdvanceService constructor receives it, but we don't use it)
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
import { POST as RequestAdvancePOST } from '../route';
import { GET as GetByIdGET } from '../[id]/route';
import { POST as ApprovePOST } from '../[id]/approve/route';
import { POST as MarkPaidPOST } from '../[id]/mark-paid/route';
import { POST as RejectPOST } from '../[id]/reject/route';
import { GET as ListByEmployeeGET } from '../employee/[employeeId]/route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = 'admin-1';
const EMP_ID = '00000000-0000-0000-0000-000000000002';
const ADVANCE_ID = '11111111-1111-1111-1111-111111111111';

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
  const init: Record<string, unknown> = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as any);
}

function mockAdvanceRecord(overrides?: Record<string, unknown>) {
  return {
    id: ADVANCE_ID,
    tenant_id: TENANT_ID,
    employee_id: EMP_ID,
    amount_cents: 50000,
    reason: 'Emergencia familiar',
    status: 'PENDING',
    requested_by: ADMIN_ID,
    approved_by: null,
    rejected_by: null,
    rejection_reason: null,
    paid_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ───

describe('Advances API — /api/hr/advances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedUser();
  });

  // ==========================================================================
  // POST /api/hr/advances — Request advance
  // ==========================================================================
  describe('POST /api/hr/advances', () => {
    const validBody = {
      employee_id: EMP_ID,
      amount_cents: 50000,
      reason: 'Emergencia familiar',
    };

    it('should create an advance request successfully', async () => {
      const record = mockAdvanceRecord();
      mockRequest.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', validBody);
      const res = await RequestAdvancePOST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.employee_id).toBe(EMP_ID);
      expect(data.amount_cents).toBe(50000);
      expect(mockRequest).toHaveBeenCalledWith(TENANT_ID, {
        employee_id: EMP_ID,
        amount_cents: 50000,
        reason: 'Emergencia familiar',
        requested_by: ADMIN_ID,
      });
    });

    it('should return 400 when employee_id is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        amount_cents: 50000,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when amount_cents is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when reason is missing', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 50000,
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when amount_cents is negative', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: -100,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when amount_cents is zero', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 0,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when amount_cents is a float', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 50.5,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when amount_cents exceeds max', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 100000000,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when employee_id is empty string', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: '',
        amount_cents: 50000,
        reason: 'Emergencia',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when reason is empty string', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 50000,
        reason: '',
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when reason exceeds 500 characters', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', {
        employee_id: EMP_ID,
        amount_cents: 50000,
        reason: 'x'.repeat(501),
      });
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/hr/advances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      const res = await RequestAdvancePOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 404 when service returns NOT_FOUND', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', validBody);
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(404);
    });

    it('should return 409 when service returns CONFLICT', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Advance limit exceeded', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', validBody);
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(409);
    });

    it('should return 500 when service returns unknown error', async () => {
      mockRequest.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', validBody);
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/advances', 'POST', validBody);
      const res = await RequestAdvancePOST(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/advances/[id] — Get advance by ID
  // ==========================================================================
  describe('GET /api/hr/advances/[id]', () => {
    it('should return advance by id', async () => {
      const record = mockAdvanceRecord();
      mockGetById.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(ADVANCE_ID);
      expect(data.amount_cents).toBe(50000);
      expect(mockGetById).toHaveBeenCalledWith(TENANT_ID, ADVANCE_ID);
    });

    it('should return 404 when advance not found', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Advance not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances/nonexistent');
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 500 when service fails', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/advances/[id]/approve — Approve advance
  // ==========================================================================
  describe('POST /api/hr/advances/[id]/approve', () => {
    it('should approve advance successfully', async () => {
      const record = mockAdvanceRecord({ status: 'APPROVED', approved_by: ADMIN_ID });
      mockApprove.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/approve`, 'POST');
      const res = await ApprovePOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('APPROVED');
      expect(data.approved_by).toBe(ADMIN_ID);
      expect(mockApprove).toHaveBeenCalledWith(TENANT_ID, ADVANCE_ID, ADMIN_ID);
    });

    it('should return 404 when advance not found', async () => {
      mockApprove.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Advance not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances/bad-id/approve', 'POST');
      const res = await ApprovePOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when advance already approved', async () => {
      mockApprove.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Advance already approved', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/approve`, 'POST');
      const res = await ApprovePOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already approved');
    });

    it('should return 500 when service fails', async () => {
      mockApprove.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/approve`, 'POST');
      const res = await ApprovePOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/approve`, 'POST');
      const res = await ApprovePOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/advances/[id]/mark-paid — Mark advance as paid
  // ==========================================================================
  describe('POST /api/hr/advances/[id]/mark-paid', () => {
    it('should mark advance as paid successfully', async () => {
      const record = mockAdvanceRecord({
        status: 'PAID',
        paid_at: new Date().toISOString(),
      });
      mockMarkAsPaid.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/mark-paid`, 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('PAID');
      expect(data.paid_at).toBeDefined();
      expect(mockMarkAsPaid).toHaveBeenCalledWith(TENANT_ID, ADVANCE_ID);
    });

    it('should return 404 when advance not found', async () => {
      mockMarkAsPaid.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Advance not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances/bad-id/mark-paid', 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when advance already paid', async () => {
      mockMarkAsPaid.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Advance already paid', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/mark-paid`, 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already paid');
    });

    it('should return 409 when advance not yet approved', async () => {
      mockMarkAsPaid.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Advance must be approved before marking as paid', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/mark-paid`, 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(409);
    });

    it('should return 500 when service fails', async () => {
      mockMarkAsPaid.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/mark-paid`, 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/mark-paid`, 'POST');
      const res = await MarkPaidPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/advances/[id]/reject — Reject advance with reason
  // ==========================================================================
  describe('POST /api/hr/advances/[id]/reject', () => {
    it('should reject advance successfully', async () => {
      const record = mockAdvanceRecord({
        status: 'REJECTED',
        rejected_by: ADMIN_ID,
        rejection_reason: 'Exceeds monthly limit',
      });
      mockReject.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, 'POST', {
        reason: 'Exceeds monthly limit',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('REJECTED');
      expect(data.rejection_reason).toBe('Exceeds monthly limit');
      expect(mockReject).toHaveBeenCalledWith(
        TENANT_ID,
        ADVANCE_ID,
        ADMIN_ID,
        'Exceeds monthly limit',
      );
    });

    it('should reject without reason (reason is optional in route)', async () => {
      const record = mockAdvanceRecord({ status: 'REJECTED', rejected_by: ADMIN_ID });
      mockReject.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, 'POST', {});
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(200);
      expect(mockReject).toHaveBeenCalledWith(
        TENANT_ID,
        ADVANCE_ID,
        ADMIN_ID,
        undefined,
      );
    });

    it('should return 404 when advance not found', async () => {
      mockReject.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Advance not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances/bad-id/reject', 'POST', {
        reason: 'No valid',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when advance already rejected', async () => {
      mockReject.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Advance already rejected', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, 'POST', {
        reason: 'Duplicate',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already rejected');
    });

    it('should return 400 for invalid JSON body', async () => {
      const req = new NextRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 500 when service fails', async () => {
      mockReject.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, 'POST', {
        reason: 'Some reason',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/advances/${ADVANCE_ID}/reject`, 'POST', {
        reason: 'Denied',
      });
      const res = await RejectPOST(req, { params: Promise.resolve({ id: ADVANCE_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/advances/employee/[employeeId] — List by employee
  // ==========================================================================
  describe('GET /api/hr/advances/employee/[employeeId]', () => {
    it('should return advances for employee', async () => {
      const records = [
        mockAdvanceRecord(),
        mockAdvanceRecord({ id: 'adv-2', amount_cents: 30000, status: 'APPROVED' }),
      ];
      mockListByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        { status: undefined },
      );
    });

    it('should filter by status query param', async () => {
      const records = [mockAdvanceRecord({ status: 'PENDING' })];
      mockListByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/employee/${EMP_ID}?status=PENDING`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(mockListByEmployee).toHaveBeenCalledWith(
        TENANT_ID,
        EMP_ID,
        { status: 'PENDING' },
      );
    });

    it('should return empty array when no advances found', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should return 404 when employee not found', async () => {
      mockListByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/advances/employee/nonexistent');
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails', async () => {
      mockListByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/advances/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/advances/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
    });
  });
});
