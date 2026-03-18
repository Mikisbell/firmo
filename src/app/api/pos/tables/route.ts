/**
 * POS Tables API - GET (read-only)
 * Permite a cualquier empleado autenticado (mozo, cajero, cocina, etc.)
 * leer las mesas del restaurante sin necesitar rol ADMIN.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { createLogger } from '@/src/core/observability/logger';

const logger = createLogger('pos-tables');

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const loc = await prisma.locations.findFirst({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    });
    if (!loc) return NextResponse.json([], { status: 200 });
    const locationId = loc.id;

    const { searchParams } = request.nextUrl;
    const activeOnly = searchParams.get('active') === 'true';

    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      location_id: locationId,
    };
    if (activeOnly) {
      where.is_active = true;
    }

    const rows = await prisma.tables.findMany({
      where,
      orderBy: { number: 'asc' },
      select: {
        id: true,
        number: true,
        display_name: true,
        is_active: true,
        zones: {
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
          },
        },
      },
    });

    // Rename Prisma relation 'zones' → 'zone' to match what the mozo hook expects
    const tables = rows.map(({ zones, ...rest }) => ({
      ...rest,
      zone: zones ?? null,
    }));

    return NextResponse.json(tables);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching POS tables');
    return NextResponse.json({ error: 'Error al obtener mesas' }, { status: 500 });
  }
}
