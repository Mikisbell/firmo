/**
 * POS Tables API - GET (read-only, public within origin)
 * Table layout is non-sensitive data required by the waiter terminal before
 * a JWT session is established. Auth is handled at the terminal config level.
 * Tenant is resolved from the x-tenant-id header sent by the POS client.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';
import { getCachedData, setCachedData } from '@/src/workers/kv';

const logger = createLogger('pos-tables');

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

    const { searchParams } = request.nextUrl;
    const activeOnly = searchParams.get('active') === 'true';

    // KV Cache Key
    const cacheKey = `kv_pos_tables_${tenantId}_${locationId}_${activeOnly}`;

    // Try Edge KV first
    const cachedTables = await getCachedData<any[]>(cacheKey);
    if (cachedTables) {
      logger.info('POS Tables retrieved from Edge KV', { operation: 'list_tables_kv_hit', cacheKey });
      return NextResponse.json(cachedTables);
    }

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

    // Save to Edge KV (expire in 1 hour)
    await setCachedData(cacheKey, tables, 3600);
    logger.info('POS Tables retrieved from DB and cached in KV', { operation: 'list_tables_kv_miss', cacheKey });

    return NextResponse.json(tables);
  } catch (error) {
    logger.error('Error fetching POS tables', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al obtener mesas' }, { status: 500 });
  }
}
