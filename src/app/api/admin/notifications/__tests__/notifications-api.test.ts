/**
 * Tests for:
 * - GET  /api/admin/notifications
 * - POST /api/admin/notifications/[id]/read
 * - POST /api/admin/notifications/read-all
 * - GET  /api/admin/notifications/status
 * - POST /api/admin/notifications/test
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id + employee_id from JWT
 * - [id]/read: verifies tenant + recipient before marking read (not just id)
 * - status: uses getSessionFromRequest + role check (ADMIN|MANAGER)
 * - test: role check (OWNER|ADMIN|MANAGER), requires employee_id body
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetSession,
  mockNotificationsFindMany,
  mockNotificationsCount,
  mockNotificationsFindFirst,
  mockNotificationsUpdate,
  mockNotificationsUpdateMany,
  mockNotificationsCreate,
  mockEmployeesFindMany,
  mockEmployeesFindFirst,
  mockPushSubscriptionsFindMany,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetSession: vi.fn(),
  mockNotificationsFindMany: vi.fn(),
  mockNotificationsCount: vi.fn(),
  mockNotificationsFindFirst: vi.fn(),
  mockNotificationsUpdate: vi.fn(async () => ({})),
  mockNotificationsUpdateMany: vi.fn(async () => ({ count: 3 })),
  mockNotificationsCreate: vi.fn(),
  mockEmployeesFindMany: vi.fn(),
  mockEmployeesFindFirst: vi.fn(),
  mockPushSubscriptionsFindMany: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: mockGetSession,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    notifications: {
      findMany: mockNotificationsFindMany,
      count: mockNotificationsCount,
      findFirst: mockNotificationsFindFirst,
      update: mockNotificationsUpdate,
      updateMany: mockNotificationsUpdateMany,
      create: mockNotificationsCreate,
    },
    employees: {
      findMany: mockEmployeesFindMany,
      findFirst: mockEmployeesFindFirst,
    },
    push_subscriptions: { findMany: mockPushSubscriptionsFindMany },
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/src/core/constants/roles', () => ({
  ADMIN_ROLES: ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR'],
}));

import { GET as GETList } from '../route';
import { POST as POSTRead } from '../[id]/read/route';
import { POST as POSTReadAll } from '../read-all/route';
import { GET as GETStatus } from '../status/route';
import { POST as POSTTest } from '../test/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const NOTIF_ID = 'ntf00000-0000-0000-0000-000000000001';

const baseNotifs = [
  { id: NOTIF_ID, tenant_id: TENANT_ID, recipient_id: EMPLOYEE_ID, type: 'GENERAL', title: 'Test', body: 'Hello', read: false, created_at: new Date() },
];

function makeRequest(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockAuthOk(role = 'ADMIN') {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role, tenantId: TENANT_ID },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

function mockSessionOk(role = 'ADMIN') {
  mockGetSession.mockResolvedValue({ employeeId: EMPLOYEE_ID, role, tenantId: TENANT_ID });
}

function mockSessionFail() {
  mockGetSession.mockResolvedValue(null);
}

// ─── GET /api/admin/notifications ─────────────────────────────────────────────

describe('GET /api/admin/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockNotificationsFindMany.mockResolvedValue(baseNotifs);
    mockNotificationsCount.mockResolvedValue(1);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETList(makeRequest('/api/admin/notifications'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { data, unread_count }', async () => {
    const res = await GETList(makeRequest('/api/admin/notifications'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.unread_count).toBe(1);
  });

  it('queries scoped by tenant_id + employee_id from JWT', async () => {
    await GETList(makeRequest('/api/admin/notifications'));
    expect(mockNotificationsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, recipient_id: EMPLOYEE_ID }),
      }),
    );
  });

  it('returns 500 on DB error', async () => {
    mockNotificationsFindMany.mockRejectedValue(new Error('DB error'));
    const res = await GETList(makeRequest('/api/admin/notifications'));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/admin/notifications/[id]/read ──────────────────────────────────

describe('POST /api/admin/notifications/[id]/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockNotificationsUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTRead(makeRequest(`/api/admin/notifications/${NOTIF_ID}/read`, 'POST'), makeParams(NOTIF_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTRead(makeRequest(`/api/admin/notifications/${NOTIF_ID}/read`, 'POST'), makeParams(NOTIF_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('updateMany uses tenant_id + recipient_id atomically (no TOCTOU)', async () => {
    await POSTRead(makeRequest(`/api/admin/notifications/${NOTIF_ID}/read`, 'POST'), makeParams(NOTIF_ID));
    expect(mockNotificationsUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: NOTIF_ID, tenant_id: TENANT_ID, recipient_id: EMPLOYEE_ID }),
        data: { read: true },
      }),
    );
  });

  it('returns 404 when notification not found or belongs to another tenant (count=0)', async () => {
    mockNotificationsUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POSTRead(makeRequest(`/api/admin/notifications/${NOTIF_ID}/read`, 'POST'), makeParams(NOTIF_ID));
    expect(res.status).toBe(404);
  });

  it('returns 500 on DB error', async () => {
    mockNotificationsUpdateMany.mockRejectedValue(new Error('DB error'));
    const res = await POSTRead(makeRequest(`/api/admin/notifications/${NOTIF_ID}/read`, 'POST'), makeParams(NOTIF_ID));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/admin/notifications/read-all ───────────────────────────────────

describe('POST /api/admin/notifications/read-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockNotificationsUpdateMany.mockResolvedValue({ count: 3 });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTReadAll(makeRequest('/api/admin/notifications/read-all', 'POST'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { success, updated }', async () => {
    const res = await POSTReadAll(makeRequest('/api/admin/notifications/read-all', 'POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(3);
  });

  it('updates only unread notifications for tenant + employee', async () => {
    await POSTReadAll(makeRequest('/api/admin/notifications/read-all', 'POST'));
    expect(mockNotificationsUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, recipient_id: EMPLOYEE_ID, read: false }),
      }),
    );
  });

  it('returns 500 on DB error', async () => {
    mockNotificationsUpdateMany.mockRejectedValue(new Error('DB error'));
    const res = await POSTReadAll(makeRequest('/api/admin/notifications/read-all', 'POST'));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/notifications/status ─────────────────────────────────────

describe('GET /api/admin/notifications/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk('ADMIN');
    mockEmployeesFindMany.mockResolvedValue([{ id: EMPLOYEE_ID, name: 'Test User' }]);
    mockPushSubscriptionsFindMany.mockResolvedValue([]);
  });

  it('returns 401 without session', async () => {
    mockSessionFail();
    const res = await GETStatus(makeRequest('/api/admin/notifications/status'));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin/manager role', async () => {
    mockSessionOk('CASHIER');
    const res = await GETStatus(makeRequest('/api/admin/notifications/status'));
    expect(res.status).toBe(403);
  });

  it('returns 200 with employee statuses for ADMIN', async () => {
    const res = await GETStatus(makeRequest('/api/admin/notifications/status'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.employees)).toBe(true);
    expect(body.employees[0].employee_id).toBe(EMPLOYEE_ID);
    expect(body.employees[0].has_subscription).toBe(false);
  });

  it('allows MANAGER role', async () => {
    mockSessionOk('MANAGER');
    const res = await GETStatus(makeRequest('/api/admin/notifications/status'));
    expect(res.status).toBe(200);
  });

  it('queries employees by tenant_id from session', async () => {
    await GETStatus(makeRequest('/api/admin/notifications/status'));
    expect(mockEmployeesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});

// ─── POST /api/admin/notifications/test ───────────────────────────────────────

describe('POST /api/admin/notifications/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk('ADMIN');
    mockEmployeesFindFirst.mockResolvedValue({ id: EMPLOYEE_ID, name: 'Juan Pérez' });
    mockNotificationsCreate.mockResolvedValue({ id: 'new-notif-1' });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', { employee_id: EMPLOYEE_ID }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin roles (e.g. CASHIER)', async () => {
    mockAuthOk('CASHIER');
    const res = await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', { employee_id: EMPLOYEE_ID }));
    expect(res.status).toBe(403);
  });

  it('returns 400 when employee_id missing', async () => {
    const res = await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', {}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when employee not found', async () => {
    mockEmployeesFindFirst.mockResolvedValue(null);
    const res = await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', { employee_id: EMPLOYEE_ID }));
    expect(res.status).toBe(404);
  });

  it('returns 200 with notification_id on success', async () => {
    const res = await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', { employee_id: EMPLOYEE_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notification_id).toBeDefined();
  });

  it('verifies employee belongs to tenant (not just any employee)', async () => {
    await POSTTest(makeRequest('/api/admin/notifications/test', 'POST', { employee_id: EMPLOYEE_ID }));
    expect(mockEmployeesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});
