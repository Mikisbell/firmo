import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';

export async function GET(request: Request) {
  const authResult = await requireAdminAuth(request as any);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const locations = await prisma.locations.findMany({
      where: { tenant_id: authResult.user.tenantId, is_active: true },
      select: { id: true, code: true, name: true, address: true, timezone: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ locations });
  } catch {
    return NextResponse.json({ error: 'Error al obtener locaciones' }, { status: 500 });
  }
}
