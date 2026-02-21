/**
 * Table Status API - GET
 *
 * @module app/api/admin/mesas/status/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { MesaService } from '@/src/core/services/mesa.service';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const locationId = request.nextUrl.searchParams.get('location_id') || undefined;

  const service = new MesaService(prisma);
  const result = await service.getTableStatus(authResult.user.tenantId, locationId);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
