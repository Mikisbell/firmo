/**
 * Tests for /api/admin/recipes (GET + POST)
 * and /api/admin/recipes/[id] (GET + PUT + PATCH + DELETE)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - POST validates product exists + no duplicate + all ingredients in inventory
 * - PUT updates recipe fields (partial, all optional)
 * - PATCH triggers cost recalculation via recipeService.calculateCost()
 * - DELETE deactivates (soft-delete)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockRecipeServiceList,
  mockRecipeServiceCreate,
  mockRecipeServiceGetById,
  mockRecipeServiceUpdate,
  mockRecipeServiceCalculateCost,
  mockRecipeServiceDeactivate,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockRecipeServiceList: vi.fn(),
  mockRecipeServiceCreate: vi.fn(),
  mockRecipeServiceGetById: vi.fn(),
  mockRecipeServiceUpdate: vi.fn(),
  mockRecipeServiceCalculateCost: vi.fn(),
  mockRecipeServiceDeactivate: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/services/recipe.service', () => ({
  recipeService: {
    list: mockRecipeServiceList,
    create: mockRecipeServiceCreate,
    getById: mockRecipeServiceGetById,
    update: mockRecipeServiceUpdate,
    calculateCost: mockRecipeServiceCalculateCost,
    deactivate: mockRecipeServiceDeactivate,
  },
}));

vi.mock('@/src/core/admin/schemas/recipe.schema', async (importOriginal) => {
  return await importOriginal();
});

import { GET, POST } from '../route';
import { GET as GetById, PUT, PATCH, DELETE } from '../[id]/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';
const RECIPE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PRODUCT_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const baseRecipe = {
  id: RECIPE_ID,
  tenant_id: TENANT_ID,
  product_id: PRODUCT_ID,
  name: 'Pollo Entero',
  ingredients: [{ inventory_code: 'POLLO-001', quantity: 1, unit: 'KG' }],
  yield_qty: 1,
  yield_unit: 'UNIDADES',
  conversion_factor: 1.0,
  category: 'POLLO',
  preparation_time_minutes: 45,
  cost_cents: 1500,
  is_active: true,
  product_name: 'Pollo a la Brasa',
  product_station: 'PARRILLA',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/recipes', {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDetailRequest(
  method: 'GET' | 'PUT' | 'PATCH' | 'DELETE',
  body?: object,
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/recipes/${RECIPE_ID}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeParams = { params: Promise.resolve({ id: RECIPE_ID }) };

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', name: 'Test Admin', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/recipes ───────────────────────────────────────────────────

describe('GET /api/admin/recipes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceList.mockResolvedValue({
      success: true,
      data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('calls recipeService.list with tenant_id from JWT', async () => {
    await GET(makeRequest('GET'));
    expect(mockRecipeServiceList).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
  });

  it('returns 200 with recipes', async () => {
    mockRecipeServiceList.mockResolvedValue({
      success: true,
      data: { data: [baseRecipe], total: 1, page: 1, pageSize: 20, totalPages: 1 },
    });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].product_name).toBe('Pollo a la Brasa');
  });

  it('returns 500 when service fails', async () => {
    mockRecipeServiceList.mockResolvedValue({
      success: false,
      error: { message: 'DB error', code: 'LIST_RECIPES_FAILED' },
    });
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/admin/recipes ──────────────────────────────────────────────────

describe('POST /api/admin/recipes', () => {
  const validPayload = {
    product_id: PRODUCT_ID,
    ingredients: [{ inventory_code: 'POLLO-001', quantity: 1, unit: 'KG' }],
    yield_qty: 1,
    yield_unit: 'UNIDADES',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceCreate.mockResolvedValue({ success: true, data: baseRecipe });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('creates recipe with tenant_id from JWT', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);
    expect(mockRecipeServiceCreate).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ product_id: PRODUCT_ID }),
      EMPLOYEE_ID,
    );
  });

  it('returns 409 on duplicate product recipe', async () => {
    mockRecipeServiceCreate.mockResolvedValue({
      success: false,
      error: { message: 'Ya existe una receta', code: 'CONFLICT' },
    });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(409);
  });

  it('returns 404 when product not found', async () => {
    mockRecipeServiceCreate.mockResolvedValue({
      success: false,
      error: { message: 'Producto no encontrado', code: 'NOT_FOUND' },
    });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid payload (missing product_id)', async () => {
    const res = await POST(makeRequest('POST', { ingredients: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ingredients array is empty', async () => {
    const res = await POST(makeRequest('POST', { ...validPayload, ingredients: [] }));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/recipes/[id] ─────────────────────────────────────────────

describe('GET /api/admin/recipes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceGetById.mockResolvedValue({ success: true, data: baseRecipe });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 200 with recipe data', async () => {
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(RECIPE_ID);
  });

  it('calls getById with tenant_id from JWT', async () => {
    await GetById(makeDetailRequest('GET'), routeParams);
    expect(mockRecipeServiceGetById).toHaveBeenCalledWith(TENANT_ID, RECIPE_ID);
  });

  it('returns 404 when recipe not found', async () => {
    mockRecipeServiceGetById.mockResolvedValue({
      success: false,
      error: { message: 'Receta no encontrada', code: 'NOT_FOUND' },
    });
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/admin/recipes/[id] ─────────────────────────────────────────────

describe('PUT /api/admin/recipes/[id]', () => {
  const updatePayload = { name: 'Receta Actualizada' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceUpdate.mockResolvedValue({
      success: true,
      data: { ...baseRecipe, name: 'Receta Actualizada' },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeDetailRequest('PUT', updatePayload), routeParams);
    expect(res.status).toBe(401);
  });

  it('updates recipe and returns 200', async () => {
    const res = await PUT(makeDetailRequest('PUT', updatePayload), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Receta Actualizada');
  });

  it('calls update with tenant_id from JWT', async () => {
    await PUT(makeDetailRequest('PUT', updatePayload), routeParams);
    expect(mockRecipeServiceUpdate).toHaveBeenCalledWith(
      TENANT_ID,
      RECIPE_ID,
      expect.any(Object),
      EMPLOYEE_ID,
    );
  });

  it('returns 404 when recipe not found', async () => {
    mockRecipeServiceUpdate.mockResolvedValue({
      success: false,
      error: { message: 'Receta no encontrada', code: 'NOT_FOUND' },
    });
    const res = await PUT(makeDetailRequest('PUT', updatePayload), routeParams);
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/admin/recipes/[id] (calculate cost) ──────────────────────────

describe('PATCH /api/admin/recipes/[id] — calculate cost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceCalculateCost.mockResolvedValue({
      success: true,
      data: { cost_cents: 1500 },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(makeDetailRequest('PATCH'), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 200 with calculated cost', async () => {
    const res = await PATCH(makeDetailRequest('PATCH'), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cost_cents).toBe(1500);
  });

  it('calls calculateCost with tenant_id from JWT and recipe id', async () => {
    await PATCH(makeDetailRequest('PATCH'), routeParams);
    expect(mockRecipeServiceCalculateCost).toHaveBeenCalledWith(TENANT_ID, RECIPE_ID);
  });

  it('returns 404 when recipe not found', async () => {
    mockRecipeServiceCalculateCost.mockResolvedValue({
      success: false,
      error: { message: 'Receta no encontrada', code: 'NOT_FOUND' },
    });
    const res = await PATCH(makeDetailRequest('PATCH'), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 500 on calculation error', async () => {
    mockRecipeServiceCalculateCost.mockResolvedValue({
      success: false,
      error: { message: 'Error al calcular', code: 'CALCULATE_COST_FAILED' },
    });
    const res = await PATCH(makeDetailRequest('PATCH'), routeParams);
    expect(res.status).toBe(500);
  });
});

// ─── DELETE /api/admin/recipes/[id] ──────────────────────────────────────────

describe('DELETE /api/admin/recipes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecipeServiceDeactivate.mockResolvedValue({
      success: true,
      data: { id: RECIPE_ID, is_active: false },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(401);
  });

  it('deactivates recipe and returns 200', async () => {
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_active).toBe(false);
  });

  it('calls deactivate with tenant_id from JWT', async () => {
    await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(mockRecipeServiceDeactivate).toHaveBeenCalledWith(TENANT_ID, RECIPE_ID, EMPLOYEE_ID);
  });

  it('returns 404 when recipe not found', async () => {
    mockRecipeServiceDeactivate.mockResolvedValue({
      success: false,
      error: { message: 'Receta no encontrada', code: 'NOT_FOUND' },
    });
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(404);
  });
});
