/**
 * Demo Request API Tests
 *
 * @module app/api/demo-request/__tests__/demo-request-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockCreate = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    events: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// ============================================================================
// Helpers
// ============================================================================

function makeRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

let POST: (req: any) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: 'evt-1' });
  const mod = await import('../route');
  POST = mod.POST;
});

describe('POST /api/demo-request', () => {
  it('debe aceptar solicitud válida', async () => {
    const res = await POST(makeRequest({
      name: 'Juan Pérez',
      email: 'juan@polleria.com',
      restaurant: 'Pollería El Sabrosón',
      phone: '987654321',
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);

    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.type).toBe('DEMO_REQUESTED');
    expect(createArg.data.payload.name).toBe('Juan Pérez');
    expect(createArg.data.payload.email).toBe('juan@polleria.com');
    expect(createArg.data.payload.restaurant).toBe('Pollería El Sabrosón');
    expect(createArg.data.payload.phone).toBe('987654321');
  });

  it('debe rechazar sin nombre', async () => {
    const res = await POST(makeRequest({
      email: 'test@test.com',
      restaurant: 'Test',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
    expect(data.details.name).toBeDefined();
  });

  it('debe rechazar sin email válido', async () => {
    const res = await POST(makeRequest({
      name: 'Test',
      email: 'invalid',
      restaurant: 'Test',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
    expect(data.details.email).toBeDefined();
  });

  it('debe rechazar sin restaurante', async () => {
    const res = await POST(makeRequest({
      name: 'Test',
      email: 'test@test.com',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Datos inválidos');
    expect(data.details.restaurant).toBeDefined();
  });

  it('debe aceptar sin teléfono (opcional)', async () => {
    const res = await POST(makeRequest({
      name: 'Test User',
      email: 'test@test.com',
      restaurant: 'Mi Pollería',
    }));

    expect(res.status).toBe(200);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.payload.phone).toBeNull();
  });

  it('debe normalizar email a minúsculas', async () => {
    const res = await POST(makeRequest({
      name: 'Test',
      email: 'JUAN@TEST.COM',
      restaurant: 'Test',
    }));

    expect(res.status).toBe(200);
    const createArg = mockCreate.mock.calls[0][0];
    expect(createArg.data.payload.email).toBe('juan@test.com');
    expect(createArg.data.entity_id).toBeNull();
  });
});
