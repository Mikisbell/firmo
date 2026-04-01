/**
 * GET /api/pos/ready-items — Unit Tests
 *
 * Validates:
 * - Returns 400 when x-tenant-id header is missing
 * - Returns rows with status=READY from last 2h
 * - Returns empty array when no items are ready
 * - Filters correctly (status=READY only, 2h window)
 * - Returns 500 on database error
 *
 * @module app/api/pos/ready-items/__tests__/ready-items.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQueryRaw = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(tenantId?: string, queryTenantId?: string) {
  const url = new URL('http://localhost/api/pos/ready-items');
  if (queryTenantId) url.searchParams.set('tenant_id', queryTenantId);
  const headers: Record<string, string> = {};
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return new NextRequest(url.toString(), { method: 'GET', headers });
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

function makeReadyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    order_id: '00000000-0000-0000-0000-000000000020',
    line_id: 'line-001',
    table_number: '5',
    name: '1/4 Pollo',
    qty: 1,
    station: 'HORNO',
    status: 'READY',
    notes: null,
    ready_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/pos/ready-items', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when x-tenant-id is missing', async () => {
    const { GET } = await import('../route');
    const req = makeRequest(); // no tenant
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/tenant/i);
  });

  it('accepts tenant_id from query param when header absent', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { GET } = await import('../route');
    const req = makeRequest(undefined, TENANT_ID);
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockQueryRaw).toHaveBeenCalledOnce();
  });

  it('returns empty array when no items are ready', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { GET } = await import('../route');
    const res = await GET(makeRequest(TENANT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns array of ready items', async () => {
    const rows = [makeReadyRow(), makeReadyRow({ line_id: 'line-002', name: 'Coca Cola 500ml', station: 'BAR' })];
    mockQueryRaw.mockResolvedValue(rows);
    const { GET } = await import('../route');
    const res = await GET(makeRequest(TENANT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0].station).toBe('HORNO');
    expect(body[1].station).toBe('BAR');
  });

  it('returns 500 on database error', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB connection lost'));
    const { GET } = await import('../route');
    const res = await GET(makeRequest(TENANT_ID));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('passes tenant_id and 2h window to query', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const { GET } = await import('../route');
    const beforeCall = new Date(Date.now() - 2 * 60 * 60 * 1000 - 1000);
    await GET(makeRequest(TENANT_ID));
    const callArgs = mockQueryRaw.mock.calls[0];
    // The tagged template literal passes args as a TemplateStringsArray + values
    // Values include the tenantId and the cutoff date
    const values = callArgs.slice(1) as unknown[];
    const tenantArg = values.find((v) => typeof v === 'string' && v === TENANT_ID);
    expect(tenantArg).toBe(TENANT_ID);
    const dateArg = values.find((v) => v instanceof Date) as Date | undefined;
    expect(dateArg).toBeDefined();
    expect(dateArg!.getTime()).toBeGreaterThan(beforeCall.getTime());
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('ready-items property tests', () => {
  beforeEach(() => vi.resetAllMocks());

  it('invariant: response is always an array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            order_id: fc.uuid(),
            line_id: fc.string({ minLength: 1, maxLength: 40 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            table_number: fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: null }),
            name: fc.string({ minLength: 1, maxLength: 100 }),
            qty: fc.integer({ min: 1, max: 20 }),
            station: fc.constantFrom('HORNO', 'PARRILLA', 'BAR', 'COCINA'),
            status: fc.constant('READY'),
            notes: fc.option(fc.string({ maxLength: 200 }), { nil: null }),
            ready_at: fc.date({ min: new Date(Date.now() - 7200000), max: new Date() }).map(d => d.toISOString()),
          }),
          { maxLength: 10 },
        ),
        async (rows) => {
          mockQueryRaw.mockResolvedValue(rows);
          const { GET } = await import('../route');
          const res = await GET(makeRequest(TENANT_ID));
          expect(res.status).toBe(200);
          const body = await res.json();
          expect(Array.isArray(body)).toBe(true);
          expect(body).toHaveLength(rows.length);
        },
      ),
      { numRuns: 50 },
    );
  });
});
