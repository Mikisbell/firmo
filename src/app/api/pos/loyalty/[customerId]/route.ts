/**
 * POS Loyalty Balance API
 * GET /api/pos/loyalty/[customerId] - Customer loyalty balance for POS display
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { LoyaltyService } from '@/src/core/services/loyalty.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { customerId } = await params;
    const service = new LoyaltyService();

    const config = await service.getLoyaltyConfig(authResult.user.tenantId);
    if (!config.enabled) {
      return NextResponse.json({ enabled: false });
    }

    const balance = await service.getBalance(authResult.user.tenantId, customerId);
    return NextResponse.json({ enabled: true, ...balance });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener puntos' },
      { status: 500 },
    );
  }
}
