/**
 * Tests for CRM module:
 * - GET/POST /api/admin/crm/campaigns
 * - GET      /api/admin/crm/campaigns/[id]
 * - POST     /api/admin/crm/campaigns/[id]/launch
 * - POST     /api/admin/crm/campaigns/[id]/cancel
 * - GET/POST /api/admin/crm/segments
 * - GET/PUT/DELETE /api/admin/crm/segments/[id]
 * - GET/POST /api/admin/crm/templates
 * - GET      /api/admin/crm/rfm/summary
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id always from JWT
 * - Services use result pattern: { success, data } | { success: false, error }
 * - CampaignService/SegmentService/TemplateService instantiated with new
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockCampaignList,
  mockCampaignCreate,
  mockCampaignGetById,
  mockCampaignGetStats,
  mockCampaignLaunch,
  mockCampaignCancel,
  mockSegmentList,
  mockSegmentCreate,
  mockSegmentGetById,
  mockSegmentUpdate,
  mockSegmentDelete,
  mockTemplateList,
  mockTemplateCreate,
  mockQueryRawUnsafe,
  mockCustomerProfileFindFirst,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockCampaignList: vi.fn(),
  mockCampaignCreate: vi.fn(),
  mockCampaignGetById: vi.fn(),
  mockCampaignGetStats: vi.fn(),
  mockCampaignLaunch: vi.fn(),
  mockCampaignCancel: vi.fn(),
  mockSegmentList: vi.fn(),
  mockSegmentCreate: vi.fn(),
  mockSegmentGetById: vi.fn(),
  mockSegmentUpdate: vi.fn(),
  mockSegmentDelete: vi.fn(),
  mockTemplateList: vi.fn(),
  mockTemplateCreate: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
  mockCustomerProfileFindFirst: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/services/campaign.service', () => ({
  CampaignService: vi.fn().mockImplementation(function (this: any) {
    this.list = mockCampaignList;
    this.create = mockCampaignCreate;
    this.getById = mockCampaignGetById;
    this.getStats = mockCampaignGetStats;
    this.launch = mockCampaignLaunch;
    this.cancel = mockCampaignCancel;
  }),
}));

vi.mock('@/src/core/services/segment.service', () => ({
  SegmentService: vi.fn().mockImplementation(function (this: any) {
    this.list = mockSegmentList;
    this.create = mockSegmentCreate;
    this.getById = mockSegmentGetById;
    this.update = mockSegmentUpdate;
    this.delete = mockSegmentDelete;
  }),
}));

vi.mock('@/src/core/services/template.service', () => ({
  TemplateService: vi.fn().mockImplementation(function (this: any) {
    this.list = mockTemplateList;
    this.create = mockTemplateCreate;
  }),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $queryRawUnsafe: mockQueryRawUnsafe,
    customer_profile: { findFirst: mockCustomerProfileFindFirst },
  },
}));

import { GET as GETCampaigns, POST as POSTCampaigns } from '../campaigns/route';
import { GET as GETCampaign } from '../campaigns/[id]/route';
import { POST as POSTLaunch } from '../campaigns/[id]/launch/route';
import { POST as POSTCancel } from '../campaigns/[id]/cancel/route';
import { GET as GETSegments, POST as POSTSegments } from '../segments/route';
import { GET as GETSegment, PUT as PUTSegment, DELETE as DELETESegment } from '../segments/[id]/route';
import { GET as GETTemplates, POST as POSTTemplates } from '../templates/route';
import { GET as GETRfm } from '../rfm/summary/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const CAMPAIGN_ID = 'ca000000-0000-0000-0000-000000000001';
const SEGMENT_ID = 'ae000000-0000-0000-0000-000000000001';
const TEMPLATE_ID = 'e0000000-0000-0000-0000-000000000001';

const baseCampaign = {
  id: CAMPAIGN_ID,
  tenant_id: TENANT_ID,
  name: 'Campaña VIP',
  status: 'DRAFT',
  channel: 'WHATSAPP',
};

const baseSegment = {
  id: SEGMENT_ID,
  tenant_id: TENANT_ID,
  name: 'Clientes VIP',
  is_active: true,
};

const baseTemplate = {
  id: TEMPLATE_ID,
  tenant_id: TENANT_ID,
  name: 'Promo Navidad',
  channel: 'WHATSAPP',
  content: 'Hola {nombre}, tenemos una oferta para vos!',
};

const validCampaignPayload = {
  name: 'Campaña Verano',
  segment_id: SEGMENT_ID,
  template_id: TEMPLATE_ID,
  channel: 'WHATSAPP',
};

const validSegmentPayload = {
  name: 'Clientes Frecuentes',
  definition: {
    type: 'CUSTOM',
    filters: [{ field: 'frequency_30d', operator: 'gte', value: 3 }],
    logic: 'AND',
  },
};

const validTemplatePayload = {
  name: 'Bienvenida',
  channel: 'WHATSAPP',
  content: 'Hola {nombre}, bienvenido!',
};

function makeRequest(url: string, method: string = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

const ok = (data: any) => ({ success: true, data });
const fail = (message: string) => ({ success: false, error: { message } });

// ─── Campaigns list/create ────────────────────────────────────────────────────

describe('GET /api/admin/crm/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCampaignList.mockResolvedValue([baseCampaign]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETCampaigns(makeRequest('/api/admin/crm/campaigns'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { data } array', async () => {
    const res = await GETCampaigns(makeRequest('/api/admin/crm/campaigns'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETCampaigns(makeRequest('/api/admin/crm/campaigns'));
    expect(mockCampaignList).toHaveBeenCalledWith(TENANT_ID, undefined);
  });

  it('passes status filter to service', async () => {
    await GETCampaigns(makeRequest('/api/admin/crm/campaigns?status=ACTIVE'));
    expect(mockCampaignList).toHaveBeenCalledWith(TENANT_ID, 'ACTIVE');
  });
});

describe('POST /api/admin/crm/campaigns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCampaignCreate.mockResolvedValue(ok(baseCampaign));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', validCampaignPayload));
    expect(res.status).toBe(401);
  });

  it('returns 201 on success', async () => {
    const res = await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', validCampaignPayload));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Campaña VIP');
  });

  it('passes tenant_id from JWT to service', async () => {
    await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', validCampaignPayload));
    expect(mockCampaignCreate).toHaveBeenCalledWith(TENANT_ID, expect.any(Object), EMPLOYEE_ID);
  });

  it('returns 400 on service failure', async () => {
    mockCampaignCreate.mockResolvedValue(fail('Segmento no encontrado'));
    const res = await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', validCampaignPayload));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid payload (missing name)', async () => {
    const res = await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', { channel: 'WHATSAPP' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid channel', async () => {
    const res = await POSTCampaigns(makeRequest('/api/admin/crm/campaigns', 'POST', { ...validCampaignPayload, channel: 'EMAIL' }));
    expect(res.status).toBe(400);
  });
});

// ─── Campaign detail / launch / cancel ───────────────────────────────────────

describe('GET /api/admin/crm/campaigns/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCampaignGetById.mockResolvedValue(ok(baseCampaign));
    mockCampaignGetStats.mockResolvedValue(ok({ sent: 100, opened: 40 }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETCampaign(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}`), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 with campaign and stats', async () => {
    const res = await GETCampaign(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}`), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.sent).toBe(100);
  });

  it('returns 404 when campaign not found', async () => {
    mockCampaignGetById.mockResolvedValue(fail('No encontrada'));
    const res = await GETCampaign(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}`), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/crm/campaigns/[id]/launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCampaignLaunch.mockResolvedValue(ok({ ...baseCampaign, status: 'ACTIVE' }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTLaunch(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/launch`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 and launches campaign', async () => {
    const res = await POSTLaunch(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/launch`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(200);
    expect(mockCampaignLaunch).toHaveBeenCalledWith(TENANT_ID, CAMPAIGN_ID);
  });

  it('returns 400 on launch failure (e.g. wrong state)', async () => {
    mockCampaignLaunch.mockResolvedValue(fail('Campaña ya fue lanzada'));
    const res = await POSTLaunch(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/launch`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/crm/campaigns/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCampaignCancel.mockResolvedValue(ok(true));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTCancel(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/cancel`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful cancel', async () => {
    const res = await POSTCancel(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/cancel`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 on cancel failure', async () => {
    mockCampaignCancel.mockResolvedValue(fail('No se puede cancelar'));
    const res = await POSTCancel(makeRequest(`/api/admin/crm/campaigns/${CAMPAIGN_ID}/cancel`, 'POST'), { params: Promise.resolve({ id: CAMPAIGN_ID }) });
    expect(res.status).toBe(400);
  });
});

// ─── Segments ─────────────────────────────────────────────────────────────────

describe('GET /api/admin/crm/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockSegmentList.mockResolvedValue([baseSegment]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETSegments(makeRequest('/api/admin/crm/segments'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { data } array scoped to tenant', async () => {
    const res = await GETSegments(makeRequest('/api/admin/crm/segments'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockSegmentList).toHaveBeenCalledWith(TENANT_ID);
  });
});

describe('POST /api/admin/crm/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockSegmentCreate.mockResolvedValue(ok(baseSegment));
  });

  it('returns 201 on success', async () => {
    const res = await POSTSegments(makeRequest('/api/admin/crm/segments', 'POST', validSegmentPayload));
    expect(res.status).toBe(201);
  });

  it('passes tenant_id from JWT to service', async () => {
    await POSTSegments(makeRequest('/api/admin/crm/segments', 'POST', validSegmentPayload));
    expect(mockSegmentCreate).toHaveBeenCalledWith(TENANT_ID, expect.any(Object), EMPLOYEE_ID);
  });

  it('returns 400 on invalid payload (name too short)', async () => {
    const res = await POSTSegments(makeRequest('/api/admin/crm/segments', 'POST', { name: 'X', definition: validSegmentPayload.definition }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid operator', async () => {
    const badDef = { ...validSegmentPayload.definition, filters: [{ field: 'frequency_30d', operator: 'INVALID', value: 3 }] };
    const res = await POSTSegments(makeRequest('/api/admin/crm/segments', 'POST', { name: 'Test', definition: badDef }));
    expect(res.status).toBe(400);
  });
});

describe('GET/PUT/DELETE /api/admin/crm/segments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockSegmentGetById.mockResolvedValue(ok(baseSegment));
    mockSegmentUpdate.mockResolvedValue(ok({ ...baseSegment, name: 'Actualizado' }));
    mockSegmentDelete.mockResolvedValue(ok(true));
  });

  it('GET returns 404 when not found', async () => {
    mockSegmentGetById.mockResolvedValue(fail('No encontrado'));
    const res = await GETSegment(makeRequest(`/api/admin/crm/segments/${SEGMENT_ID}`), { params: Promise.resolve({ id: SEGMENT_ID }) });
    expect(res.status).toBe(404);
  });

  it('GET returns 200 with segment data', async () => {
    const res = await GETSegment(makeRequest(`/api/admin/crm/segments/${SEGMENT_ID}`), { params: Promise.resolve({ id: SEGMENT_ID }) });
    expect(res.status).toBe(200);
    expect(mockSegmentGetById).toHaveBeenCalledWith(TENANT_ID, SEGMENT_ID);
  });

  it('PUT returns 200 on valid update', async () => {
    const res = await PUTSegment(makeRequest(`/api/admin/crm/segments/${SEGMENT_ID}`, 'PUT', { name: 'Nuevo Nombre' }), { params: Promise.resolve({ id: SEGMENT_ID }) });
    expect(res.status).toBe(200);
    expect(mockSegmentUpdate).toHaveBeenCalledWith(TENANT_ID, SEGMENT_ID, expect.any(Object));
  });

  it('DELETE returns 200 on success', async () => {
    const res = await DELETESegment(makeRequest(`/api/admin/crm/segments/${SEGMENT_ID}`, 'DELETE'), { params: Promise.resolve({ id: SEGMENT_ID }) });
    expect(res.status).toBe(200);
    expect(mockSegmentDelete).toHaveBeenCalledWith(TENANT_ID, SEGMENT_ID);
  });

  it('DELETE returns 404 when not found', async () => {
    mockSegmentDelete.mockResolvedValue(fail('No encontrado'));
    const res = await DELETESegment(makeRequest(`/api/admin/crm/segments/${SEGMENT_ID}`, 'DELETE'), { params: Promise.resolve({ id: SEGMENT_ID }) });
    expect(res.status).toBe(404);
  });
});

// ─── Templates ────────────────────────────────────────────────────────────────

describe('GET /api/admin/crm/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTemplateList.mockResolvedValue([baseTemplate]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETTemplates(makeRequest('/api/admin/crm/templates'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { data } array', async () => {
    const res = await GETTemplates(makeRequest('/api/admin/crm/templates'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(mockTemplateList).toHaveBeenCalledWith(TENANT_ID, undefined);
  });

  it('passes channel filter to service', async () => {
    await GETTemplates(makeRequest('/api/admin/crm/templates?channel=SMS'));
    expect(mockTemplateList).toHaveBeenCalledWith(TENANT_ID, 'SMS');
  });
});

describe('POST /api/admin/crm/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTemplateCreate.mockResolvedValue(ok(baseTemplate));
  });

  it('returns 201 on success', async () => {
    const res = await POSTTemplates(makeRequest('/api/admin/crm/templates', 'POST', validTemplatePayload));
    expect(res.status).toBe(201);
  });

  it('passes tenant_id from JWT to service', async () => {
    await POSTTemplates(makeRequest('/api/admin/crm/templates', 'POST', validTemplatePayload));
    expect(mockTemplateCreate).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
  });

  it('returns 400 on invalid channel', async () => {
    const res = await POSTTemplates(makeRequest('/api/admin/crm/templates', 'POST', { ...validTemplatePayload, channel: 'EMAIL' }));
    expect(res.status).toBe(400);
  });
});

// ─── RFM Summary ─────────────────────────────────────────────────────────────

describe('GET /api/admin/crm/rfm/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockQueryRawUnsafe.mockResolvedValue([
      { segment: 'VIP', count: 15 },
      { segment: 'FRECUENTE', count: 42 },
    ]);
    mockCustomerProfileFindFirst.mockResolvedValue({ rfm_calculated_at: new Date('2026-03-25') });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETRfm(makeRequest('/api/admin/crm/rfm/summary'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with distribution and last_computed_at', async () => {
    const res = await GETRfm(makeRequest('/api/admin/crm/rfm/summary'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.distribution).toHaveLength(2);
    expect(body.last_computed_at).toBeDefined();
  });

  it('passes tenant_id from JWT to raw query', async () => {
    await GETRfm(makeRequest('/api/admin/crm/rfm/summary'));
    expect(mockQueryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('tenant_id'), TENANT_ID);
  });

  it('returns null last_computed_at when no customers have RFM data', async () => {
    mockCustomerProfileFindFirst.mockResolvedValue(null);
    const res = await GETRfm(makeRequest('/api/admin/crm/rfm/summary'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.last_computed_at).toBeNull();
  });

  it('returns 500 on DB error', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('DB error'));
    const res = await GETRfm(makeRequest('/api/admin/crm/rfm/summary'));
    expect(res.status).toBe(500);
  });
});
