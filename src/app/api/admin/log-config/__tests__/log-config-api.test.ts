/**
 * Tests for:
 * - GET  /api/admin/log-config
 * - POST /api/admin/log-config
 *
 * Key behavior:
 * - Uses getSessionFromRequest (not requireAdminAuth)
 * - GET: returns current log config + timestamp
 * - POST: validates module + level, calls logConfig.setLevel
 * - POST: invalid module/level → 400 (Zod)
 * - POST: logConfig.setLevel throws 'inválido' → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockGetSession,
  mockGetAllConfig,
  mockSetLevel,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetAllConfig: vi.fn(),
  mockSetLevel: vi.fn(async () => {}),
}));

vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: mockGetSession,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/observability/log-config', () => ({
  logConfig: {
    getAllConfig: mockGetAllConfig,
    setLevel: mockSetLevel,
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from '../route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const baseSession = { employeeId: 'emp-1', tenantId: 'tenant-1', role: 'ADMIN' };

const baseConfig = {
  auth: 'INFO',
  sync: 'WARN',
  events: 'INFO',
  orders: 'INFO',
  global: 'INFO',
};

function makeRequest(method = 'GET', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/log-config', {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockSessionOk() {
  mockGetSession.mockResolvedValue(baseSession);
}

function mockSessionFail() {
  mockGetSession.mockResolvedValue(null);
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/admin/log-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockGetAllConfig.mockReturnValue(baseConfig);
  });

  it('returns 401 without session', async () => {
    mockSessionFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with config and timestamp', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('returns current config from logConfig.getAllConfig', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.config.auth).toBe('INFO');
    expect(body.config.global).toBe('INFO');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetAllConfig.mockImplementation(() => { throw new Error('Boom'); });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/log-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockGetAllConfig.mockReturnValue(baseConfig);
    mockSetLevel.mockResolvedValue(undefined);
  });

  it('returns 401 without session', async () => {
    mockSessionFail();
    const res = await POST(makeRequest('POST', { module: 'auth', level: 'DEBUG' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 on valid update', async () => {
    const res = await POST(makeRequest('POST', { module: 'auth', level: 'DEBUG' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('calls logConfig.setLevel with correct args', async () => {
    await POST(makeRequest('POST', { module: 'sync', level: 'WARN', reason: 'Debugging sync' }));
    expect(mockSetLevel).toHaveBeenCalledWith('sync', 'WARN', 'emp-1', 'Debugging sync');
  });

  it('returns 400 on invalid module', async () => {
    const res = await POST(makeRequest('POST', { module: 'INVALID', level: 'DEBUG' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid level', async () => {
    const res = await POST(makeRequest('POST', { module: 'auth', level: 'VERBOSE' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when setLevel throws with "inválido"', async () => {
    mockSetLevel.mockRejectedValue(new Error('Valor inválido para el módulo'));
    const res = await POST(makeRequest('POST', { module: 'auth', level: 'DEBUG' }));
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockSetLevel.mockRejectedValue(new Error('DB connection lost'));
    const res = await POST(makeRequest('POST', { module: 'auth', level: 'DEBUG' }));
    expect(res.status).toBe(500);
  });
});
