/**
 * Admin Loyalty Customer Balance API
 * GET /api/admin/loyalty/customers/[id] - Customer loyalty balance and tier info
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { LoyaltyService } from '@/src/core/services/loyalty.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new LoyaltyService();
    const balance = await service.getBalance(authResult.user.tenantId, id);
    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener balance de fidelización' },
      { status: 500 },
    );
  }
}
