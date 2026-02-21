/**
 * Course Fire API Tests
 *
 * @module app/api/admin/orders/__tests__/course-fire-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetCourseStatus = vi.fn();
const mockAssignCourse = vi.fn();
const mockFireCourse = vi.fn();

vi.mock('@/src/core/services/course-fire.service', () => {
  return {
    CourseFireService: class {
      getCourseStatus = mockGetCourseStatus;
      assignCourse = mockAssignCourse;
      fireCourse = mockFireCourse;
    },
  };
});

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

const mockAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAuth(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authed() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' },
  });
}

function unauthorized() {
  mockAuth.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
  });
}

function makeRequest(method: string, body?: any) {
  const url = 'http://localhost/api/admin/orders/order-1/courses';
  const init: any = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(url, init);
}

const params = Promise.resolve({ id: 'order-1' });

// ---------------------------------------------------------------------------
// Tests: GET /api/admin/orders/[id]/courses
// ---------------------------------------------------------------------------

describe('GET /api/admin/orders/[id]/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe retornar estado de courses', async () => {
    mockGetCourseStatus.mockResolvedValue({
      success: true,
      data: {
        orderId: 'order-1',
        courses: [
          { course: 1, label: 'Entrada', items: [], completedCount: 0, totalCount: 1, percentComplete: 0, state: 'ACTIVE' },
        ],
        activeCourse: 1,
        parallelItems: [],
      },
    });

    const { GET } = await import('../../orders/[id]/courses/route');
    const res = await GET(makeRequest('GET'), { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orderId).toBe('order-1');
    expect(data.courses).toHaveLength(1);
    expect(data.activeCourse).toBe(1);
  });

  it('debe retornar 404 si orden no existe', async () => {
    mockGetCourseStatus.mockResolvedValue({
      success: false,
      error: { message: 'Orden no encontrada' },
    });

    const { GET } = await import('../../orders/[id]/courses/route');
    const res = await GET(makeRequest('GET'), { params });

    expect(res.status).toBe(404);
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { GET } = await import('../../orders/[id]/courses/route');
    const res = await GET(makeRequest('GET'), { params });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/admin/orders/[id]/courses
// ---------------------------------------------------------------------------

describe('POST /api/admin/orders/[id]/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe asignar course a items', async () => {
    mockAssignCourse.mockResolvedValue({
      success: true,
      data: { updatedCount: 2 },
    });

    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { lineIds: ['l1', 'l2'], course: 2 }),
      { params },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.updatedCount).toBe(2);
    expect(mockAssignCourse).toHaveBeenCalledWith('tenant-1', 'order-1', ['l1', 'l2'], 2);
  });

  it('debe rechazar sin lineIds', async () => {
    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { course: 2 }),
      { params },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('lineIds');
  });

  it('debe rechazar sin course', async () => {
    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { lineIds: ['l1'] }),
      { params },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('course');
  });

  it('debe rechazar course inválido (0)', async () => {
    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { lineIds: ['l1'], course: 0 }),
      { params },
    );

    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { lineIds: ['l1'], course: 2 }),
      { params },
    );

    expect(res.status).toBe(401);
  });

  it('debe retornar error del servicio', async () => {
    mockAssignCourse.mockResolvedValue({
      success: false,
      error: { message: 'No se encontraron items' },
    });

    const { POST } = await import('../../orders/[id]/courses/route');
    const res = await POST(
      makeRequest('POST', { lineIds: ['l999'], course: 2 }),
      { params },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No se encontraron');
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /api/admin/orders/[id]/courses/fire
// ---------------------------------------------------------------------------

describe('POST /api/admin/orders/[id]/courses/fire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe disparar course', async () => {
    mockFireCourse.mockResolvedValue({
      success: true,
      data: { firedCount: 3 },
    });

    const { POST } = await import('../../orders/[id]/courses/fire/route');
    const res = await POST(
      makeRequest('POST', { course: 2 }),
      { params },
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.firedCount).toBe(3);
    expect(mockFireCourse).toHaveBeenCalledWith('tenant-1', 'order-1', 2);
  });

  it('debe rechazar sin course', async () => {
    const { POST } = await import('../../orders/[id]/courses/fire/route');
    const res = await POST(
      makeRequest('POST', {}),
      { params },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('course');
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { POST } = await import('../../orders/[id]/courses/fire/route');
    const res = await POST(
      makeRequest('POST', { course: 2 }),
      { params },
    );

    expect(res.status).toBe(401);
  });

  it('debe retornar error si course previo incompleto', async () => {
    mockFireCourse.mockResolvedValue({
      success: false,
      error: { message: 'El tiempo 1 aún no está completo' },
    });

    const { POST } = await import('../../orders/[id]/courses/fire/route');
    const res = await POST(
      makeRequest('POST', { course: 2 }),
      { params },
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('no está completo');
  });

  it('debe rechazar JSON inválido', async () => {
    const { POST } = await import('../../orders/[id]/courses/fire/route');
    const req = new NextRequest('http://localhost/api/admin/orders/order-1/courses/fire', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });
});
