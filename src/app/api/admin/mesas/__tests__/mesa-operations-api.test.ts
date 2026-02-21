/**
 * Mesa Operations API Tests
 *
 * @module app/api/admin/mesas/__tests__/mesa-operations-api.test
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

const mockOccupyTable = vi.fn();
const mockReleaseTable = vi.fn();
const mockMergeTables = vi.fn();
const mockSplitTables = vi.fn();
const mockGetTableStatus = vi.fn();
const mockUpdateGuestCount = vi.fn();

vi.mock('@/src/core/services/mesa.service', () => ({
  MesaService: class {
    occupyTable = mockOccupyTable;
    releaseTable = mockReleaseTable;
    mergeTables = mockMergeTables;
    splitTables = mockSplitTables;
    getTableStatus = mockGetTableStatus;
    updateGuestCount = mockUpdateGuestCount;
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
const mockAuth = requireAdminAuth as ReturnType<typeof vi.fn>;

function makeRequest(
  path: string,
  params: Record<string, string> = {},
  options?: { method?: string; body?: string; headers?: Record<string, string> },
) {
  const url = new URL(`http://localhost:3000${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), options as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-1', tenantId: 'tenant-1' },
  });
});

// ============================================================================
// GET /api/admin/mesas/status
// ============================================================================

describe('GET /api/admin/mesas/status', () => {
  let GET: any;

  beforeEach(async () => {
    const mod = await import('../status/route');
    GET = mod.GET;
  });

  it('debe retornar estado de mesas', async () => {
    mockGetTableStatus.mockResolvedValue({
      success: true,
      data: { total: 10, available: 7, occupied: 3, merged: 0, tables: [] },
    });

    const req = makeRequest('/api/admin/mesas/status');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(10);
    expect(data.available).toBe(7);
  });

  it('debe pasar location_id como filtro', async () => {
    mockGetTableStatus.mockResolvedValue({
      success: true,
      data: { total: 5, available: 5, occupied: 0, merged: 0, tables: [] },
    });

    const req = makeRequest('/api/admin/mesas/status', { location_id: 'loc-1' });
    await GET(req);

    expect(mockGetTableStatus).toHaveBeenCalledWith('tenant-1', 'loc-1');
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/mesas/status');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /api/admin/mesas/[id]/occupy
// ============================================================================

describe('POST /api/admin/mesas/[id]/occupy', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/occupy/route');
    POST = mod.POST;
  });

  it('debe ocupar mesa', async () => {
    mockOccupyTable.mockResolvedValue({
      success: true,
      data: { tableId: 't-1', status: 'OCCUPIED', guestCount: 3 },
    });

    const req = makeRequest('/api/admin/mesas/t-1/occupy', {}, {
      method: 'POST',
      body: JSON.stringify({ guestCount: 3 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('OCCUPIED');
  });

  it('debe requerir guestCount', async () => {
    const req = makeRequest('/api/admin/mesas/t-1/occupy', {}, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });

  it('debe retornar error del servicio', async () => {
    mockOccupyTable.mockResolvedValue({
      success: false,
      error: { message: 'Mesa no disponible' },
    });

    const req = makeRequest('/api/admin/mesas/t-1/occupy', {}, {
      method: 'POST',
      body: JSON.stringify({ guestCount: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST /api/admin/mesas/[id]/release
// ============================================================================

describe('POST /api/admin/mesas/[id]/release', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/release/route');
    POST = mod.POST;
  });

  it('debe liberar mesa', async () => {
    mockReleaseTable.mockResolvedValue({
      success: true,
      data: { tableId: 't-1', stayMinutes: 45 },
    });

    const req = makeRequest('/api/admin/mesas/t-1/release', {}, { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stayMinutes).toBe(45);
  });

  it('debe retornar error si no está ocupada', async () => {
    mockReleaseTable.mockResolvedValue({
      success: false,
      error: { message: 'Mesa no está ocupada' },
    });

    const req = makeRequest('/api/admin/mesas/t-1/release', {}, { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST /api/admin/mesas/[id]/merge
// ============================================================================

describe('POST /api/admin/mesas/[id]/merge', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/merge/route');
    POST = mod.POST;
  });

  it('debe unir mesas', async () => {
    mockMergeTables.mockResolvedValue({
      success: true,
      data: { parentTableId: 't-1', childTableIds: ['t-2', 't-3'], totalCapacity: 12 },
    });

    const req = makeRequest('/api/admin/mesas/t-1/merge', {}, {
      method: 'POST',
      body: JSON.stringify({ childTableIds: ['t-2', 't-3'] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalCapacity).toBe(12);
  });

  it('debe requerir childTableIds', async () => {
    const req = makeRequest('/api/admin/mesas/t-1/merge', {}, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });

  it('debe rechazar childTableIds vacío', async () => {
    const req = makeRequest('/api/admin/mesas/t-1/merge', {}, {
      method: 'POST',
      body: JSON.stringify({ childTableIds: [] }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST /api/admin/mesas/[id]/split
// ============================================================================

describe('POST /api/admin/mesas/[id]/split', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/split/route');
    POST = mod.POST;
  });

  it('debe separar mesas', async () => {
    mockSplitTables.mockResolvedValue({
      success: true,
      data: { parentTableId: 't-1', restoredTableIds: ['t-2', 't-3'] },
    });

    const req = makeRequest('/api/admin/mesas/t-1/split', {}, { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.restoredTableIds).toEqual(['t-2', 't-3']);
  });

  it('debe retornar error si no está unida', async () => {
    mockSplitTables.mockResolvedValue({
      success: false,
      error: { message: 'Mesa no está unida' },
    });

    const req = makeRequest('/api/admin/mesas/t-1/split', {}, { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/mesas/t-1/split', {}, { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 't-1' }) });
    expect(res.status).toBe(401);
  });
});
