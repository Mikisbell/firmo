/**
 * Health Check API Tests
 *
 * Tests for GET /api/health and HEAD /api/health
 * Auth: Public endpoint (no auth required)
 *
 * @module app/api/health/__tests__/health-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCheck = vi.fn();

vi.mock('@/src/core/health/health-check', () => ({
  healthCheckService: {
    check: (...args: any[]) => mockCheck(...args),
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHealthyResult() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      database: { status: 'up', responseTime: 15 },
      redis: { status: 'up', responseTime: 5 },
      eventSourcing: { status: 'up', responseTime: 2 },
    },
    responseTime: 22,
  };
}

function makeDegradedResult() {
  return {
    status: 'degraded',
    timestamp: new Date().toISOString(),
    components: {
      database: { status: 'up', responseTime: 15 },
      redis: { status: 'degraded', responseTime: 500, message: 'Alta latencia' },
      eventSourcing: { status: 'up', responseTime: 2 },
    },
    responseTime: 517,
  };
}

function makeUnhealthyResult() {
  return {
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
    components: {
      database: { status: 'down', responseTime: 0, message: 'Connection refused' },
      redis: { status: 'down', responseTime: 0 },
      eventSourcing: { status: 'down', responseTime: 0 },
    },
    responseTime: 0,
  };
}

// ---------------------------------------------------------------------------
// Tests: GET /api/health
// ---------------------------------------------------------------------------

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 200 cuando el sistema está sano', async () => {
    mockCheck.mockResolvedValue(makeHealthyResult());

    const { GET } = await import('../route');
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.components.database.status).toBe('up');
    expect(data.components.redis.status).toBe('up');
    expect(data.components.eventSourcing.status).toBe('up');
  });

  it('debe retornar 200 cuando el sistema está degradado', async () => {
    mockCheck.mockResolvedValue(makeDegradedResult());

    const { GET } = await import('../route');
    const res = await GET();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('degraded');
    expect(data.components.redis.status).toBe('degraded');
  });

  it('debe retornar 503 cuando el sistema no está sano', async () => {
    mockCheck.mockResolvedValue(makeUnhealthyResult());

    const { GET } = await import('../route');
    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe('unhealthy');
    expect(data.components.database.status).toBe('down');
  });

  it('debe retornar 503 cuando health check lanza error', async () => {
    mockCheck.mockRejectedValue(new Error('Timeout al conectar a DB'));

    const { GET } = await import('../route');
    const res = await GET();

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe('unhealthy');
    expect(data.error).toContain('Timeout');
  });

  it('debe incluir cabeceras no-cache', async () => {
    mockCheck.mockResolvedValue(makeHealthyResult());

    const { GET } = await import('../route');
    const res = await GET();

    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    expect(res.headers.get('Pragma')).toBe('no-cache');
  });

  it('debe incluir timestamp en la respuesta', async () => {
    mockCheck.mockResolvedValue(makeHealthyResult());

    const { GET } = await import('../route');
    const res = await GET();

    const data = await res.json();
    expect(data.timestamp).toBeDefined();
    // Should be a valid ISO string
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});

// ---------------------------------------------------------------------------
// Tests: HEAD /api/health
// ---------------------------------------------------------------------------

describe('HEAD /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe retornar 200 cuando el sistema está sano', async () => {
    mockCheck.mockResolvedValue(makeHealthyResult());

    const { HEAD } = await import('../route');
    const res = await HEAD();

    expect(res.status).toBe(200);
  });

  it('debe retornar 503 cuando el sistema no está sano', async () => {
    mockCheck.mockResolvedValue(makeUnhealthyResult());

    const { HEAD } = await import('../route');
    const res = await HEAD();

    expect(res.status).toBe(503);
  });

  it('debe retornar 503 cuando health check lanza error', async () => {
    mockCheck.mockRejectedValue(new Error('Service unavailable'));

    const { HEAD } = await import('../route');
    const res = await HEAD();

    expect(res.status).toBe(503);
  });
});
