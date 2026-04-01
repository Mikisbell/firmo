/**
 * GET /api/pos/ready-items
 *
 * Returns all order items with status = 'READY' for the tenant,
 * created within the last 2 hours.
 *
 * Auth: x-tenant-id header (no JWT — called by the waiter terminal before session).
 * Used by /mozo/listos to render one notification card per item.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('pos-ready-items');

export interface ReadyItemRow {
  id: string;
  order_id: string;
  line_id: string;
  table_number: string | null;
  name: string;
  qty: number;
  station: string;
  status: string;
  notes: string | null;
  ready_at: string;
}

export async function GET(request: NextRequest) {
  const tenantId =
    request.headers.get('x-tenant-id') ||
    request.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    return NextResponse.json({ error: 'x-tenant-id requerido' }, { status: 400 });
  }

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const rows = await prisma.$queryRaw<ReadyItemRow[]>`
      SELECT
        id::text,
        order_id::text,
        line_id,
        table_number,
        name,
        qty,
        station,
        status,
        notes,
        ready_at::text AS ready_at
      FROM order_item_projections
      WHERE tenant_id    = ${tenantId}::uuid
        AND status       = 'READY'
        AND ready_at    >= ${twoHoursAgo}
      ORDER BY ready_at ASC
    `;

    return NextResponse.json(rows);
  } catch (error) {
    logger.error(
      'Error fetching ready items',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al obtener items listos' }, { status: 500 });
  }
}
