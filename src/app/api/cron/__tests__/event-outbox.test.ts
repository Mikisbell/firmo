/**
 * Tests for Event Outbox Cron Endpoint
 *
 * Tests the /api/cron/event-outbox endpoint:
 * - 401 without CRON_SECRET
 * - 401 with invalid CRON_SECRET
 * - 401 when CRON_SECRET is not set (fail-safe)
 * - 200 with valid CRON_SECRET, invokes processOutbox
 * - Drain loop: keeps calling processOutbox until a batch returns 0
 * - 500 when worker throws
 *
 * @module api/cron/__tests__/event-outbox.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

const mockProcessOutbox = vi.fn();
const mockGetOutboxStats = vi.fn();
const mockCleanupPublishedEvents = vi.fn();

vi.mock('@/src/core/workers/outbox-publisher', () => ({
  processOutbox: (...args: unknown[]) => mockProcessOutbox(...args),
  getOutboxStats: (...args: unknown[]) => mockGetOutboxStats(...args),
  cleanupPublishedEvents: (...args: unknown[]) => mockCleanupPublishedEvents(...args),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from '../event-outbox/route';

// ============================================================================
// Tests
// ============================================================================

describe('Event Outbox Cron Endpoint', () => {
  const CRON_SECRET = 'test-cron-secret-12345';
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
    mockProcessOutbox.mockResolvedValue(0);
    mockCleanupPublishedEvents.mockResolvedValue(0);
    mockGetOutboxStats.mockResolvedValue({ pending: 0, failed: 0, published_today: 0 });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makeRequest(options: { authorization?: string } = {}): NextRequest {
    const headers = new Headers();
    if (options.authorization) {
      headers.set('authorization', options.authorization);
    }
    return new NextRequest('http://localhost:3000/api/cron/event-outbox', {
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
    expect(mockProcessOutbox).not.toHaveBeenCalled();
  });

  it('should return 401 with invalid CRON_SECRET', async () => {
    const request = makeRequest({ authorization: 'Bearer wrong-secret' });
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockProcessOutbox).not.toHaveBeenCalled();
  });

  it('should return 401 when CRON_SECRET is not set (fail-safe)', async () => {
    delete process.env.CRON_SECRET;

    const request = makeRequest(); // No authorization header
    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(mockProcessOutbox).not.toHaveBeenCalled();
  });

  it('should return 200 with valid CRON_SECRET and invoke processOutbox', async () => {
    mockProcessOutbox.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    mockGetOutboxStats.mockResolvedValue({ pending: 0, failed: 0, published_today: 3 });

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.published).toBe(3);
    expect(mockProcessOutbox).toHaveBeenCalled();
    expect(mockCleanupPublishedEvents).toHaveBeenCalledWith(7);
  });

  it('should drain in batches until processOutbox returns 0', async () => {
    mockProcessOutbox
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(0);

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.published).toBe(240);
    expect(body.batches).toBe(4);
    expect(mockProcessOutbox).toHaveBeenCalledTimes(4);
  });

  it('should stop after MAX_BATCHES even if batches keep publishing', async () => {
    mockProcessOutbox.mockResolvedValue(100); // never returns 0

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(mockProcessOutbox).toHaveBeenCalledTimes(10); // MAX_BATCHES
    expect(body.published).toBe(1000);
  });

  it('should return response with expected shape including outbox stats', async () => {
    mockGetOutboxStats.mockResolvedValue({ pending: 2, failed: 1, published_today: 5 });

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    const body = await response.json();
    expect(body).toHaveProperty('published');
    expect(body).toHaveProperty('batches');
    expect(body).toHaveProperty('cleaned');
    expect(body).toHaveProperty('pending');
    expect(body).toHaveProperty('failed');
    expect(body).toHaveProperty('duration_ms');
    expect(body.pending).toBe(2);
    expect(body.failed).toBe(1);
  });

  it('should return 500 when worker throws', async () => {
    mockProcessOutbox.mockRejectedValue(new Error('Database connection failed'));

    const request = makeRequest({ authorization: `Bearer ${CRON_SECRET}` });
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Event outbox worker failed');
    expect(body.message).toBe('Database connection failed');
  });
});
