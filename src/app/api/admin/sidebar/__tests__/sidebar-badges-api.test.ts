/**
 * Tests for:
 * - GET /api/admin/sidebar/badges (auditoria + delivery counts)
 *
 * Key behavior:
 * - Auth via getSessionFromRequest — 401 if no session
 * - Returns { auditoria, delivery } with counts from DB
 * - Counts fail gracefully: still returns 200 with 0 values (non-critical)
 * - Outer error also returns 200 with zeros (non-critical route)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockGetSessionFromRequest,
  mockCountAccessLogs,
  mockCountDelivery,
} = vi.hoisted(() => ({
  mockGetSessionFromRequest: vi.fn(),
  mockCountAccessLogs: vi.fn(),
  mockCountDelivery: vi.fn(),
}));

vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    admin_access_logs: { count: mockCountAccessLogs },
    delivery_orders: { count: mockCountDelivery },
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET } from '../badges/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/sidebar/badges', {
    headers: { cookie: 'auth_token=test-token' },
  });
}

// ─── GET /api/admin/sidebar/badges ───────────────────────────────────────────

describe('GET /api/admin/sidebar/badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionFromRequest.mockResolvedValue({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID });
    mockCountAccessLogs.mockResolvedValue(5);
    mockCountDelivery.mockResolvedValue(3);
  });

  it('returns 401 without session', async () => {
    mockGetSessionFromRequest.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with { auditoria, delivery } counts', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auditoria).toBe(5);
    expect(body.delivery).toBe(3);
  });

  it('returns zeros gracefully when audit count fails', async () => {
    mockCountAccessLogs.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auditoria).toBe(0);
    expect(body.delivery).toBe(3);
  });

  it('returns zeros gracefully when delivery count fails', async () => {
    mockCountDelivery.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.auditoria).toBe(5);
    expect(body.delivery).toBe(0);
  });
});
