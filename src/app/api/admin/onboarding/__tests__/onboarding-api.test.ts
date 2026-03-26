/**
 * Tests for:
 * - GET /api/admin/onboarding
 * - PUT /api/admin/onboarding/steps/[key]/complete
 *
 * Key behavior:
 * - Auth required on both
 * - tenant_id from JWT (never from client)
 * - GET: 404 when checklist not found, includes progress object
 * - PUT: validates step key — invalid key → 400 with valid_keys
 * - PUT: 'not found' error → 404
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetOnboardingChecklist,
  mockCompleteOnboardingStep,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetOnboardingChecklist: vi.fn(),
  mockCompleteOnboardingStep: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
}));

vi.mock('@/src/core/tenant/onboarding', () => ({
  getOnboardingChecklist: mockGetOnboardingChecklist,
  completeOnboardingStep: mockCompleteOnboardingStep,
}));

import { GET } from '../route';
import { PUT } from '../steps/[key]/complete/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseChecklist = {
  tenant_id: TENANT_ID,
  status: 'IN_PROGRESS',
  completion_percentage: 50,
  steps: [
    { step_key: 'CONFIGURE_BASIC_INFO', is_completed: true, completed_at: new Date() },
    { step_key: 'CREATE_EMPLOYEE', is_completed: false, completed_at: null },
  ],
};

function makeRequest(url: string, method = 'GET'): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token' },
  });
}

function makeParams(key: string) {
  return { params: Promise.resolve({ key }) };
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/onboarding ────────────────────────────────────────────────

describe('GET /api/admin/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetOnboardingChecklist.mockResolvedValue(baseChecklist);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('/api/admin/onboarding'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with checklist and progress', async () => {
    const res = await GET(makeRequest('/api/admin/onboarding'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('IN_PROGRESS');
    expect(body.steps).toHaveLength(2);
    expect(body.progress).toBeDefined();
    expect(body.progress.completed).toBe(1);
    expect(body.progress.total).toBe(2);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest('/api/admin/onboarding'));
    expect(mockGetOnboardingChecklist).toHaveBeenCalledWith(TENANT_ID);
  });

  it('returns 404 when checklist not found', async () => {
    mockGetOnboardingChecklist.mockRejectedValue(new Error('Onboarding checklist not found'));
    const res = await GET(makeRequest('/api/admin/onboarding'));
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockGetOnboardingChecklist.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest('/api/admin/onboarding'));
    expect(res.status).toBe(500);
  });
});

// ─── PUT /api/admin/onboarding/steps/[key]/complete ───────────────────────────

describe('PUT /api/admin/onboarding/steps/[key]/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCompleteOnboardingStep.mockResolvedValue({ step_key: 'CONFIGURE_BASIC_INFO', is_completed: true });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(
      makeRequest('/api/admin/onboarding/steps/CONFIGURE_BASIC_INFO/complete', 'PUT'),
      makeParams('CONFIGURE_BASIC_INFO'),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on valid step key', async () => {
    const res = await PUT(
      makeRequest('/api/admin/onboarding/steps/CONFIGURE_BASIC_INFO/complete', 'PUT'),
      makeParams('CONFIGURE_BASIC_INFO'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.step).toBeDefined();
  });

  it('passes tenant_id + employee_id from JWT to service', async () => {
    await PUT(
      makeRequest('/api/admin/onboarding/steps/CREATE_EMPLOYEE/complete', 'PUT'),
      makeParams('CREATE_EMPLOYEE'),
    );
    expect(mockCompleteOnboardingStep).toHaveBeenCalledWith(TENANT_ID, 'CREATE_EMPLOYEE', EMPLOYEE_ID);
  });

  it('returns 400 on invalid step key', async () => {
    const res = await PUT(
      makeRequest('/api/admin/onboarding/steps/INVALID_KEY/complete', 'PUT'),
      makeParams('INVALID_KEY'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid_keys).toBeDefined();
  });

  it('returns 404 when step not found in DB', async () => {
    mockCompleteOnboardingStep.mockRejectedValue(new Error('step not found'));
    const res = await PUT(
      makeRequest('/api/admin/onboarding/steps/CONFIGURE_BASIC_INFO/complete', 'PUT'),
      makeParams('CONFIGURE_BASIC_INFO'),
    );
    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockCompleteOnboardingStep.mockRejectedValue(new Error('DB connection error'));
    const res = await PUT(
      makeRequest('/api/admin/onboarding/steps/CONFIGURE_BASIC_INFO/complete', 'PUT'),
      makeParams('CONFIGURE_BASIC_INFO'),
    );
    expect(res.status).toBe(500);
  });
});
