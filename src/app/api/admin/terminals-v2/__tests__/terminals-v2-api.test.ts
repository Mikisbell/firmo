/**
 * Tests for:
 * - GET  /api/admin/terminals-v2              (list terminals + activation codes)
 * - POST /api/admin/terminals-v2/create       (create terminal — validates role enum)
 * - POST /api/admin/terminals-v2/[terminalId]/unbind  (unbind device — 400 if already unbound)
 * - GET  /api/admin/terminals-v2/[terminalId]/debug   (no auth — 404 in production)
 *
 * Key behavior:
 * - List/Create/Unbind: requireAdminAuth, tenant_id from JWT
 * - Create: role must be one of CAJA | MOZO | KDS_COCINA | KDS_HORNO | KDS_BAR
 * - Unbind: 404 if terminal not found; 400 if already unbound (no fingerprint + pending)
 * - Debug: no auth guard; returns 404 in NODE_ENV=production
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockCreateTerminal,
  mockTerminalDevicesFindMany,
  mockActivationCodesFindMany,
  mockTerminalDevicesFindFirst,
  mockTerminalDevicesUpdate,
  mockEventsCreate,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockCreateTerminal: vi.fn(),
  mockTerminalDevicesFindMany: vi.fn(),
  mockActivationCodesFindMany: vi.fn(),
  mockTerminalDevicesFindFirst: vi.fn(),
  mockTerminalDevicesUpdate: vi.fn(),
  mockEventsCreate: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/auth/terminal-registry', () => ({
  createTerminal: mockCreateTerminal,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    terminal_devices: {
      findMany: mockTerminalDevicesFindMany,
      findFirst: mockTerminalDevicesFindFirst,
      update: mockTerminalDevicesUpdate,
    },
    activation_codes: { findMany: mockActivationCodesFindMany },
    events: { create: mockEventsCreate },
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GETList } from '../route';
import { POST as POSTCreate } from '../create/route';
import { POST as POSTUnbind } from '../[terminalId]/unbind/route';
import { GET as GETDebug } from '../[terminalId]/debug/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const TERMINAL_ID = 'CAJA-01';

const baseTerminal = {
  id: 'b0000000-0000-0000-0000-000000000001',
  terminal_id: TERMINAL_ID,
  role: 'CAJA',
  status: 'active',
  device_name: 'Caja Principal',
  tenant_id: TENANT_ID,
  fingerprint_hash: 'abc123def456',
};

function makeRequest(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams<T extends object>(obj: T) {
  return { params: Promise.resolve(obj) };
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/terminals-v2 ─────────────────────────────────────────────

describe('GET /api/admin/terminals-v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTerminalDevicesFindMany.mockResolvedValue([baseTerminal]);
    mockActivationCodesFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETList(makeRequest('/api/admin/terminals-v2'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { devices, summary }', async () => {
    const res = await GETList(makeRequest('/api/admin/terminals-v2'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
    expect(body.summary.total).toBe(1);
    expect(body.summary.active).toBe(1);
  });

  it('attaches activation codes to devices', async () => {
    mockActivationCodesFindMany.mockResolvedValue([
      { terminal_id: TERMINAL_ID, code: 'ABC123', expires_at: new Date() },
    ]);
    const res = await GETList(makeRequest('/api/admin/terminals-v2'));
    const body = await res.json();
    expect(body.devices[0].activation_code).not.toBeNull();
  });

  it('scopes query by tenant_id from JWT', async () => {
    await GETList(makeRequest('/api/admin/terminals-v2'));
    expect(mockTerminalDevicesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_ID } }),
    );
  });
});

// ─── POST /api/admin/terminals-v2/create ─────────────────────────────────────

describe('POST /api/admin/terminals-v2/create', () => {
  const validBody = {
    terminal_id: TERMINAL_ID,
    role: 'CAJA',
    location_id: 'loc-001',
    device_name: 'Caja Principal',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCreateTerminal.mockResolvedValue({
      terminal: { ...baseTerminal, status: 'pending' },
      code: { code: 'ABC123', expires_at: new Date() },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTCreate(makeRequest('/api/admin/terminals-v2/create', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 200 with terminal + activation_code', async () => {
    const res = await POSTCreate(makeRequest('/api/admin/terminals-v2/create', 'POST', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.activation_code.code).toBe('ABC123');
  });

  it('passes tenant_id from JWT to createTerminal', async () => {
    await POSTCreate(makeRequest('/api/admin/terminals-v2/create', 'POST', validBody));
    expect(mockCreateTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT_ID }),
    );
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POSTCreate(
      makeRequest('/api/admin/terminals-v2/create', 'POST', { terminal_id: TERMINAL_ID }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid role', async () => {
    const res = await POSTCreate(
      makeRequest('/api/admin/terminals-v2/create', 'POST', { ...validBody, role: 'INVALID_ROLE' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate terminal_id (Unique constraint error)', async () => {
    mockCreateTerminal.mockRejectedValue(new Error('Unique constraint violation'));
    const res = await POSTCreate(makeRequest('/api/admin/terminals-v2/create', 'POST', validBody));
    expect(res.status).toBe(409);
  });
});

// ─── POST /api/admin/terminals-v2/[terminalId]/unbind ────────────────────────

describe('POST /api/admin/terminals-v2/[terminalId]/unbind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    // Default: active terminal with fingerprint (can be unbound)
    mockTerminalDevicesFindFirst.mockResolvedValue(baseTerminal);
    mockTerminalDevicesUpdate.mockResolvedValue({ ...baseTerminal, fingerprint_hash: null, status: 'pending' });
    mockEventsCreate.mockResolvedValue({});
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTUnbind(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/unbind`, 'POST'),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when terminal not found', async () => {
    mockTerminalDevicesFindFirst.mockResolvedValue(null);
    const res = await POSTUnbind(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/unbind`, 'POST'),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when terminal is already unbound (no fingerprint + pending)', async () => {
    mockTerminalDevicesFindFirst.mockResolvedValue({
      ...baseTerminal,
      fingerprint_hash: null,
      status: 'pending',
    });
    const res = await POSTUnbind(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/unbind`, 'POST'),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 and unbinds active terminal', async () => {
    const res = await POSTUnbind(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/unbind`, 'POST'),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockTerminalDevicesUpdate).toHaveBeenCalled();
    expect(mockEventsCreate).toHaveBeenCalled();
  });
});

// ─── GET /api/admin/terminals-v2/[terminalId]/debug ──────────────────────────

describe('GET /api/admin/terminals-v2/[terminalId]/debug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockAuthOk();
    mockTerminalDevicesFindFirst.mockResolvedValue(baseTerminal);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 in production (before auth check)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await GETDebug(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/debug`),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    mockAuthFail();
    const res = await GETDebug(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/debug`),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with debug info in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const res = await GETDebug(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/debug`),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.terminal).toBeDefined();
    expect(body.checks).toBeDefined();
  });

  it('returns 404 when terminal not found', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    mockTerminalDevicesFindFirst.mockResolvedValue(null);
    const res = await GETDebug(
      makeRequest(`/api/admin/terminals-v2/${TERMINAL_ID}/debug`),
      makeParams({ terminalId: TERMINAL_ID }),
    );
    expect(res.status).toBe(404);
  });
});
