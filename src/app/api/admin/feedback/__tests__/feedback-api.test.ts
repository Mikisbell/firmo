/**
 * Tests for:
 * - GET /api/admin/feedback
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - Returns { items, total, page, pageSize, totalPages }
 * - Filters by type (QUEJA, SUGERENCIA, ELOGIO) — invalid types ignored
 * - Pagination via page/pageSize params
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockFeedbackFindMany,
  mockFeedbackCount,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockFeedbackFindMany: vi.fn(),
  mockFeedbackCount: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    customer_feedback: {
      findMany: mockFeedbackFindMany,
      count: mockFeedbackCount,
    },
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { GET } from '../route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseFeedback = [
  { id: 'fb-1', type: 'ELOGIO', message: 'Excelente', customer_name: 'Juan', rating: 5, table_number: 3, created_at: new Date() },
  { id: 'fb-2', type: 'QUEJA', message: 'Demoró mucho', customer_name: null, rating: 2, table_number: 1, created_at: new Date() },
];

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/feedback${query}`, {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
  });
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockFeedbackFindMany.mockResolvedValue(baseFeedback);
    mockFeedbackCount.mockResolvedValue(2);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with { items, total, page, pageSize, totalPages }', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.totalPages).toBe(1);
  });

  it('queries scoped by tenant_id from JWT', async () => {
    await GET(makeRequest());
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });

  it('filters by valid type ELOGIO', async () => {
    await GET(makeRequest('?type=ELOGIO'));
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: 'ELOGIO' }) }),
    );
  });

  it('ignores invalid type filter', async () => {
    await GET(makeRequest('?type=INVALIDO'));
    expect(mockFeedbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ type: 'INVALIDO' }) }),
    );
  });

  it('returns empty items when no feedback', async () => {
    mockFeedbackFindMany.mockResolvedValue([]);
    mockFeedbackCount.mockResolvedValue(0);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.totalPages).toBe(0);
  });

  it('returns 500 on DB error', async () => {
    mockFeedbackFindMany.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
