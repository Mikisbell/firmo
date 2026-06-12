/**
 * Locations API Integration Tests
 *
 * Tests POST /api/locations (driver location update — auth + ownership)
 * and GET /api/locations (active driver locations — admin only, tenant-scoped).
 * Validates auth guards, tenant isolation, and driver ownership checks.
 *
 * @module app/api/locations/__tests__/locations-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateDriverLocation = vi.fn();
const mockGetActiveDriverLocations = vi.fn();

vi.mock('@/src/core/delivery/geolocation.service', () => ({
  updateDriverLocation: (...args: any[]) => mockUpdateDriverLocation(...args),
  getActiveDriverLocations: (...args: any[]) => mockGetActiveDriverLocations(...args),
}));

vi.mock('@/src/core/delivery/types-2026', () => ({
  toDriverId: (id: string) => id,
}));

const mockDriversFindFirst = vi.fn();
const mockDriversFindMany = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    drivers: {
      findFirst: (...args: any[]) => mockDriversFindFirst(...args),
      findMany: (...args: any[]) => mockDriversFindMany(...args),
    },
  },
}));

const mockPosAuth = vi.fn();
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: (...args: any[]) => mockPosAuth(...args),
}));

const mockAdminAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAdminAuth(...args),
}));

vi.mock('@/src/core/observability/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-loc-001';

function posAuthed(user: Partial<{ id: string; role: string }> = {}) {
  mockPosAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: user.id ?? 'emp-driver-1',
      role: user.role ?? 'DRIVER',
      name: 'Test User',
      tenantId: TENANT_ID,
      sessionId: 'session-1',
    },
  });
}

function posUnauthorized() {
  mockPosAuth.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'No autenticado. Por favor inicie sesion.' }),
      { status: 401 },
    ),
  });
}

function adminAuthed() {
  mockAdminAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      name: 'Admin User',
      tenantId: TENANT_ID,
      sessionId: 'session-2',
    },
  });
}

function adminUnauthorized() {
  mockAdminAuth.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'No autenticado. Por favor inicie sesion.' }),
      { status: 401 },
    ),
  });
}

function validLocationBody(driverId = 'drv-1') {
  return {
    driverId,
    latitude: -12.0464,
    longitude: -77.0428,
    accuracy: 10,
    speed: 5,
    heading: 90,
    timestamp: new Date().toISOString(),
  };
}

function makePostRequest(body: any) {
  return new NextRequest('http://localhost/api/locations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

function makeGetRequest() {
  return new NextRequest('http://localhost/api/locations', { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests: POST /api/locations
// ---------------------------------------------------------------------------

describe('POST /api/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    posAuthed();
    mockUpdateDriverLocation.mockResolvedValue(undefined);
  });

  it('debe rechazar sin auth (401)', async () => {
    posUnauthorized();

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(validLocationBody()));

    expect(res.status).toBe(401);
    expect(mockUpdateDriverLocation).not.toHaveBeenCalled();
  });

  it('debe permitir que un driver reporte SU propia ubicacion', async () => {
    mockDriversFindFirst.mockResolvedValue({ id: 'drv-1', employee_id: 'emp-driver-1' });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(validLocationBody('drv-1')));

    expect(res.status).toBe(200);
    expect(mockUpdateDriverLocation).toHaveBeenCalledWith(
      'drv-1',
      expect.objectContaining({ latitude: -12.0464, longitude: -77.0428 }),
    );
  });

  it('debe buscar el driver con tenant_id del JWT (nunca del body)', async () => {
    mockDriversFindFirst.mockResolvedValue({ id: 'drv-1', employee_id: 'emp-driver-1' });

    const { POST } = await import('../route');
    await POST(makePostRequest({ ...validLocationBody('drv-1'), tenant_id: 'tenant-evil' }));

    expect(mockDriversFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'drv-1', tenant_id: TENANT_ID },
      }),
    );
  });

  it('debe rechazar driver que reporta ubicacion de OTRO driver (403)', async () => {
    // driver record belongs to a different employee
    mockDriversFindFirst.mockResolvedValue({ id: 'drv-2', employee_id: 'emp-other' });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(validLocationBody('drv-2')));

    expect(res.status).toBe(403);
    expect(mockUpdateDriverLocation).not.toHaveBeenCalled();
  });

  it('debe retornar 404 si el driver no existe en el tenant', async () => {
    mockDriversFindFirst.mockResolvedValue(null);

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(validLocationBody('drv-foreign')));

    expect(res.status).toBe(404);
    expect(mockUpdateDriverLocation).not.toHaveBeenCalled();
  });

  it('debe permitir que un ADMIN reporte ubicacion de cualquier driver del tenant', async () => {
    posAuthed({ id: 'emp-admin', role: 'ADMIN' });
    mockDriversFindFirst.mockResolvedValue({ id: 'drv-1', employee_id: 'emp-driver-1' });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(validLocationBody('drv-1')));

    expect(res.status).toBe(200);
    expect(mockUpdateDriverLocation).toHaveBeenCalled();
  });

  it('debe rechazar body invalido (400)', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ driverId: 'drv-1', latitude: 999 }));

    expect(res.status).toBe(400);
    expect(mockUpdateDriverLocation).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/locations
// ---------------------------------------------------------------------------

describe('GET /api/locations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminAuthed();
  });

  it('debe rechazar sin auth admin (401)', async () => {
    adminUnauthorized();

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    expect(mockGetActiveDriverLocations).not.toHaveBeenCalled();
  });

  it('debe retornar solo drivers del tenant autenticado', async () => {
    const now = new Date();
    mockGetActiveDriverLocations.mockResolvedValue(
      new Map([
        ['drv-1', { latitude: 1, longitude: 2, accuracy: 5, timestamp: now }],
        ['drv-foreign', { latitude: 3, longitude: 4, accuracy: 5, timestamp: now }],
      ]),
    );
    // Only drv-1 belongs to the authenticated tenant
    mockDriversFindMany.mockResolvedValue([{ id: 'drv-1' }]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.drivers).toHaveLength(1);
    expect(data.drivers[0].driverId).toBe('drv-1');
    expect(mockDriversFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_ID } }),
    );
  });
});
