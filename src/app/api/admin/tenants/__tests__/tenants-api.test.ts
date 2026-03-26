/**
 * Tests for tenant management API:
 * - GET  /api/admin/tenants                           (list — cross-tenant admin)
 * - POST /api/admin/tenants/provision                 (provision new tenant)
 * - GET  /api/admin/tenants/current/metrics           (current tenant metrics)
 * - GET  /api/admin/tenants/current/health            (current tenant health checks)
 * - GET  /api/admin/tenants/current/activity          (current tenant audit log)
 * - GET  /api/admin/tenants/[id]/configuration        (cross-tenant: get config — 404 if missing)
 * - GET  /api/admin/tenants/[id]/events               (cross-tenant: get events)
 * - GET  /api/admin/tenants/[id]/orders               (cross-tenant: get orders)
 * - POST /api/admin/tenants/[id]/deactivate           (Bearer token + cross-tenant admin — 403 if auth error)
 * - POST /api/admin/tenants/[id]/reactivate           (Bearer token + cross-tenant admin)
 * - GET  /api/admin/tenants/[id]/delete               (Bearer token — generate confirmation token)
 * - POST /api/admin/tenants/[id]/delete               (Bearer token — requires confirmation_token)
 *
 * Key behavior:
 * - Three auth patterns:
 *   1. getSessionFromRequest (most routes)
 *   2. validateToken via Authorization Bearer (deactivate/reactivate/delete)
 *   3. Both + withCrossTenantAdmin guard
 * - Cross-tenant admin throws error with 'authorization' → 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockGetSessionFromRequest,
  mockValidateToken,
  mockWithCrossTenantAdmin,
  mockLogCrossTenantAdminAction,
  mockProvisionTenant,
  mockDeactivateTenant,
  mockReactivateTenant,
  mockDeleteTenant,
  mockGenerateDeletionToken,
  // prisma mocks
  mockTenantsFindMany,
  mockTenantSettingsFindUnique,
  mockTenantAnalyticsFindUnique,
  mockTerminalsCount,
  mockOrdersCount,
  mockOrdersFindMany,
  mockSyncConflictsCount,
  mockTenantUsageFindUnique,
  mockTenantQuotasFindUnique,
  mockCrossTenantAuditFindMany,
  mockEventsFindMany,
  mockEventsCount,
} = vi.hoisted(() => ({
  mockGetSessionFromRequest: vi.fn(),
  mockValidateToken: vi.fn(),
  mockWithCrossTenantAdmin: vi.fn(),
  mockLogCrossTenantAdminAction: vi.fn(),
  mockProvisionTenant: vi.fn(),
  mockDeactivateTenant: vi.fn(),
  mockReactivateTenant: vi.fn(),
  mockDeleteTenant: vi.fn(),
  mockGenerateDeletionToken: vi.fn(),
  mockTenantsFindMany: vi.fn(),
  mockTenantSettingsFindUnique: vi.fn(),
  mockTenantAnalyticsFindUnique: vi.fn(),
  mockTerminalsCount: vi.fn(),
  mockOrdersCount: vi.fn(),
  mockOrdersFindMany: vi.fn(),
  mockSyncConflictsCount: vi.fn(),
  mockTenantUsageFindUnique: vi.fn(),
  mockTenantQuotasFindUnique: vi.fn(),
  mockCrossTenantAuditFindMany: vi.fn(),
  mockEventsFindMany: vi.fn(),
  mockEventsCount: vi.fn(),
}));

vi.mock('@/src/core/auth/auth.service', () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
  validateToken: mockValidateToken,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenants: { findMany: mockTenantsFindMany },
    tenant_settings: { findUnique: mockTenantSettingsFindUnique },
    tenant_analytics: { findUnique: mockTenantAnalyticsFindUnique },
    terminals: { count: mockTerminalsCount },
    orders: { findMany: mockOrdersFindMany, count: mockOrdersCount },
    sync_conflicts: { count: mockSyncConflictsCount },
    tenant_usage: { findUnique: mockTenantUsageFindUnique },
    tenant_quotas: { findUnique: mockTenantQuotasFindUnique },
    cross_tenant_audit_log: { findMany: mockCrossTenantAuditFindMany },
    events: { findMany: mockEventsFindMany, count: mockEventsCount },
  },
}));

vi.mock('@/src/core/tenant/cross-tenant-admin', () => ({
  withCrossTenantAdmin: mockWithCrossTenantAdmin,
  logCrossTenantAdminAction: mockLogCrossTenantAdminAction,
}));

vi.mock('@/src/core/tenant/provisioning', () => ({
  provisionTenant: mockProvisionTenant,
}));

vi.mock('@/src/core/tenant/deactivation', () => ({
  deactivateTenant: mockDeactivateTenant,
  reactivateTenant: mockReactivateTenant,
  deleteTenant: mockDeleteTenant,
  generateDeletionConfirmationToken: mockGenerateDeletionToken,
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET as GETList } from '../route';
import { POST as POSTProvision } from '../provision/route';
import { GET as GETMetrics } from '../current/metrics/route';
import { GET as GETHealth } from '../current/health/route';
import { GET as GETActivity } from '../current/activity/route';
import { GET as GETConfig } from '../[id]/configuration/route';
import { GET as GETEvents } from '../[id]/events/route';
import { GET as GETOrders } from '../[id]/orders/route';
import { POST as POSTDeactivate } from '../[id]/deactivate/route';
import { POST as POSTReactivate } from '../[id]/reactivate/route';
import { GET as GETDeleteToken, POST as POSTDelete } from '../[id]/delete/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TARGET_TENANT_ID = 'b0000000-0000-0000-0000-000000000001';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

function makeRequest(url: string, method = 'GET', body?: object, bearerToken?: string): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (bearerToken) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  } else {
    headers['cookie'] = 'auth_token=test-token';
  }
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams<T extends object>(obj: T) {
  return { params: Promise.resolve(obj) };
}

function mockSessionOk() {
  mockGetSessionFromRequest.mockResolvedValue({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID });
}

function mockSessionNone() {
  mockGetSessionFromRequest.mockResolvedValue(null);
}

function mockTokenOk() {
  mockValidateToken.mockResolvedValue({ valid: true, payload: { sub: EMPLOYEE_ID } });
}

function mockTokenInvalid() {
  mockValidateToken.mockResolvedValue({ valid: false });
}

function mockCrossTenantOk() {
  mockWithCrossTenantAdmin.mockResolvedValue({ employeeId: EMPLOYEE_ID, tenantId: TENANT_ID });
  mockLogCrossTenantAdminAction.mockResolvedValue(undefined);
}

function mockCrossTenantForbidden() {
  mockWithCrossTenantAdmin.mockRejectedValue(new Error('Insufficient authorization to perform this action'));
}

// ─── GET /api/admin/tenants ───────────────────────────────────────────────────

describe('GET /api/admin/tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantOk();
    mockTenantsFindMany.mockResolvedValue([{ id: TARGET_TENANT_ID, name: 'Test Tenant' }]);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETList(makeRequest('/api/admin/tenants'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with tenant list', async () => {
    const res = await GETList(makeRequest('/api/admin/tenants'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

// ─── POST /api/admin/tenants/provision ───────────────────────────────────────

describe('POST /api/admin/tenants/provision', () => {
  const validBody = {
    legal_name: 'Pollería El Gordo',
    admin_name: 'Jorge Torres',
    admin_pin: '1234',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantOk();
    mockProvisionTenant.mockResolvedValue({
      tenant_id: TARGET_TENANT_ID,
      admin_employee_id: EMPLOYEE_ID,
      activation_code: 'ABC123',
      credentials: {},
      onboarding_checklist: [],
    });
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await POSTProvision(makeRequest('/api/admin/tenants/provision', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 200 with tenant_id on success', async () => {
    const res = await POSTProvision(makeRequest('/api/admin/tenants/provision', 'POST', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tenant_id).toBe(TARGET_TENANT_ID);
  });

  it('returns 400 on invalid PIN (not 4 digits)', async () => {
    const res = await POSTProvision(
      makeRequest('/api/admin/tenants/provision', 'POST', { ...validBody, admin_pin: '12' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POSTProvision(
      makeRequest('/api/admin/tenants/provision', 'POST', { admin_pin: '1234' }),
    );
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/tenants/current/metrics ──────────────────────────────────

describe('GET /api/admin/tenants/current/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockTenantAnalyticsFindUnique.mockResolvedValue({ tenant_id: TENANT_ID, total_orders: 100 });
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETMetrics(makeRequest('/api/admin/tenants/current/metrics'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with metrics', async () => {
    const res = await GETMetrics(makeRequest('/api/admin/tenants/current/metrics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_orders).toBe(100);
  });

  it('returns default zeros when no metrics found', async () => {
    mockTenantAnalyticsFindUnique.mockResolvedValue(null);
    const res = await GETMetrics(makeRequest('/api/admin/tenants/current/metrics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_orders).toBe(0);
    expect(body.total_revenue_cents).toBe(0);
  });
});

// ─── GET /api/admin/tenants/current/health ───────────────────────────────────

describe('GET /api/admin/tenants/current/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockTerminalsCount.mockResolvedValue(2);
    mockOrdersCount.mockResolvedValue(10);
    mockSyncConflictsCount.mockResolvedValue(0);
    mockTenantUsageFindUnique.mockResolvedValue({ storage_mb: 100 });
    mockTenantQuotasFindUnique.mockResolvedValue({ max_storage_mb: 1000 });
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETHealth(makeRequest('/api/admin/tenants/current/health'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with health checks', async () => {
    const res = await GETHealth(makeRequest('/api/admin/tenants/current/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overall_status).toBeDefined();
    expect(body.checks).toHaveLength(4);
  });

  it('returns healthy status when all checks pass', async () => {
    const res = await GETHealth(makeRequest('/api/admin/tenants/current/health'));
    const body = await res.json();
    expect(body.overall_status).toBe('healthy');
  });

  it('returns warning when no active terminals', async () => {
    mockTerminalsCount.mockResolvedValue(0);
    const res = await GETHealth(makeRequest('/api/admin/tenants/current/health'));
    const body = await res.json();
    expect(body.overall_status).toBe('warning');
  });

  it('returns critical when sync errors ≥ 5', async () => {
    mockSyncConflictsCount.mockResolvedValue(5);
    const res = await GETHealth(makeRequest('/api/admin/tenants/current/health'));
    const body = await res.json();
    expect(body.overall_status).toBe('critical');
  });
});

// ─── GET /api/admin/tenants/current/activity ─────────────────────────────────

describe('GET /api/admin/tenants/current/activity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantAuditFindMany.mockResolvedValue([
      { id: '1', action: 'LIST_TENANTS', resource_type: 'tenants', created_at: new Date() },
    ]);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETActivity(makeRequest('/api/admin/tenants/current/activity'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with activity list', async () => {
    const res = await GETActivity(makeRequest('/api/admin/tenants/current/activity'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });
});

// ─── GET /api/admin/tenants/[id]/configuration ───────────────────────────────

describe('GET /api/admin/tenants/[id]/configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantOk();
    mockTenantSettingsFindUnique.mockResolvedValue({ tenant_id: TARGET_TENANT_ID, timezone: 'America/Lima' });
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETConfig(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/configuration`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with configuration', async () => {
    const res = await GETConfig(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/configuration`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 404 when configuration not found', async () => {
    mockTenantSettingsFindUnique.mockResolvedValue(null);
    const res = await GETConfig(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/configuration`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/admin/tenants/[id]/events ──────────────────────────────────────

describe('GET /api/admin/tenants/[id]/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantOk();
    mockEventsFindMany.mockResolvedValue([{ id: 'e1', event_type: 'ORDER_CREATED' }]);
    mockEventsCount.mockResolvedValue(1);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETEvents(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/events`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with { events, total }', async () => {
    const res = await GETEvents(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/events`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.total).toBe(1);
  });
});

// ─── GET /api/admin/tenants/[id]/orders ──────────────────────────────────────

describe('GET /api/admin/tenants/[id]/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionOk();
    mockCrossTenantOk();
    mockOrdersFindMany.mockResolvedValue([{ id: 'o1', order_status: 'OPEN' }]);
    mockOrdersCount.mockResolvedValue(1);
  });

  it('returns 401 without session', async () => {
    mockSessionNone();
    const res = await GETOrders(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/orders`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with { orders, total }', async () => {
    const res = await GETOrders(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/orders`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
  });
});

// ─── POST /api/admin/tenants/[id]/deactivate ─────────────────────────────────

describe('POST /api/admin/tenants/[id]/deactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenOk();
    mockCrossTenantOk();
    mockDeactivateTenant.mockResolvedValue(undefined);
  });

  it('returns 401 without Bearer token', async () => {
    const res = await POSTDeactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/deactivate`, 'POST'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    mockTokenInvalid();
    const res = await POSTDeactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/deactivate`, 'POST', {}, 'bad-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTDeactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/deactivate`, 'POST', {}, 'valid-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when cross-tenant auth fails', async () => {
    mockCrossTenantForbidden();
    const res = await POSTDeactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/deactivate`, 'POST', {}, 'valid-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/admin/tenants/[id]/reactivate ─────────────────────────────────

describe('POST /api/admin/tenants/[id]/reactivate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenOk();
    mockCrossTenantOk();
    mockReactivateTenant.mockResolvedValue(undefined);
  });

  it('returns 401 without Bearer token', async () => {
    const res = await POSTReactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/reactivate`, 'POST'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTReactivate(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/reactivate`, 'POST', {}, 'valid-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── GET /api/admin/tenants/[id]/delete (generate token) ─────────────────────

describe('GET /api/admin/tenants/[id]/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenOk();
    mockCrossTenantOk();
    mockGenerateDeletionToken.mockResolvedValue('delete-confirm-token-xyz');
  });

  it('returns 401 without Bearer token', async () => {
    const res = await GETDeleteToken(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/delete`),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with confirmation_token', async () => {
    const res = await GETDeleteToken(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/delete`, 'GET', undefined, 'valid-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.confirmation_token).toBe('delete-confirm-token-xyz');
  });
});

// ─── POST /api/admin/tenants/[id]/delete ─────────────────────────────────────

describe('POST /api/admin/tenants/[id]/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenOk();
    mockCrossTenantOk();
    mockDeleteTenant.mockResolvedValue(undefined);
  });

  it('returns 401 without Bearer token', async () => {
    const res = await POSTDelete(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/delete`, 'POST'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing confirmation_token', async () => {
    const res = await POSTDelete(
      makeRequest(`/api/admin/tenants/${TARGET_TENANT_ID}/delete`, 'POST', {}, 'valid-token'),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful deletion', async () => {
    const res = await POSTDelete(
      makeRequest(
        `/api/admin/tenants/${TARGET_TENANT_ID}/delete`,
        'POST',
        { confirmation_token: 'valid-confirm-token' },
        'valid-token',
      ),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 when deleteTenant throws confirmation error', async () => {
    mockDeleteTenant.mockRejectedValue(new Error('Invalid confirmation token'));
    const res = await POSTDelete(
      makeRequest(
        `/api/admin/tenants/${TARGET_TENANT_ID}/delete`,
        'POST',
        { confirmation_token: 'wrong-token' },
        'valid-token',
      ),
      makeParams({ id: TARGET_TENANT_ID }),
    );
    expect(res.status).toBe(400);
  });
});
