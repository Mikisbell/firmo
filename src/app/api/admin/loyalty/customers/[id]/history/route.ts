/**
 * Admin Loyalty Customer History API
 * GET /api/admin/loyalty/customers/[id]/history - Paginated loyalty ledger
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
    const page = parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10), 100);

    const service = new LoyaltyService();
    const result = await service.getHistory(authResult.user.tenantId, id, page, limit);

    return NextResponse.json({
      data: result.entries,
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener historial de puntos' },
      { status: 500 },
    );
  }
}
