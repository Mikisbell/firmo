/**
 * Push Notifications API Tests
 *
 * Tests for POST /api/push/send
 * Auth: requirePosAuth (JWT + any POS role)
 *
 * @module app/api/push/__tests__/push-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendNotification = vi.fn();
vi.mock('@/src/core/delivery/push.service', () => ({
  sendNotification: (...args: any[]) => mockSendNotification(...args),
}));

vi.mock('@/src/core/delivery/types-2026', () => ({
  toDriverId: (id: string) => id,
  toTenantId: (id: string) => id,
}));

const mockAuth = vi.fn();
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: (...args: any[]) => mockAuth(...args),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authed() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-1', role: 'CASHIER', terminalId: 'term-1' },
  });
}

function unauthorized() {
  mockAuth.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
  });
}

function makePostRequest(body: any) {
  return new NextRequest('http://localhost/api/push/send', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

function makeValidBody(overrides: Record<string, any> = {}) {
  return {
    driverId: 'driver-1',
    notification: {
      title: 'Nuevo pedido',
      body: 'Tienes un nuevo pedido para recoger',
      priority: 'urgent',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: POST /api/push/send
// ---------------------------------------------------------------------------

describe('POST /api/push/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe rechazar sin auth (401)', async () => {
    unauthorized();

    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest(makeValidBody()));

    expect(res.status).toBe(401);
  });

  it('debe enviar notificación push exitosamente', async () => {
    mockSendNotification.mockResolvedValue(undefined);

    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest(makeValidBody()));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('exitosamente');
    // Verify sendNotification called with tenantId from JWT
    expect(mockSendNotification).toHaveBeenCalledWith(
      'tenant-1',
      'driver-1',
      expect.objectContaining({
        title: 'Nuevo pedido',
        body: 'Tienes un nuevo pedido para recoger',
        priority: 'urgent',
      }),
    );
  });

  it('debe rechazar sin driverId (400)', async () => {
    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest({
      notification: { title: 'Test', body: 'Test', priority: 'normal' },
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
    expect(data.details.driverId).toBeDefined();
  });

  it('debe rechazar sin notification (400)', async () => {
    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest({
      driverId: 'driver-1',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
    expect(data.details.notification).toBeDefined();
  });

  it('debe rechazar notificación sin title (400)', async () => {
    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest({
      driverId: 'driver-1',
      notification: { body: 'Test', priority: 'normal' },
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
  });

  it('debe rechazar notificación sin body (400)', async () => {
    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest({
      driverId: 'driver-1',
      notification: { title: 'Test', priority: 'normal' },
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
  });

  it('debe rechazar prioridad inválida (400)', async () => {
    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest({
      driverId: 'driver-1',
      notification: { title: 'Test', body: 'Test body', priority: 'critical' },
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
  });

  it('debe aceptar prioridad "normal"', async () => {
    mockSendNotification.mockResolvedValue(undefined);

    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest(makeValidBody({
      notification: { title: 'Info', body: 'Información general', priority: 'normal' },
    })));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('debe retornar 500 cuando el servicio push falla', async () => {
    mockSendNotification.mockRejectedValue(new Error('Push gateway timeout'));

    const { POST } = await import('../send/route');
    const res = await POST(makePostRequest(makeValidBody()));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error');
  });
});
