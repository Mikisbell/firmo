/**
 * Tests de seguridad: /api/terminals/range
 *
 * Verifica el fix de inyección de tenant (bugs/terminals-range-tenant-jun-2026):
 * - El tenant_id del servidor (env via getTenantId) SIEMPRE gana sobre el body/query.
 * - Un terminal_id inexistente / de otro tenant es rechazado (403) antes de allocate/extend.
 * - Rate limiting devuelve 429 al exceder el tier.
 *
 * @module app/api/terminals/range/__tests__/range-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const ENV_TENANT = 'env00000-0000-4000-8000-000000000001';
const ATTACKER_TENANT = 'attacker-0000-4000-8000-000000000099';

const { mockTerminalsFindUnique, mockRangeFindUnique } = vi.hoisted(() => ({
  mockTerminalsFindUnique: vi.fn(),
  mockRangeFindUnique: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    terminals: { findUnique: (...a: any[]) => mockTerminalsFindUnique(...a) },
    terminal_number_ranges: { findUnique: (...a: any[]) => mockRangeFindUnique(...a) },
  },
}));

// getTenantId siempre devuelve el tenant del deploy (env). El cliente NO puede cambiarlo.
vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: () => ENV_TENANT,
}));

const { mockAllocateRange, mockExtendRange, mockGetNextOrderNumber, mockNeedsNewRange } = vi.hoisted(() => ({
  mockAllocateRange: vi.fn(),
  mockExtendRange: vi.fn(),
  mockGetNextOrderNumber: vi.fn(),
  mockNeedsNewRange: vi.fn(),
}));

vi.mock('@/src/core/order-numbers', () => ({
  allocateRange: (...a: any[]) => mockAllocateRange(...a),
  extendRange: (...a: any[]) => mockExtendRange(...a),
  getNextOrderNumber: (...a: any[]) => mockGetNextOrderNumber(...a),
  needsNewRange: (...a: any[]) => mockNeedsNewRange(...a),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { GET, POST } from '../route';
import { clearRateLimitCounters } from '@/src/core/middleware/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function postReq(body: unknown, ip = '10.0.0.1'): NextRequest {
  return new NextRequest('http://localhost:3000/api/terminals/range', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function getReq(query: string, ip = '10.0.0.2'): NextRequest {
  return new NextRequest(`http://localhost:3000/api/terminals/range?${query}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

function terminalExists() {
  mockTerminalsFindUnique.mockResolvedValue({ id: 'term-uuid-1' });
}
function terminalMissing() {
  mockTerminalsFindUnique.mockResolvedValue(null);
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRateLimitCounters();
  mockAllocateRange.mockResolvedValue({
    terminal_id: 'CAJA', range_start: 1, range_end: 10000, current_number: 1,
  });
  mockExtendRange.mockResolvedValue({
    terminal_id: 'CAJA', range_start: 1, range_end: 20000, current_number: 5,
  });
  mockGetNextOrderNumber.mockResolvedValue(42);
  mockNeedsNewRange.mockResolvedValue(false);
  mockRangeFindUnique.mockResolvedValue({
    terminal_id: 'CAJA', range_start: 1, range_end: 10000, current_number: 1,
  });
});

// ---------------------------------------------------------------------------
// Tenant injection
// ---------------------------------------------------------------------------

describe('POST /api/terminals/range — tenant del servidor manda', () => {
  it('ignora el tenant_id del body y usa el del env para allocate', async () => {
    terminalExists();

    const res = await POST(postReq({
      terminal_id: 'CAJA',
      tenant_id: ATTACKER_TENANT, // intento de inyección
      action: 'allocate',
    }));

    expect(res.status).toBe(200);
    // El terminal se validó contra el tenant del ENV, no el del atacante.
    expect(mockTerminalsFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id_terminal_id: { tenant_id: ENV_TENANT, terminal_id: 'CAJA' } },
      })
    );
    // allocateRange recibió el tenant del ENV, NUNCA el del atacante.
    expect(mockAllocateRange).toHaveBeenCalledWith(expect.anything(), ENV_TENANT, 'CAJA');
    expect(mockAllocateRange).not.toHaveBeenCalledWith(expect.anything(), ATTACKER_TENANT, expect.anything());
  });

  it('ignora el tenant_id del body para extend', async () => {
    terminalExists();
    const res = await POST(postReq({ terminal_id: 'CAJA', tenant_id: ATTACKER_TENANT, action: 'extend' }));
    expect(res.status).toBe(200);
    expect(mockExtendRange).toHaveBeenCalledWith(expect.anything(), ENV_TENANT, 'CAJA');
  });

  it('ignora el tenant_id del body para next', async () => {
    terminalExists();
    const res = await POST(postReq({ terminal_id: 'CAJA', tenant_id: ATTACKER_TENANT, action: 'next' }));
    expect(res.status).toBe(200);
    expect(mockGetNextOrderNumber).toHaveBeenCalledWith(expect.anything(), ENV_TENANT, 'CAJA');
  });
});

describe('POST /api/terminals/range — terminal inexistente / de otro tenant', () => {
  it('rechaza con 403 si el terminal no existe para el tenant del env', async () => {
    terminalMissing();

    const res = await POST(postReq({ terminal_id: 'GHOST', tenant_id: ATTACKER_TENANT, action: 'allocate' }));

    expect(res.status).toBe(403);
    // NUNCA se ejecuta la escritura.
    expect(mockAllocateRange).not.toHaveBeenCalled();
    expect(mockExtendRange).not.toHaveBeenCalled();
    expect(mockGetNextOrderNumber).not.toHaveBeenCalled();
  });

  it('requiere terminal_id (400 si falta)', async () => {
    const res = await POST(postReq({ tenant_id: ATTACKER_TENANT, action: 'allocate' }));
    expect(res.status).toBe(400);
    expect(mockTerminalsFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/terminals/range — lectura', () => {
  it('usa el tenant del env e ignora el del query', async () => {
    terminalExists();
    const res = await GET(getReq(`terminal_id=CAJA&tenant_id=${ATTACKER_TENANT}`));
    expect(res.status).toBe(200);
    expect(mockRangeFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id_terminal_id: { tenant_id: ENV_TENANT, terminal_id: 'CAJA' } },
      })
    );
  });

  it('rechaza 403 si el terminal no pertenece al tenant del env', async () => {
    terminalMissing();
    const res = await GET(getReq(`terminal_id=GHOST&tenant_id=${ATTACKER_TENANT}`));
    expect(res.status).toBe(403);
    expect(mockRangeFindUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('devuelve 429 al exceder el tier en POST', async () => {
    terminalExists();
    const ip = '203.0.113.7';
    // 30 permitidas; la 31 excede.
    for (let i = 0; i < 30; i++) {
      const ok = await POST(postReq({ terminal_id: 'CAJA', action: 'next' }, ip));
      expect(ok.status).toBe(200);
    }
    const blocked = await POST(postReq({ terminal_id: 'CAJA', action: 'next' }, ip));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });
});
