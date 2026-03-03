/**
 * Tests for SUNAT Daily Summary Cron Endpoint
 *
 * Tests the /api/cron/sunat-daily-summary endpoint:
 * - 401 without CRON_SECRET
 * - 200 with valid CRON_SECRET
 * - Response shape { total, sent, skipped, errors }
 *
 * @module api/cron/__tests__/sunat-daily-summary.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

const mockProcessAllTenants = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/jobs/sunat-daily-summary', () => {
  return {
    SunatDailySummaryService: class MockSunatDailySummaryService {
      processAllTenants = mockProcessAllTenants;
    },
  };
});

vi.mock('@/src/core/integrations/sunat/provider-router', () => {
  return {
    InvoiceProviderRouter: class MockInvoiceProviderRouter {},
  };
});

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from '../sunat-daily-summary/route';

// ============================================================================
// Tests
// ============================================================================

describe('SUNAT Daily Summary Cron Endpoint', () => {
  const CRON_SECRET = 'test-cron-secret-daily-12345';
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeRequest(options: { authorization?: string } = {}): NextRequest {
    const headers = new Headers();
    if (options.authorization) {
      headers.set('authorization', options.authorization);
    }
    return new NextRequest('http://localhost:3000/api/cron/sunat-daily-summary', {
      method: 'GET',
      headers,
    });
  }

  it('should return 401 without CRON_SECRET', async () => {
    const request = makeRequest();
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 401 with invalid CRON_SECRET', async () => {
    const request = makeRequest({ authorization: 'Bearer wrong-secret' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 200 with valid CRON_SECRET', async () => {
    mockProcessAllTenants.mockResolvedValue([
      {
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        summaryDate: '2026-03-02',
        boletasCount: 50,
        boletasTotalCents: 590000,
        ticketNumber: 'TICKET-12345',
        status: 'SENT',
      },
      {
        tenantId: '550e8400-e29b-41d4-a716-446655440002',
        summaryDate: '2026-03-02',
        boletasCount: 0,
        boletasTotalCents: 0,
        status: 'SKIPPED',
      },
    ]);

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(2);
    expect(body.sent).toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.errors).toBe(0);
  });

  it('should return response with expected shape', async () => {
    mockProcessAllTenants.mockResolvedValue([]);

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    const body = await response.json();
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('sent');
    expect(body).toHaveProperty('skipped');
    expect(body).toHaveProperty('errors');
    expect(body).toHaveProperty('duration_ms');
    expect(body).toHaveProperty('results');
    expect(typeof body.total).toBe('number');
    expect(typeof body.sent).toBe('number');
    expect(typeof body.skipped).toBe('number');
    expect(typeof body.errors).toBe('number');
    expect(typeof body.duration_ms).toBe('number');
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('should return 500 when service throws', async () => {
    mockProcessAllTenants.mockRejectedValue(new Error('Database connection failed'));

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('SUNAT daily summary processing failed');
  });

  it('should pass when CRON_SECRET is not set (no auth required)', async () => {
    delete process.env.CRON_SECRET;

    mockProcessAllTenants.mockResolvedValue([]);

    const request = makeRequest(); // No authorization header
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
