/**
 * Admin CRM Campaign Detail API
 * GET /api/admin/crm/campaigns/[id] - Get campaign with stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { CampaignService } from '@/src/core/services/campaign.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new CampaignService();

    const result = await service.getById(authResult.user.tenantId, id);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    const stats = await service.getStats(authResult.user.tenantId, id);

    return NextResponse.json({
      ...result.data,
      stats: stats.success ? stats.data : null,
    });
  } catch {
    return NextResponse.json({ error: 'Error al obtener campaña' }, { status: 500 });
  }
}
