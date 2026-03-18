/**
 * Tests for /api/admin/locations
 *
 * GET - Returns tenant's active locations
 * - 401 without auth
 * - 200 with valid auth, returns locations array
 * - Filters by tenant_id (tenant isolation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

const { mockFindMany, mockRequireAdminAuth } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    locations: { findMany: mockFindMany },
  },
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from '../route';

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/locations', {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
  });
}

function mockAuth(authorized = true) {
  if (authorized) {
    mockRequireAdminAuth.mockResolvedValue({
      authorized: true,
      user: { id: 'emp-1', role: 'ADMIN', name: 'Test', tenantId: TENANT_ID, sessionId: 'sess-1' },
    });
  } else {
    mockRequireAdminAuth.mockResolvedValue({
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/admin/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    mockAuth(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with locations array when authenticated', async () => {
    mockAuth();
    const locations = [
      { id: 'loc-1', code: 'MAIN', name: 'Local Principal', address: 'Av. Lima 123', timezone: 'America/Lima' },
      { id: 'loc-2', code: 'SEC', name: 'Sucursal Miraflores', address: null, timezone: 'America/Lima' },
    ];
    mockFindMany.mockResolvedValue(locations);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locations).toHaveLength(2);
    expect(body.locations[0].id).toBe('loc-1');
    expect(body.locations[1].name).toBe('Sucursal Miraflores');
  });

  it('queries only active locations for the tenant', async () => {
    mockAuth();
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT_ID, is_active: true },
      })
    );
  });

  it('returns empty array when no locations configured', async () => {
    mockAuth();
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.locations).toEqual([]);
  });

  it('returns 500 on database error', async () => {
    mockAuth();
    mockFindMany.mockRejectedValue(new Error('DB connection failed'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
