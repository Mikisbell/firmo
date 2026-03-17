/**
 * POS Customer Lookup API - Tests
 *
 * Tests the GET /api/pos/customers/lookup endpoint.
 * Auth, validation, and service delegation.
 *
 * @module app/api/pos/customers/lookup/__tests__/lookup-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks (vi.mock is hoisted above imports)
const { mockRequirePosAuth, mockLookup } = vi.hoisted(() => ({
  mockRequirePosAuth: vi.fn(),
  mockLookup: vi.fn(),
}));

vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: mockRequirePosAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/integrations/peru-identity/lookup.service', () => ({
  IdentityLookupService: class {
    lookup = mockLookup;
  },
}));

import { GET } from '../route';

// ============================================================================
// Helpers
// ============================================================================

function createRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/pos/customers/lookup');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

const defaultAuth = {
  authorized: true,
  user: {
    id: 'user-001',
    tenantId: 'tenant-123',
    role: 'CASHIER',
    name: 'Test Cashier',
    terminalId: 'terminal-001',
  },
  response: null,
};

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/pos/customers/lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePosAuth.mockResolvedValue(defaultAuth);
    mockLookup.mockResolvedValue({ found: false });
  });

  it('returns 400 for invalid doc_number format', async () => {
    const req = createRequest({ doc_number: '123', doc_type: 'DNI' });
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.found).toBe(false);
    expect(body.error).toContain('inválido');
  });

  it('returns 400 for missing doc_type', async () => {
    const req = createRequest({ doc_number: '43708661' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid doc_type', async () => {
    const req = createRequest({ doc_number: '43708661', doc_type: 'CE' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns lookup result for valid DNI', async () => {
    mockLookup.mockResolvedValue({
      found: true,
      source: 'external',
      customer: { name: 'MIGUEL RIVERA', doc_type: 'DNI', doc_number: '43708661' },
    });

    const req = createRequest({ doc_number: '43708661', doc_type: 'DNI' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.customer.name).toBe('MIGUEL RIVERA');
  });

  it('returns lookup result for valid RUC', async () => {
    mockLookup.mockResolvedValue({
      found: true,
      source: 'local',
      customer: { name: 'EMPRESA SAC', doc_type: 'RUC', doc_number: '20100047218' },
      localCustomerId: 'cust-001',
    });

    const req = createRequest({ doc_number: '20100047218', doc_type: 'RUC' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.localCustomerId).toBe('cust-001');
  });

  it('passes tenantId from auth to service', async () => {
    const req = createRequest({ doc_number: '43708661', doc_type: 'DNI' });
    await GET(req);

    expect(mockLookup).toHaveBeenCalledWith('tenant-123', 'DNI', '43708661');
  });

  it('returns 401 when not authorized', async () => {
    mockRequirePosAuth.mockResolvedValueOnce({
      authorized: false,
      response: new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
    });

    const req = createRequest({ doc_number: '43708661', doc_type: 'DNI' });
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('returns 500 when service throws', async () => {
    mockLookup.mockRejectedValue(new Error('Service crash'));

    const req = createRequest({ doc_number: '43708661', doc_type: 'DNI' });
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.found).toBe(false);
  });

  it('returns not found for valid request with no match', async () => {
    mockLookup.mockResolvedValue({ found: false });

    const req = createRequest({ doc_number: '99999999', doc_type: 'DNI' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(false);
  });
});
