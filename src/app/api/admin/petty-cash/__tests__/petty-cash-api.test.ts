/**
 * Petty Cash API Tests
 *
 * @module app/api/admin/petty-cash/__tests__/petty-cash-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

const mockGetBalance = vi.fn();
const mockGetTransactions = vi.fn();
const mockRecordTransaction = vi.fn();
const mockApproveTransaction = vi.fn();
const mockReconcile = vi.fn();

vi.mock('@/src/core/services/petty-cash.service', () => ({
  PettyCashService: class {
    getBalance = mockGetBalance;
    getTransactions = mockGetTransactions;
    recordTransaction = mockRecordTransaction;
    approveTransaction = mockApproveTransaction;
    reconcile = mockReconcile;
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { GET, POST } from '../route';

const mockAuth = requireAdminAuth as ReturnType<typeof vi.fn>;

function makeRequest(path: string, params: Record<string, string> = {}, options?: { method?: string; body?: string; headers?: Record<string, string> }) {
  const url = new URL(`http://localhost:3000${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), options as any);
}

const mockBalance = {
  success: true,
  data: {
    id: 'bal-1',
    tenantId: 'tenant-1',
    locationId: 'loc-1',
    currentBalance: 30000,
    maxBalance: 50000,
    minBalance: 10000,
    approvalThreshold: 5000,
    lastReconciledAt: '2026-02-01',
    lastReconciledBy: null,
  },
};

const mockTxList = {
  success: true,
  data: [
    { id: 'tx-1', type: 'EXPENSE', amount: 1500, category: 'FOOD', description: 'Pan' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-1', tenantId: 'tenant-1' },
  });
});

// ============================================================================
// GET /api/admin/petty-cash
// ============================================================================

describe('GET /api/admin/petty-cash', () => {
  it('debe retornar balance y transacciones', async () => {
    mockGetBalance.mockResolvedValue(mockBalance);
    mockGetTransactions.mockResolvedValue(mockTxList);

    const req = makeRequest('/api/admin/petty-cash', { locationId: 'loc-1' });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.balance.currentBalance).toBe(30000);
    expect(data.transactions).toHaveLength(1);
  });

  it('debe rechazar sin locationId', async () => {
    const req = makeRequest('/api/admin/petty-cash');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/petty-cash', { locationId: 'loc-1' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar 404 si balance no existe', async () => {
    mockGetBalance.mockResolvedValue({
      success: false,
      error: { message: 'No encontrado' },
    });

    const req = makeRequest('/api/admin/petty-cash', { locationId: 'loc-999' });
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// POST /api/admin/petty-cash
// ============================================================================

describe('POST /api/admin/petty-cash', () => {
  const validBody = {
    locationId: '550e8400-e29b-41d4-a716-446655440000',
    shiftId: '550e8400-e29b-41d4-a716-446655440001',
    type: 'EXPENSE',
    amount: 3000,
    category: 'SUPPLIES',
    description: 'Servilletas',
  };

  it('debe crear transacción correctamente', async () => {
    mockRecordTransaction.mockResolvedValue({
      success: true,
      data: { id: 'tx-new', ...validBody },
    });

    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('debe rechazar body inválido', async () => {
    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify({ amount: -100 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar error del servicio', async () => {
    mockRecordTransaction.mockResolvedValue({
      success: false,
      error: { message: 'Excede saldo mínimo' },
    });

    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('saldo mínimo');
  });

  it('debe rechazar categoría inválida', async () => {
    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify({ ...validBody, category: 'INVALID' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar tipo inválido', async () => {
    const req = makeRequest('/api/admin/petty-cash', {}, {
      method: 'POST',
      body: JSON.stringify({ ...validBody, type: 'TRANSFER' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
