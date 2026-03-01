/**
 * Events Ingest API Tests
 *
 * Tests for POST /api/events/ingest
 * Auth: x-api-secret header (not JWT middleware)
 *
 * @module app/api/events/__tests__/ingest-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock prisma with $transaction support
const mockTransaction = vi.fn();
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $transaction: (...args: any[]) => mockTransaction(...args),
    event_outbox: { updateMany: vi.fn().mockResolvedValue({}) },
  },
}));

// Mock validation
vi.mock('@/src/core/validation', () => ({
  validateEvent: vi.fn().mockResolvedValue({ valid: true }),
}));

// Mock inventory deduction
vi.mock('@/src/core/inventory/deduction.service', () => ({
  deductInventoryForOrder: vi.fn().mockResolvedValue({ success: true, deductions: [], alerts: [] }),
}));

// Mock conflict resolver
vi.mock('@/src/core/conflict/conflict-resolver', () => ({
  detectAndResolveConflict: vi.fn().mockResolvedValue({ hasConflict: false }),
}));

// Mock notification handlers
vi.mock('@/src/core/notifications/event-listener', () => ({
  registerNotificationHandlers: vi.fn(),
}));

// Mock out-of-order queue
vi.mock('@/src/core/events/out-of-order-queue', () => ({
  outOfOrderQueue: {
    enqueue: vi.fn(),
    processQueuedEvents: vi.fn().mockResolvedValue([]),
  },
  startCleanupJob: vi.fn(),
}));

// Mock rate limiter
const mockCheckLimit = vi.fn();
vi.mock('@/src/core/rate-limiting/rate-limiter', () => ({
  rateLimiter: { checkLimit: (...args: any[]) => mockCheckLimit(...args) },
}));

// Mock event bus
vi.mock('@/src/core/infra/event-bus', () => ({
  eventBus: { publish: vi.fn() },
}));

// Mock structured logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = 'test-api-secret';

function makeRequest(body: any, secret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret !== undefined) {
    headers['x-api-secret'] = secret;
  }
  return new Request('http://localhost/api/events/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

function makeValidEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: '11111111-1111-1111-1111-111111111111',
    tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    terminal_id: 'term-1',
    terminal_sequence: 1,
    occurred_at: new Date().toISOString(),
    aggregate_type: 'SHIFT',
    aggregate_id: '22222222-2222-2222-2222-222222222222',
    correlation_id: 'corr-1',
    actor_id: '33333333-3333-3333-3333-333333333333',
    event_type: 'SHIFT_OPENED',
    schema_version: 1,
    payload: {
      shift_id: '22222222-2222-2222-2222-222222222222',
      cash_opening_cents: 50000,
    },
    ...overrides,
  };
}

function makeValidBody(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    terminal_id: 'term-1',
    from_terminal_sequence: 0,
    to_terminal_sequence: 1,
    events: [makeValidEvent()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: POST /api/events/ingest
// ---------------------------------------------------------------------------

describe('POST /api/events/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PARK_API_SECRET = VALID_SECRET;
    mockCheckLimit.mockResolvedValue({ allowed: true });
  });

  it('debe rechazar sin x-api-secret (401)', async () => {
    const { POST } = await import('../ingest/route');
    const res = await POST(makeRequest(makeValidBody()));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.accepted).toBe(false);
    expect(data.error.error_code).toBe('UNAUTHORIZED');
  });

  it('debe rechazar con x-api-secret incorrecto (401)', async () => {
    const { POST } = await import('../ingest/route');
    const res = await POST(makeRequest(makeValidBody(), 'wrong-secret'));

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.accepted).toBe(false);
  });

  it('debe rechazar JSON inválido (400)', async () => {
    const { POST } = await import('../ingest/route');
    const req = new Request('http://localhost/api/events/ingest', {
      method: 'POST',
      body: 'not-json{{{',
      headers: {
        'Content-Type': 'application/json',
        'x-api-secret': VALID_SECRET,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.error_code).toBe('INVALID_JSON');
  });

  it('debe rechazar body que no cumple el schema (400)', async () => {
    const { POST } = await import('../ingest/route');
    const res = await POST(makeRequest({ bad: 'data' }, VALID_SECRET));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.error_code).toBe('SCHEMA_VALIDATION_FAILED');
  });

  it('debe retornar 429 cuando rate limit excedido', async () => {
    mockCheckLimit.mockResolvedValue({
      allowed: false,
      limitType: 'burst',
      retryAfter: 5,
      currentCount: 100,
      limit: 50,
    });

    const { POST } = await import('../ingest/route');
    const res = await POST(makeRequest(makeValidBody(), VALID_SECRET));

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.accepted).toBe(false);
    expect(data.error.error_code).toBe('BURST_LIMIT_EXCEEDED');
    expect(res.headers.get('Retry-After')).toBe('5');
  });

  it('debe aceptar batch válido y retornar 200', async () => {
    // Mock transaction to simulate successful processing
    mockTransaction.mockImplementation(async (fn: Function) => {
      // Provide a mock tx that the function can call into
      const tx = {
        processed_events: {
          create: vi.fn().mockResolvedValue({}),
        },
        orders: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({}),
        },
        events: {
          create: vi.fn().mockResolvedValue({}),
        },
        event_outbox: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const { POST } = await import('../ingest/route');
    const res = await POST(makeRequest(makeValidBody(), VALID_SECRET));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.accepted).toBe(true);
    expect(data.tenant_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('debe rechazar body sin tenant_id (400)', async () => {
    const { POST } = await import('../ingest/route');
    const body = makeValidBody();
    delete (body as any).tenant_id;
    const res = await POST(makeRequest(body, VALID_SECRET));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.error_code).toBe('SCHEMA_VALIDATION_FAILED');
  });
});
