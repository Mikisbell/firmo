import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';

export async function GET(request: Request) {
  const authResult = await requireAdminAuth(request as any);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const locations = await prisma.locations.findMany({
    where: { tenant_id: authResult.user.tenantId, is_active: true },
    select: { id: true, code: true, name: true, address: true, timezone: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ locations });
}
