/**
 * POS Auth Middleware Tests
 *
 * @module core/middleware/__tests__/pos-auth.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock validateAdminAuth before importing
const mockValidateAdminAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  validateAdminAuth: (...args: any[]) => mockValidateAdminAuth(...args),
}));

import { requirePosAuth } from '../pos-auth';

function makeRequest() {
  return new NextRequest('http://localhost/api/pos/test', { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requirePosAuth', () => {
  it('debe aceptar CASHIER', async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      user: { id: 'user-1', tenantId: 'tenant-1', role: 'CASHIER', name: 'Test' },
    });

    const result = await requirePosAuth(makeRequest());

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user.role).toBe('CASHIER');
    }
  });

  it('debe aceptar ADMIN', async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', name: 'Admin' },
    });

    const result = await requirePosAuth(makeRequest());

    expect(result.authorized).toBe(true);
  });

  it('debe rechazar token inválido', async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: false,
      response: new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401 }),
    });

    const result = await requirePosAuth(makeRequest());

    expect(result.authorized).toBe(false);
  });

  it('debe aceptar WAITER', async () => {
    mockValidateAdminAuth.mockResolvedValue({
      valid: true,
      user: { id: 'user-2', tenantId: 'tenant-1', role: 'WAITER', name: 'Mozo' },
    });

    const result = await requirePosAuth(makeRequest());

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user.role).toBe('WAITER');
    }
  });
});
