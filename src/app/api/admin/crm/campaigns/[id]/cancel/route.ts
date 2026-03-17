/**
 * Admin CRM Campaign Cancel API
 * POST /api/admin/crm/campaigns/[id]/cancel - Cancel campaign
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
    const result = await service.cancel(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error al cancelar campaña' }, { status: 500 });
  }
}
