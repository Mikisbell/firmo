/**
 * SUNAT Contingency API Tests
 *
 * Tests for GET/POST/DELETE /api/admin/facturacion/contingencia
 *
 * @module app/api/admin/facturacion/__tests__/contingencia.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Constants
// ============================================================================

const TEST_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_USER_ID = 'test-user-id';
const CONTINGENCY_ID = 'contingency-test-001';

// ============================================================================
// Mock dependencies BEFORE imports
// ============================================================================

// Mock admin-permission
const mockRequireAdminPermission = vi.fn();
vi.mock('@/src/core/middleware/admin-permission', () => ({
  requireAdminPermission: (...args: unknown[]) =>
    mockRequireAdminPermission(...args),
}));

// Mock logger
vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
  logAudit: vi.fn(),
}));

// Mock ContingencyManager
const mockGetState = vi.fn();
const mockIsActive = vi.fn();
const mockActivate = vi.fn();
const mockDeactivate = vi.fn();
const mockGetPendingInvoices = vi.fn();
const mockGetOverdueInvoices = vi.fn();
const mockGetUrgentReconciliations = vi.fn();

vi.mock('@/src/core/integrations/sunat/contingency', () => ({
  ContingencyManager: class MockContingencyManager {
    getState = mockGetState;
    isActive = mockIsActive;
    activate = mockActivate;
    deactivate = mockDeactivate;
    getPendingInvoices = mockGetPendingInvoices;
    getOverdueInvoices = mockGetOverdueInvoices;
    getUrgentReconciliations = mockGetUrgentReconciliations;
  },
}));

// Mock Prisma (ContingencyManager receives it in constructor)
vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

// ============================================================================
// Helpers
// ============================================================================

function createRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const url = 'http://localhost:3000/api/admin/facturacion/contingencia';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: 'auth_token=test-jwt-token',
  };
  const init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = { method, headers };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init);
}

function mockAuthSuccess() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: true,
    user: {
      id: TEST_USER_ID,
      role: 'OWNER',
      name: 'Test Owner',
      tenantId: TEST_TENANT_ID,
      sessionId: 'test-session',
    },
  });
}

function mockAuthUnauthorized() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'No autenticado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ),
  });
}

function mockAuthForbidden() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'Permiso insuficiente' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ),
  });
}

function createMockState(overrides = {}) {
  return {
    id: CONTINGENCY_ID,
    tenantId: TEST_TENANT_ID,
    active: true,
    reason: 'MANUAL_ACTIVATION',
    activatedAt: new Date('2026-03-01T10:00:00Z'),
    activatedBy: TEST_USER_ID,
    deactivatedAt: null,
    pendingCount: 2,
    autoActivated: false,
    failureCount: 0,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    ...overrides,
  };
}

function createMockInvoice(id: string, overrides = {}) {
  return {
    id: `ci-${id}`,
    contingencyId: CONTINGENCY_ID,
    invoiceId: id,
    tenantId: TEST_TENANT_ID,
    series: 'B001',
    number: '00000001',
    issuedAt: new Date('2026-03-01T10:00:00Z'),
    reconcileBy: new Date('2026-03-08T10:00:00Z'),
    reconciledAt: null,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SUNAT Contingency API', () => {
  let GET: typeof import('../contingencia/route').GET;
  let POST: typeof import('../contingencia/route').POST;
  let DELETE: typeof import('../contingencia/route').DELETE;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../contingencia/route');
    GET = mod.GET;
    POST = mod.POST;
    DELETE = mod.DELETE;
  });

  // ========================================================================
  // GET /api/admin/facturacion/contingencia
  // ========================================================================

  describe('GET /api/admin/facturacion/contingencia', () => {
    it('should return contingency state with pending invoices', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(createMockState());
      mockGetPendingInvoices.mockResolvedValue([
        createMockInvoice('inv-1'),
        createMockInvoice('inv-2'),
      ]);
      mockGetOverdueInvoices.mockResolvedValue([]);
      mockGetUrgentReconciliations.mockResolvedValue([]);

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(true);
      expect(data.state.reason).toBe('MANUAL_ACTIVATION');
      expect(data.state.activatedBy).toBe(TEST_USER_ID);
      expect(data.state.pendingCount).toBe(2);
      expect(data.pendingInvoices).toHaveLength(2);
      expect(data.pendingInvoices[0].invoiceId).toBe('inv-1');
    });

    it('should return inactive state when no contingency exists', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(null);

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.active).toBe(false);
      expect(data.state).toBeNull();
      expect(data.pendingInvoices).toEqual([]);
    });

    it('should include overdue and urgent invoices', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(createMockState());
      mockGetPendingInvoices.mockResolvedValue([]);
      mockGetOverdueInvoices.mockResolvedValue([
        createMockInvoice('overdue-1'),
      ]);
      mockGetUrgentReconciliations.mockResolvedValue([
        createMockInvoice('urgent-1'),
      ]);

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.overdueInvoices).toHaveLength(1);
      expect(data.overdueInvoices[0].invoiceId).toBe('overdue-1');
      expect(data.urgentInvoices).toHaveLength(1);
      expect(data.urgentInvoices[0].invoiceId).toBe('urgent-1');
    });

    it('should return 401 without JWT', async () => {
      mockAuthUnauthorized();

      const request = createRequest('GET');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 without manage_fiscal permission', async () => {
      mockAuthForbidden();

      const request = createRequest('GET');
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  // ========================================================================
  // POST /api/admin/facturacion/contingencia
  // ========================================================================

  describe('POST /api/admin/facturacion/contingencia', () => {
    it('should activate manual contingency', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(null);
      mockActivate.mockResolvedValue(createMockState());

      const request = createRequest('POST', {
        reason: 'MANUAL_ACTIVATION',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Modo contingencia activado');
      expect(data.state.reason).toBe('MANUAL_ACTIVATION');
      expect(data.state.activatedBy).toBe(TEST_USER_ID);
    });

    it('should return 409 if already active', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(createMockState());

      const request = createRequest('POST', {
        reason: 'MANUAL_ACTIVATION',
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('CONTINGENCY_ALREADY_ACTIVE');
    });

    it('should reject invalid reason', async () => {
      mockAuthSuccess();

      const request = createRequest('POST', {
        reason: 'INVALID_REASON',
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should reject empty body', async () => {
      mockAuthSuccess();

      const request = createRequest('POST', {});
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should emit audit event on activation', async () => {
      const { logAudit } = await import(
        '@/src/core/observability/logger-pino'
      );
      mockAuthSuccess();
      mockGetState.mockResolvedValue(null);
      mockActivate.mockResolvedValue(createMockState());

      const request = createRequest('POST', {
        reason: 'SUNAT_UNREACHABLE',
      });
      await POST(request);

      expect(logAudit).toHaveBeenCalledWith(
        'CREATE',
        'contingency',
        TEST_USER_ID,
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          reason: 'SUNAT_UNREACHABLE',
          contingencyId: CONTINGENCY_ID,
        }),
      );
    });

    it('should return 401 without JWT', async () => {
      mockAuthUnauthorized();

      const request = createRequest('POST', {
        reason: 'MANUAL_ACTIVATION',
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 without permission', async () => {
      mockAuthForbidden();

      const request = createRequest('POST', {
        reason: 'MANUAL_ACTIVATION',
      });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  // ========================================================================
  // DELETE /api/admin/facturacion/contingencia
  // ========================================================================

  describe('DELETE /api/admin/facturacion/contingencia', () => {
    it('should deactivate contingency', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(createMockState());
      mockGetOverdueInvoices.mockResolvedValue([]);
      mockDeactivate.mockResolvedValue(true);

      const request = createRequest('DELETE');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Modo contingencia desactivado');
    });

    it('should return 404 if no active contingency', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(null);

      const request = createRequest('DELETE');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('CONTINGENCY_NOT_ACTIVE');
    });

    it('should fail with 409 if overdue invoices exist', async () => {
      mockAuthSuccess();
      mockGetState.mockResolvedValue(createMockState());
      mockGetOverdueInvoices.mockResolvedValue([
        createMockInvoice('overdue-1'),
      ]);

      const request = createRequest('DELETE');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('CONTINGENCY_OVERDUE_INVOICES');
      expect(data.overdueCount).toBe(1);
      expect(data.overdueInvoices).toHaveLength(1);
      expect(data.overdueInvoices[0].invoiceId).toBe('overdue-1');
    });

    it('should emit audit event on deactivation', async () => {
      const { logAudit } = await import(
        '@/src/core/observability/logger-pino'
      );
      mockAuthSuccess();
      const state = createMockState();
      mockGetState.mockResolvedValue(state);
      mockGetOverdueInvoices.mockResolvedValue([]);
      mockDeactivate.mockResolvedValue(true);

      const request = createRequest('DELETE');
      await DELETE(request);

      expect(logAudit).toHaveBeenCalledWith(
        'DELETE',
        'contingency',
        TEST_USER_ID,
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          contingencyId: CONTINGENCY_ID,
          reason: 'MANUAL_ACTIVATION',
        }),
      );
    });

    it('should return 401 without JWT', async () => {
      mockAuthUnauthorized();

      const request = createRequest('DELETE');
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 without permission', async () => {
      mockAuthForbidden();

      const request = createRequest('DELETE');
      const response = await DELETE(request);

      expect(response.status).toBe(403);
    });
  });
});
