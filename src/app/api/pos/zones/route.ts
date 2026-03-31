/**
 * POS Zones API - GET (read-only, public within origin)
 * Zone layout is non-sensitive data required by the waiter terminal before
 * a JWT session is established. Tenant is resolved from x-tenant-id header.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('pos-zones');

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id') ||
    request.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 });
  }

  try {
    const loc = await prisma.locations.findFirst({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!loc) return NextResponse.json([], { status: 200 });
    const locationId = loc.id;

    const zones = await prisma.zones.findMany({
      where: {
        tenant_id: tenantId,
        location_id: locationId,
        is_active: true,
      },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        sort_order: true,
        _count: { select: { tables: true } },
      },
    });

    return NextResponse.json(zones);
  } catch (error) {
    logger.error('Error fetching POS zones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al obtener zonas' }, { status: 500 });
  }
}
