/**
 * SUNAT Configuration API Tests
 *
 * Tests for GET/PUT /api/admin/facturacion/configuracion
 * and POST /api/admin/facturacion/test-connection
 *
 * @module app/api/admin/facturacion/__tests__/configuracion.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mock dependencies BEFORE imports
// ============================================================================

const TEST_KEY =
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2';
const TEST_TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TEST_USER_ID = 'test-user-id';

// Mock Prisma
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenant_settings: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

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

// Mock provider-router
const mockGetProvider = vi.fn();
const mockClearCache = vi.fn();
vi.mock('@/src/core/integrations/sunat/provider-router', () => {
  return {
    InvoiceProviderRouter: class MockInvoiceProviderRouter {
      getProvider = mockGetProvider;
      clearCache = mockClearCache;
    },
  };
});

// Mock provider-config (for test-connection which uses getTenantSunatConfig internally)
vi.mock('@/src/core/integrations/sunat/provider-config', () => ({
  getTenantSunatConfig: vi.fn().mockResolvedValue(null),
}));

// ============================================================================
// Helpers
// ============================================================================

function createRequest(
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const url = 'http://localhost:3000/api/admin/facturacion/configuracion';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Cookie: 'auth_token=test-jwt-token',
  };
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(url, init);
}

function createTestConnectionRequest(): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/admin/facturacion/test-connection',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'auth_token=test-jwt-token',
      } as Record<string, string>,
    },
  );
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

// ============================================================================
// Tests
// ============================================================================

describe('SUNAT Configuration API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUNAT_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.SUNAT_ENCRYPTION_KEY;
  });

  // ==========================================================================
  // GET /api/admin/facturacion/configuracion
  // ==========================================================================

  describe('GET /api/admin/facturacion/configuracion', () => {
    let GET: typeof import('../configuracion/route').GET;

    beforeEach(async () => {
      vi.resetModules();
      process.env.SUNAT_ENCRYPTION_KEY = TEST_KEY;
      const mod = await import('../configuracion/route');
      GET = mod.GET;
    });

    it('should return config without sensitive values', async () => {
      mockAuthSuccess();
      mockFindFirst.mockResolvedValue({
        sunat_provider: 'SUNAT_DIRECT',
        sunat_mode: 'BETA',
        sunat_sol_user: 'MODDATOS',
        sunat_sol_password: 'enc:encrypted-password',
        sunat_certificate_pem: 'enc:encrypted-cert',
        sunat_private_key_pem: 'enc:encrypted-key',
        sunat_cert_expires_at: new Date('2027-01-01'),
        nubefact_token: null,
        nubefact_url: null,
        ruc: '20123456789',
      });

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sunat_provider).toBe('SUNAT_DIRECT');
      expect(data.sunat_mode).toBe('BETA');
      expect(data.sunat_sol_user).toBe('MODDATOS');
      expect(data.has_sol_password).toBe(true);
      expect(data.has_certificate).toBe(true);
      expect(data.has_private_key).toBe(true);
      expect(data.ruc).toBe('20123456789');

      // NEVER return actual encrypted values
      expect(data.sunat_sol_password).toBeUndefined();
      expect(data.sunat_certificate_pem).toBeUndefined();
      expect(data.sunat_private_key_pem).toBeUndefined();
      expect(data.nubefact_token).toBeUndefined();
    });

    it('should return defaults when no settings found', async () => {
      mockAuthSuccess();
      mockFindFirst.mockResolvedValue(null);

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sunat_provider).toBe('NONE');
      expect(data.sunat_mode).toBe('DISABLED');
      expect(data.has_sol_password).toBe(false);
      expect(data.has_certificate).toBe(false);
    });

    it('should calculate cert_expires_in_days', async () => {
      mockAuthSuccess();
      // Set cert to expire in ~30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      mockFindFirst.mockResolvedValue({
        sunat_provider: 'SUNAT_DIRECT',
        sunat_mode: 'BETA',
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: expiresAt,
        nubefact_token: null,
        nubefact_url: null,
        ruc: null,
      });

      const request = createRequest('GET');
      const response = await GET(request);
      const data = await response.json();

      expect(data.cert_expires_in_days).toBeGreaterThanOrEqual(29);
      expect(data.cert_expires_in_days).toBeLessThanOrEqual(31);
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

  // ==========================================================================
  // PUT /api/admin/facturacion/configuracion
  // ==========================================================================

  describe('PUT /api/admin/facturacion/configuracion', () => {
    let PUT: typeof import('../configuracion/route').PUT;

    beforeEach(async () => {
      vi.resetModules();
      process.env.SUNAT_ENCRYPTION_KEY = TEST_KEY;
      const mod = await import('../configuracion/route');
      PUT = mod.PUT;
    });

    it('should update partial config', async () => {
      mockAuthSuccess();
      mockUpdate.mockResolvedValue({});
      // Return updated settings after update
      mockFindFirst.mockResolvedValue({
        sunat_provider: 'NUBEFACT',
        sunat_mode: 'BETA',
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: 'enc:encrypted-token',
        nubefact_url: 'https://api.nubefact.com/api/v1',
        ruc: '20123456789',
      });

      const request = createRequest('PUT', {
        sunat_provider: 'NUBEFACT',
        sunat_mode: 'BETA',
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sunat_provider).toBe('NUBEFACT');
      expect(data.sunat_mode).toBe('BETA');
    });

    it('should require SOL credentials for SUNAT_DIRECT + PRODUCTION', async () => {
      mockAuthSuccess();
      mockFindFirst.mockResolvedValue({
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
      });

      const request = createRequest('PUT', {
        sunat_provider: 'SUNAT_DIRECT',
        sunat_mode: 'PRODUCTION',
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('SUNAT_MISSING_CREDENTIALS');
      expect(data.missing).toContain('usuario SOL');
      expect(data.missing).toContain('contraseña SOL');
      expect(data.missing).toContain('certificado digital');
      expect(data.missing).toContain('clave privada');
    });

    it('should reject invalid PEM certificate', async () => {
      mockAuthSuccess();

      const request = createRequest('PUT', {
        sunat_certificate_pem: 'not-a-valid-pem',
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('SUNAT_CERT_INVALID_FORMAT');
    });

    it('should reject invalid PEM private key', async () => {
      mockAuthSuccess();

      const request = createRequest('PUT', {
        sunat_private_key_pem: 'not-a-valid-key',
      });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('SUNAT_KEY_INVALID_FORMAT');
    });

    it('should encrypt credentials before storage', async () => {
      mockAuthSuccess();
      mockUpdate.mockResolvedValue({});
      mockFindFirst.mockResolvedValue({
        sunat_provider: 'SUNAT_DIRECT',
        sunat_mode: 'BETA',
        sunat_sol_user: 'MODDATOS',
        sunat_sol_password: 'enc:new-encrypted',
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: null,
        nubefact_url: null,
        ruc: '20123456789',
      });

      const request = createRequest('PUT', {
        sunat_sol_password: 'my-secret-password',
      });
      const response = await PUT(request);

      expect(response.status).toBe(200);

      // Verify the update call received encrypted value
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const updateCall = mockUpdate.mock.calls[0][0];
      const savedPassword = updateCall.data.sunat_sol_password;

      // Must be encrypted (starts with enc:)
      expect(savedPassword).toMatch(/^enc:/);
      // Must NOT be the plaintext
      expect(savedPassword).not.toBe('my-secret-password');
    });

    it('should emit audit event on update', async () => {
      const { logAudit } = await import(
        '@/src/core/observability/logger-pino'
      );
      mockAuthSuccess();
      mockUpdate.mockResolvedValue({});
      mockFindFirst.mockResolvedValue({
        sunat_provider: 'NONE',
        sunat_mode: 'DISABLED',
        sunat_sol_user: null,
        sunat_sol_password: null,
        sunat_certificate_pem: null,
        sunat_private_key_pem: null,
        sunat_cert_expires_at: null,
        nubefact_token: null,
        nubefact_url: null,
        ruc: null,
      });

      const request = createRequest('PUT', {
        sunat_provider: 'NUBEFACT',
      });
      await PUT(request);

      expect(logAudit).toHaveBeenCalledWith(
        'UPDATE',
        'sunat_config',
        TEST_USER_ID,
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          changedFields: ['sunat_provider'],
        }),
      );
    });

    it('should reject unknown fields (strict schema)', async () => {
      mockAuthSuccess();

      const request = createRequest('PUT', {
        sunat_provider: 'NUBEFACT',
        unknown_field: 'value',
      });
      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('should return 400 when no fields provided', async () => {
      mockAuthSuccess();

      const request = createRequest('PUT', {});
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No se proporcionaron campos');
    });
  });

  // ==========================================================================
  // POST /api/admin/facturacion/test-connection
  // ==========================================================================

  describe('POST /api/admin/facturacion/test-connection', () => {
    // Import once (no resetModules here since the mock is hoisted)
    let POST: typeof import('../test-connection/route').POST;

    beforeEach(async () => {
      // Do NOT resetModules — it breaks the hoisted vi.mock for InvoiceProviderRouter
      process.env.SUNAT_ENCRYPTION_KEY = TEST_KEY;
      if (!POST) {
        const mod = await import('../test-connection/route');
        POST = mod.POST;
      }
    });

    it('should return success on successful test connection', async () => {
      mockAuthSuccess();
      mockGetProvider.mockResolvedValue({
        success: true,
        data: {
          testConnection: vi.fn().mockResolvedValue({
            success: true,
            data: { message: 'Conexión exitosa con SUNAT Beta' },
          }),
        },
      });

      const request = createTestConnectionRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('exitosa');
      expect(typeof data.duration_ms).toBe('number');
    });

    it('should return failure when provider resolution fails', async () => {
      mockAuthSuccess();
      mockGetProvider.mockResolvedValue({
        success: false,
        error: {
          message: 'Configuración SUNAT no encontrada',
          code: 'SUNAT_CONFIG_NOT_FOUND',
        },
      });

      const request = createTestConnectionRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.response_code).toBe('SUNAT_CONFIG_NOT_FOUND');
    });

    it('should return failure when test connection fails', async () => {
      mockAuthSuccess();
      mockGetProvider.mockResolvedValue({
        success: true,
        data: {
          testConnection: vi.fn().mockResolvedValue({
            success: false,
            error: {
              message: 'Credenciales SOL inválidas',
              code: 'SUNAT_AUTH_FAILED',
            },
          }),
        },
      });

      const request = createTestConnectionRequest();
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.response_code).toBe('SUNAT_AUTH_FAILED');
    });

    it('should handle timeout', async () => {
      vi.useFakeTimers();
      mockAuthSuccess();
      mockGetProvider.mockResolvedValue({
        success: true,
        data: {
          testConnection: vi.fn().mockImplementation(
            () =>
              new Promise((resolve) => {
                // Never resolves within timeout
                setTimeout(
                  () =>
                    resolve({
                      success: true,
                      data: { message: 'too late' },
                    }),
                  30_000,
                );
              }),
          ),
        },
      });

      const request = createTestConnectionRequest();
      const responsePromise = POST(request);

      // Advance timers to trigger the 15s timeout
      await vi.advanceTimersByTimeAsync(16_000);

      const response = await responsePromise;
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.response_code).toBe('SUNAT_CONNECTION_TIMEOUT');

      vi.useRealTimers();
    });

    it('should return 401 without JWT', async () => {
      mockAuthUnauthorized();

      const request = createTestConnectionRequest();
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });
});
