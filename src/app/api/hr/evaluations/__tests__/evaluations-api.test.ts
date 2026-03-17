/**
 * Evaluations API Unit Tests
 *
 * Tests all 7 evaluation route files:
 * - POST /api/hr/evaluations                          (create evaluation)
 * - GET  /api/hr/evaluations/[id]                     (get by id)
 * - POST /api/hr/evaluations/[id]/complete            (DRAFT -> COMPLETED)
 * - POST /api/hr/evaluations/[id]/review              (COMPLETED -> REVIEWED)
 * - POST /api/hr/evaluations/[id]/employee-comments   (add employee comments)
 * - GET  /api/hr/evaluations/employee/[employeeId]    (list by employee)
 * - GET  /api/hr/evaluations/employee/[employeeId]/average (average score)
 *
 * Strategy: Mock EvaluationService at the module level so the route-level
 * `const service = new EvaluationService(prisma)` receives our mock instance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───
const {
  mockCreate,
  mockGetById,
  mockComplete,
  mockReview,
  mockAddEmployeeComments,
  mockListByEmployee,
  mockGetAverageScore,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGetById: vi.fn(),
  mockComplete: vi.fn(),
  mockReview: vi.fn(),
  mockAddEmployeeComments: vi.fn(),
  mockListByEmployee: vi.fn(),
  mockGetAverageScore: vi.fn(),
}));

// Mock EvaluationService as a class so `new EvaluationService(prisma)` works
vi.mock('@/src/core/services/evaluation.service', () => ({
  EvaluationService: class MockEvaluationService {
    create = mockCreate;
    getById = mockGetById;
    complete = mockComplete;
    review = mockReview;
    addEmployeeComments = mockAddEmployeeComments;
    listByEmployee = mockListByEmployee;
    getAverageScore = mockGetAverageScore;
  },
}));

// Mock Prisma (EvaluationService constructor receives it, but we don't use it)
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
import { POST as CreatePOST } from '../route';
import { GET as GetByIdGET } from '../[id]/route';
import { POST as CompletePOST } from '../[id]/complete/route';
import { POST as ReviewPOST } from '../[id]/review/route';
import { POST as EmployeeCommentsPOST } from '../[id]/employee-comments/route';
import { GET as ListByEmployeeGET } from '../employee/[employeeId]/route';
import { GET as AverageScoreGET } from '../employee/[employeeId]/average/route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EVAL_ID = '11111111-1111-1111-1111-111111111111';
const EMP_ID = '00000000-0000-0000-0000-000000000002';
const EVALUATOR_ID = '00000000-0000-0000-0000-000000000003';

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
  const init: Record<string, unknown> = {
    method,
    headers: { 'content-type': 'application/json' },
  };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init as any);
}

function validEvaluationBody(overrides?: Record<string, unknown>) {
  return {
    employee_id: EMP_ID,
    evaluator_id: EVALUATOR_ID,
    period_start: '2026-01-01',
    period_end: '2026-03-01',
    scores: { punctuality: 8, teamwork: 9, productivity: 7 },
    comments: 'Good performance overall',
    ...overrides,
  };
}

function mockEvaluationRecord(overrides?: Record<string, unknown>) {
  return {
    id: EVAL_ID,
    tenant_id: TENANT_ID,
    employee_id: EMP_ID,
    evaluator_id: EVALUATOR_ID,
    period_start: new Date('2026-01-01'),
    period_end: new Date('2026-03-01'),
    scores: { punctuality: 8, teamwork: 9, productivity: 7 },
    automatic_metrics: null,
    comments: 'Good performance overall',
    employee_comments: null,
    goals: null,
    status: 'DRAFT',
    overall_score: 8,
    created_by: 'admin-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ─── Tests ───

describe('Evaluations API — /api/hr/evaluations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedUser();
  });

  // ==========================================================================
  // POST /api/hr/evaluations — Create evaluation
  // ==========================================================================
  describe('POST /api/hr/evaluations', () => {
    it('should create an evaluation successfully', async () => {
      const record = mockEvaluationRecord();
      mockCreate.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody());
      const res = await CreatePOST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.employee_id).toBe(EMP_ID);
      expect(data.status).toBe('DRAFT');
      expect(mockCreate).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          employee_id: EMP_ID,
          evaluator_id: EVALUATOR_ID,
          period_start: expect.any(Date),
          period_end: expect.any(Date),
          scores: { punctuality: 8, teamwork: 9, productivity: 7 },
          comments: 'Good performance overall',
          created_by: 'admin-1',
        }),
      );
    });

    it('should create evaluation with optional goals', async () => {
      const goals = [
        { goal: 'Improve punctuality', progress: 60 },
        { goal: 'Complete training', progress: 100 },
      ];
      const record = mockEvaluationRecord({ goals });
      mockCreate.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({ goals }));
      const res = await CreatePOST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.goals).toHaveLength(2);
    });

    it('should create evaluation with automatic_metrics', async () => {
      const automatic_metrics = { attendance_rate: 95, sales_target: 87.5 };
      const record = mockEvaluationRecord({ automatic_metrics });
      mockCreate.mockResolvedValue({ success: true, data: record });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({ automatic_metrics }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(201);
      expect(mockCreate).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ automatic_metrics }),
      );
    });

    it('should return 400 when employee_id is missing', async () => {
      const body = validEvaluationBody();
      delete (body as Record<string, unknown>).employee_id;

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', body);
      const res = await CreatePOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Datos inválidos');
    });

    it('should return 400 when evaluator_id is missing', async () => {
      const body = validEvaluationBody();
      delete (body as Record<string, unknown>).evaluator_id;

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', body);
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when period_start is empty', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({ period_start: '' }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when period_end is empty', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({ period_end: '' }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when scores is missing', async () => {
      const body = validEvaluationBody();
      delete (body as Record<string, unknown>).scores;

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', body);
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when a score exceeds max (10)', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({
        scores: { punctuality: 11 },
      }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when a score is negative', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({
        scores: { punctuality: -1 },
      }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when comments exceeds 2000 chars', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({
        comments: 'x'.repeat(2001),
      }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when goal progress exceeds 100', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({
        goals: [{ goal: 'Test', progress: 101 }],
      }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when goal progress is negative', async () => {
      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody({
        goals: [{ goal: 'Test', progress: -5 }],
      }));
      const res = await CreatePOST(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/hr/evaluations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-valid-json',
      });
      const res = await CreatePOST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Cuerpo de solicitud inválido');
    });

    it('should return 404 when employee not found', async () => {
      mockCreate.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody());
      const res = await CreatePOST(req);

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails with internal error', async () => {
      mockCreate.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody());
      const res = await CreatePOST(req);

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest('http://localhost:3000/api/hr/evaluations', 'POST', validEvaluationBody());
      const res = await CreatePOST(req);

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/evaluations/[id] — Get evaluation by ID
  // ==========================================================================
  describe('GET /api/hr/evaluations/[id]', () => {
    it('should return evaluation by ID', async () => {
      const record = mockEvaluationRecord();
      mockGetById.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBe(EVAL_ID);
      expect(data.employee_id).toBe(EMP_ID);
      expect(mockGetById).toHaveBeenCalledWith(TENANT_ID, EVAL_ID);
    });

    it('should return 404 when evaluation not found', async () => {
      mockGetById.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evaluation not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/nonexistent');
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

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}`);
      const res = await GetByIdGET(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/evaluations/[id]/complete — Complete evaluation
  // ==========================================================================
  describe('POST /api/hr/evaluations/[id]/complete', () => {
    it('should complete evaluation successfully', async () => {
      const record = mockEvaluationRecord({ status: 'COMPLETED' });
      mockComplete.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/complete`, 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('COMPLETED');
      expect(mockComplete).toHaveBeenCalledWith(TENANT_ID, EVAL_ID);
    });

    it('should return 404 when evaluation not found', async () => {
      mockComplete.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evaluation not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/bad-id/complete', 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when evaluation already completed', async () => {
      mockComplete.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Evaluation already completed', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/complete`, 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('already completed');
    });

    it('should return 400 on validation error', async () => {
      mockComplete.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Evaluation must have scores', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/complete`, 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(400);
    });

    it('should return 500 when service fails', async () => {
      mockComplete.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/complete`, 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/complete`, 'POST');
      const res = await CompletePOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/evaluations/[id]/review — Review evaluation
  // ==========================================================================
  describe('POST /api/hr/evaluations/[id]/review', () => {
    it('should review evaluation successfully', async () => {
      const record = mockEvaluationRecord({ status: 'REVIEWED' });
      mockReview.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/review`, 'POST');
      const res = await ReviewPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('REVIEWED');
      expect(mockReview).toHaveBeenCalledWith(TENANT_ID, EVAL_ID);
    });

    it('should return 404 when evaluation not found', async () => {
      mockReview.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evaluation not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/bad-id/review', 'POST');
      const res = await ReviewPOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 409 when evaluation not in COMPLETED state', async () => {
      mockReview.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Evaluation must be completed before review', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/review`, 'POST');
      const res = await ReviewPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain('must be completed');
    });

    it('should return 500 when service fails', async () => {
      mockReview.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/review`, 'POST');
      const res = await ReviewPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/review`, 'POST');
      const res = await ReviewPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /api/hr/evaluations/[id]/employee-comments — Add employee comments
  // ==========================================================================
  describe('POST /api/hr/evaluations/[id]/employee-comments', () => {
    it('should add employee comments successfully', async () => {
      const record = mockEvaluationRecord({ employee_comments: 'I agree with the assessment' });
      mockAddEmployeeComments.mockResolvedValue({ success: true, data: record });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/employee-comments`, 'POST', {
        comments: 'I agree with the assessment',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.employee_comments).toBe('I agree with the assessment');
      expect(mockAddEmployeeComments).toHaveBeenCalledWith(
        TENANT_ID,
        EVAL_ID,
        'I agree with the assessment',
      );
    });

    it('should return 404 when evaluation not found', async () => {
      mockAddEmployeeComments.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Evaluation not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/bad-id/employee-comments', 'POST', {
        comments: 'My comments',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: 'bad-id' }) });

      expect(res.status).toBe(404);
    });

    it('should return 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/hr/evaluations/eval-1/employee-comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-valid-json',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Cuerpo de solicitud inválido');
    });

    it('should pass undefined comments to service when not provided', async () => {
      mockAddEmployeeComments.mockResolvedValue({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Comments required', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/employee-comments`, 'POST', {});
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(400);
      expect(mockAddEmployeeComments).toHaveBeenCalledWith(TENANT_ID, EVAL_ID, undefined);
    });

    it('should return 409 on conflict error', async () => {
      mockAddEmployeeComments.mockResolvedValue({
        success: false,
        error: { code: 'CONFLICT', message: 'Comments already added', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/employee-comments`, 'POST', {
        comments: 'Another comment',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(409);
    });

    it('should return 500 when service fails', async () => {
      mockAddEmployeeComments.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/employee-comments`, 'POST', {
        comments: 'Comments',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/${EVAL_ID}/employee-comments`, 'POST', {
        comments: 'Comment',
      });
      const res = await EmployeeCommentsPOST(req, { params: Promise.resolve({ id: EVAL_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/evaluations/employee/[employeeId] — List evaluations by employee
  // ==========================================================================
  describe('GET /api/hr/evaluations/employee/[employeeId]', () => {
    it('should return evaluations for employee', async () => {
      const records = [
        mockEvaluationRecord(),
        mockEvaluationRecord({ id: 'eval-2', status: 'COMPLETED', overall_score: 7.5 }),
      ];
      mockListByEmployee.mockResolvedValue({ success: true, data: records });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(mockListByEmployee).toHaveBeenCalledWith(TENANT_ID, EMP_ID);
    });

    it('should return empty array when no evaluations found', async () => {
      mockListByEmployee.mockResolvedValue({ success: true, data: [] });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}`);
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

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/employee/nonexistent');
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails', async () => {
      mockListByEmployee.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}`);
      const res = await ListByEmployeeGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /api/hr/evaluations/employee/[employeeId]/average — Average score
  // ==========================================================================
  describe('GET /api/hr/evaluations/employee/[employeeId]/average', () => {
    it('should return average score for employee', async () => {
      const averageData = { employee_id: EMP_ID, average_score: 8.2, evaluation_count: 5 };
      mockGetAverageScore.mockResolvedValue({ success: true, data: averageData });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}/average`);
      const res = await AverageScoreGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.average_score).toBe(8.2);
      expect(data.evaluation_count).toBe(5);
      expect(mockGetAverageScore).toHaveBeenCalledWith(TENANT_ID, EMP_ID);
    });

    it('should return average of 0 when no evaluations', async () => {
      const averageData = { employee_id: EMP_ID, average_score: 0, evaluation_count: 0 };
      mockGetAverageScore.mockResolvedValue({ success: true, data: averageData });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}/average`);
      const res = await AverageScoreGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.average_score).toBe(0);
      expect(data.evaluation_count).toBe(0);
    });

    it('should return 404 when employee not found', async () => {
      mockGetAverageScore.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Employee not found', name: 'DomainError' },
      });

      const req = makeRequest('http://localhost:3000/api/hr/evaluations/employee/nonexistent/average');
      const res = await AverageScoreGET(req, { params: Promise.resolve({ employeeId: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('should return 500 when service fails', async () => {
      mockGetAverageScore.mockResolvedValue({
        success: false,
        error: { code: 'INTERNAL', message: 'DB error', name: 'DomainError' },
      });

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}/average`);
      const res = await AverageScoreGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(500);
    });

    it('should return 401 when not authorized', async () => {
      unauthorizedUser();

      const req = makeRequest(`http://localhost:3000/api/hr/evaluations/employee/${EMP_ID}/average`);
      const res = await AverageScoreGET(req, { params: Promise.resolve({ employeeId: EMP_ID }) });

      expect(res.status).toBe(401);
    });
  });
});
