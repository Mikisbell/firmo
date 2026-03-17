/**
 * Admin CRM Campaign Launch API
 * POST /api/admin/crm/campaigns/[id]/launch - Launch campaign
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { CampaignService } from '@/src/core/services/campaign.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new CampaignService();
    const result = await service.launch(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Error al lanzar campaña' }, { status: 500 });
  }
}
