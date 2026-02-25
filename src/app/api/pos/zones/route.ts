/**
 * POS Zones API - GET (read-only)
 * Permite a cualquier empleado autenticado leer las zonas del restaurante
 * sin necesitar rol ADMIN.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { getLocationId } from '@/src/core/config/location';

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const locationId = getLocationId();

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
}
