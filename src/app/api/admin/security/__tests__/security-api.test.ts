/**
 * Tests for:
 * - GET  /api/admin/security/alerts                    (getSessionFromRequest + admin role check)
 * - POST /api/admin/security/alerts/[alertId]/resolve  (requireAdminAuth + 404/403 + resolveAlert)
 * - GET  /api/admin/security/devices                   (getSessionFromRequest + admin role check)
 * - POST /api/admin/security/devices/[mac]/block       (getSessionFromRequest + blockMAC)
 * - GET  /api/admin/security/sessions                  (getSessionFromRequest + admin role check)
 * - POST /api/admin/security/sessions/[sessionId]/revoke (requireAdminAuth + 404/403 + update)
 * - GET  /api/admin/security/terminals/[id]/access-log (getSessionFromRequest + admin role check)
 *
 * Key behavior:
 * - Two auth patterns: getSessionFromRequest (older) + requireAdminAuth (newer)
 * - getSessionFromRequest routes: 401 if no session, 403 if non-admin role
 * - resolve + revoke: 404 if not found, 403 if wrong tenant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetSessionFromRequest,
  mockResolveAlert,
  mockLogAction,
  mockBlockMAC,
  // prisma mocks per model
  mockEmployeesFindUnique,
  mockEmployeesFindFirst,
  mockEmployeesFindMany,
  mockAlertsFindMany,
  mockAlertsCount,
  mockAlertsFindUnique,
  mockAlertsCreate,
  mockDevicesFindMany,
  mockDevicesFindFirst,
  mockSessionsFindMany,
  mockSessionsFindUnique,
  mockSessionsUpdate,
  mockAccessLogFindMany,
  mockAccessLogCount,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetSessionFromRequest: vi.fn(),
  mockResolveAlert: vi.fn(),
  mockLogAction: vi.fn(),
  mockBlockMAC: vi.fn(),
  mockEmployeesFindUnique: vi.fn(),
  mockEmployeesFindFirst: vi.fn(),
  mockEmployeesFindMany: vi.fn(),
  mockAlertsFindMany: vi.fn(),
  mockAlertsCount: vi.fn(),
  mockAlertsFindUnique: vi.fn(),
  mockAlertsCreate: vi.fn(),
  mockDevicesFindMany: vi.fn(),
  mockDevicesFindFirst: vi.fn(),
  mockSessionsFindMany: vi.fn(),
  mockSessionsFindUnique: vi.fn(),
  mockSessionsUpdate: vi.fn(),
  mockAccessLogFindMany: vi.fn(),
  mockAccessLogCount: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
  validateToken: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    employees: {
      findUnique: mockEmployeesFindUnique,
      findFirst: mockEmployeesFindFirst,
      findMany: mockEmployeesFindMany,
    },
    session_alerts: {
      findMany: mockAlertsFindMany,
      count: mockAlertsCount,
      findUnique: mockAlertsFindUnique,
      create: mockAlertsCreate,
    },
    device_mac_addresses: {
      findMany: mockDevicesFindMany,
      findFirst: mockDevicesFindFirst,
    },
    active_sessions: {
      findMany: mockSessionsFindMany,
      findUnique: mockSessionsFindUnique,
      update: mockSessionsUpdate,
    },
    terminal_mac_registry: {
      findMany: mockAccessLogFindMany,
      count: mockAccessLogCount,
    },
  },
}));

vi.mock('@/src/core/security/alert-service', () => ({
  resolveAlert: mockResolveAlert,
}));

vi.mock('@/src/core/security/rate-limiter', () => ({
  logAction: mockLogAction,
}));

vi.mock('@/src/core/security/mac-validator-hybrid', () => ({
  blockMAC: mockBlockMAC,
}));

vi.mock('@/src/core/security/session-validator', () => ({
  closeSession: vi.fn(),
}));

vi.mock('@/src/lib/cors-helpers', () => ({
  handleCorsPreflightRequest: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GETAlerts } from '../alerts/route';
import { POST as POSTResolve } from '../alerts/[alertId]/resolve/route';
import { GET as GETDevices } from '../devices/route';
import { POST as POSTBlockDevice } from '../devices/[mac]/block/route';
import { GET as GETSessions } from '../sessions/route';
import { POST as POSTRevoke } from '../sessions/[sessionId]/revoke/route';
import { GET as GETAccessLog } from '../terminals/[id]/access-log/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const ALERT_ID = 'b0000000-0000-0000-0000-000000000001';
const SESSION_ID = 'c0000000-0000-0000-0000-000000000001';
const TERMINAL_ID = 'd0000000-0000-0000-0000-000000000001';
const MAC_ADDRESS = 'AA:BB:CC:DD:EE:FF';

const adminEmployee = { id: EMPLOYEE_ID, role: 'ADMIN', name: 'Admin User' };
const baseAlert = { id: ALERT_ID, tenant_id: TENANT_ID, alert_type: 'SUSPICIOUS_LOGIN', is_resolved: false, employee_id: EMPLOYEE_ID };
const baseSession = { id: SESSION_ID, tenant_id: TENANT_ID, employee_id: EMPLOYEE_ID, is_active: true };

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

function mockSessionOk() {
  mockGetSessionFromRequest.mockResolvedValue({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID });
  mockEmployeesFindFirst.mockResolvedValue(adminEmployee);
}

function mockSessionNone() {
  mockGetSessionFromRequest.mockResolvedValue(null);
}

function mockSessionNonAdmin() {
  mockGetSessionFromRequest.mockResolvedValue({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID });
  mockEmployeesFindFirst.mockResolvedValue({ id: EMPLOYEE_ID, role: 'CASHIER', name: 'Cashier' });
}

function mockAdminAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID },
  });
}

function mockAdminAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/security/alerts ──────────────────────────────────────────

describe('GET /api/admin/security/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockAlertsFindMany.mockResolvedValue([baseAlert]);
    mockAlertsCount.mockResolvedValue(1);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETAlerts(makeRequest('/api/admin/security/alerts'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockSessionNonAdmin();
    const res = await GETAlerts(makeRequest('/api/admin/security/alerts'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with { alerts, total }', async () => {
    const res = await GETAlerts(makeRequest('/api/admin/security/alerts'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('uses tenant_id from session', async () => {
    await GETAlerts(makeRequest('/api/admin/security/alerts'));
    expect(mockAlertsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});

// ─── POST /api/admin/security/alerts/[alertId]/resolve ───────────────────────

describe('POST /api/admin/security/alerts/[alertId]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuthOk();
    mockAlertsFindUnique.mockResolvedValue(baseAlert);
    mockResolveAlert.mockResolvedValue(undefined);
    mockLogAction.mockResolvedValue(undefined);
  });

  it('returns 401 without auth', async () => {
    mockAdminAuthFail();
    const res = await POSTResolve(
      makeRequest(`/api/admin/security/alerts/${ALERT_ID}/resolve`, 'POST', {}),
      makeParams({ alertId: ALERT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTResolve(
      makeRequest(`/api/admin/security/alerts/${ALERT_ID}/resolve`, 'POST', { notes: 'Reviewed' }),
      makeParams({ alertId: ALERT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when alert not found', async () => {
    mockAlertsFindUnique.mockResolvedValue(null);
    const res = await POSTResolve(
      makeRequest(`/api/admin/security/alerts/${ALERT_ID}/resolve`, 'POST', {}),
      makeParams({ alertId: ALERT_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when alert belongs to different tenant', async () => {
    mockAlertsFindUnique.mockResolvedValue({ ...baseAlert, tenant_id: 'other-tenant-00000000-0000' });
    const res = await POSTResolve(
      makeRequest(`/api/admin/security/alerts/${ALERT_ID}/resolve`, 'POST', {}),
      makeParams({ alertId: ALERT_ID }),
    );
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/security/devices ─────────────────────────────────────────

describe('GET /api/admin/security/devices', () => {
  const baseDevice = { mac_address: MAC_ADDRESS, employee_id: EMPLOYEE_ID, tenant_id: TENANT_ID, trust_level: 'TRUSTED', is_active: true, access_count: 5 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockDevicesFindMany.mockResolvedValue([baseDevice]);
    mockEmployeesFindMany.mockResolvedValue([adminEmployee]);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETDevices(makeRequest('/api/admin/security/devices'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockSessionNonAdmin();
    const res = await GETDevices(makeRequest('/api/admin/security/devices'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with { devices }', async () => {
    const res = await GETDevices(makeRequest('/api/admin/security/devices'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
  });
});

// ─── POST /api/admin/security/devices/[mac]/block ────────────────────────────

describe('POST /api/admin/security/devices/[mac]/block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockBlockMAC.mockResolvedValue(undefined);
    mockDevicesFindFirst.mockResolvedValue(null); // device not found → no alert created
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await POSTBlockDevice(
      makeRequest(`/api/admin/security/devices/${MAC_ADDRESS}/block`, 'POST', { reason: 'Suspicious' }),
      makeParams({ mac: MAC_ADDRESS }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockSessionNonAdmin();
    const res = await POSTBlockDevice(
      makeRequest(`/api/admin/security/devices/${MAC_ADDRESS}/block`, 'POST', { reason: 'Suspicious' }),
      makeParams({ mac: MAC_ADDRESS }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 and calls blockMAC', async () => {
    const res = await POSTBlockDevice(
      makeRequest(`/api/admin/security/devices/${MAC_ADDRESS}/block`, 'POST', { reason: 'Suspicious' }),
      makeParams({ mac: MAC_ADDRESS }),
    );
    expect(res.status).toBe(200);
    expect(mockBlockMAC).toHaveBeenCalledWith(TENANT_ID, MAC_ADDRESS, 'Suspicious');
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── GET /api/admin/security/sessions ────────────────────────────────────────

describe('GET /api/admin/security/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockSessionsFindMany.mockResolvedValue([baseSession]);
    mockEmployeesFindMany.mockResolvedValue([adminEmployee]);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETSessions(makeRequest('/api/admin/security/sessions'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockSessionNonAdmin();
    const res = await GETSessions(makeRequest('/api/admin/security/sessions'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with { sessions }', async () => {
    const res = await GETSessions(makeRequest('/api/admin/security/sessions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(1);
  });
});

// ─── POST /api/admin/security/sessions/[sessionId]/revoke ────────────────────

describe('POST /api/admin/security/sessions/[sessionId]/revoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuthOk();
    mockSessionsFindUnique.mockResolvedValue(baseSession);
    mockSessionsUpdate.mockResolvedValue({ ...baseSession, is_active: false });
    mockLogAction.mockResolvedValue(undefined);
  });

  it('returns 401 without auth', async () => {
    mockAdminAuthFail();
    const res = await POSTRevoke(
      makeRequest(`/api/admin/security/sessions/${SESSION_ID}/revoke`, 'POST', {}),
      makeParams({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTRevoke(
      makeRequest(`/api/admin/security/sessions/${SESSION_ID}/revoke`, 'POST', { reason: 'Suspicious activity' }),
      makeParams({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when session not found', async () => {
    mockSessionsFindUnique.mockResolvedValue(null);
    const res = await POSTRevoke(
      makeRequest(`/api/admin/security/sessions/${SESSION_ID}/revoke`, 'POST', {}),
      makeParams({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when session belongs to different tenant', async () => {
    mockSessionsFindUnique.mockResolvedValue({ ...baseSession, tenant_id: 'other-tenant' });
    const res = await POSTRevoke(
      makeRequest(`/api/admin/security/sessions/${SESSION_ID}/revoke`, 'POST', {}),
      makeParams({ sessionId: SESSION_ID }),
    );
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/security/terminals/[id]/access-log ───────────────────────

describe('GET /api/admin/security/terminals/[id]/access-log', () => {
  const baseLogEntry = { mac_address: MAC_ADDRESS, employee_id: EMPLOYEE_ID, first_seen: new Date(), last_seen: new Date(), access_count: 3, is_authorized: true };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockAccessLogFindMany.mockResolvedValue([baseLogEntry]);
    mockAccessLogCount.mockResolvedValue(1);
    mockEmployeesFindMany.mockResolvedValue([adminEmployee]);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETAccessLog(
      makeRequest(`/api/admin/security/terminals/${TERMINAL_ID}/access-log`),
      makeParams({ id: TERMINAL_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    mockSessionNonAdmin();
    const res = await GETAccessLog(
      makeRequest(`/api/admin/security/terminals/${TERMINAL_ID}/access-log`),
      makeParams({ id: TERMINAL_ID }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 with { access_log, total }', async () => {
    const res = await GETAccessLog(
      makeRequest(`/api/admin/security/terminals/${TERMINAL_ID}/access-log`),
      makeParams({ id: TERMINAL_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_log).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.terminal_id).toBe(TERMINAL_ID);
  });
});
