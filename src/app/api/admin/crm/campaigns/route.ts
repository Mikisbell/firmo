/**
 * Admin CRM Campaigns API
 * GET /api/admin/crm/campaigns - List campaigns
 * POST /api/admin/crm/campaigns - Create campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { CampaignService } from '@/src/core/services/campaign.service';
import { CreateCampaignSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const status = request.nextUrl.searchParams.get('status') ?? undefined;

  try {
    const service = new CampaignService();
    const campaigns = await service.list(authResult.user.tenantId, status);
    return NextResponse.json({ data: campaigns });
  } catch {
    return NextResponse.json({ error: 'Error al obtener campañas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const validated = CreateCampaignSchema.parse(body);

    const service = new CampaignService();
    const result = await service.create(authResult.user.tenantId, validated, authResult.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 });
  }
}
