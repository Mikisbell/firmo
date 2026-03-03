/**
 * Tests for SUNAT Queue Cron Endpoint
 *
 * Tests the /api/cron/sunat-queue endpoint:
 * - 401 without CRON_SECRET
 * - 200 with valid CRON_SECRET
 * - Response shape { processed, failed, skipped }
 *
 * @module api/cron/__tests__/sunat-queue.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

const mockProcessBatch = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/jobs/sunat-queue-worker', () => {
  return {
    SunatQueueWorker: class MockSunatQueueWorker {
      processBatch = mockProcessBatch;
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

import { GET } from '../sunat-queue/route';

// ============================================================================
// Tests
// ============================================================================

describe('SUNAT Queue Cron Endpoint', () => {
  const CRON_SECRET = 'test-cron-secret-12345';
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
    return new NextRequest('http://localhost:3000/api/cron/sunat-queue', {
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
    mockProcessBatch.mockResolvedValue({
      processed: 3,
      succeeded: 2,
      failed: 1,
      skipped: 0,
      duration_ms: 1500,
      details: [],
    });

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.processed).toBe(3);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(1);
    expect(body.skipped).toBe(0);
  });

  it('should return response with expected shape', async () => {
    mockProcessBatch.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 50,
      details: [],
    });

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    const body = await response.json();
    expect(body).toHaveProperty('processed');
    expect(body).toHaveProperty('succeeded');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('skipped');
    expect(body).toHaveProperty('duration_ms');
    expect(typeof body.processed).toBe('number');
    expect(typeof body.failed).toBe('number');
    expect(typeof body.skipped).toBe('number');
  });

  it('should return 500 when worker throws', async () => {
    mockProcessBatch.mockRejectedValue(new Error('Database connection failed'));

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('SUNAT queue worker failed');
  });

  it('should pass when CRON_SECRET is not set (no auth required)', async () => {
    delete process.env.CRON_SECRET;

    mockProcessBatch.mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 10,
      details: [],
    });

    const request = makeRequest(); // No authorization header
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});
