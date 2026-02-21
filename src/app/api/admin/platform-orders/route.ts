/**
 * Admin Platform Orders API - GET
 *
 * List platform orders with optional filters.
 *
 * @module app/api/admin/platform-orders/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PlatformOrderService } from '@/src/core/services/platform-order.service';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const service = new PlatformOrderService(prisma);
  const platform = request.nextUrl.searchParams.get('platform') as any;
  const status = request.nextUrl.searchParams.get('status') as any;
  const limitStr = request.nextUrl.searchParams.get('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;

  const result = await service.getOrders(authResult.user.tenantId, {
    platform: platform || undefined,
    status: status || undefined,
    limit,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ orders: result.data });
}
