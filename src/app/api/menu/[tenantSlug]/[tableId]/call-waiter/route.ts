/**
 * Call Waiter API - POST (public, no auth)
 *
 * Customer presses "Call Waiter" on the digital menu.
 * Rate limited: max 1 call per 2 minutes per table.
 *
 * @module app/api/menu/[tenantSlug]/[tableId]/call-waiter/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

// Simple in-memory rate limit (per table)
const lastCallMap = new Map<string, number>();
const RATE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes

interface RouteContext {
  params: Promise<{ tenantSlug: string; tableId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, tableId } = await context.params;

    // Rate limit check
    const rateKey = `${tenantSlug}:${tableId}`;
    const lastCall = lastCallMap.get(rateKey);
    const now = Date.now();

    if (lastCall && now - lastCall < RATE_LIMIT_MS) {
      const remainingSecs = Math.ceil((RATE_LIMIT_MS - (now - lastCall)) / 1000);
      return NextResponse.json(
        { error: `Espere ${remainingSecs} segundos antes de volver a llamar al mozo` },
        { status: 429 },
      );
    }

    // Resolve tenant
    const tenant = await prisma.tenants.findFirst({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    // Verify table
    const table = await prisma.tables.findFirst({
      where: { id: tableId, tenant_id: tenant.id, is_active: true },
      select: { id: true, number: true, display_name: true, zone_id: true },
    });

    if (!table) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    // Record the call for rate limiting
    lastCallMap.set(rateKey, now);

    // Clean old entries periodically (every 100 calls)
    if (lastCallMap.size > 1000) {
      for (const [key, ts] of lastCallMap) {
        if (now - ts > RATE_LIMIT_MS) lastCallMap.delete(key);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Mozo notificado para mesa ${table.display_name ?? table.number}`,
    });
  } catch {
    return NextResponse.json({ error: 'Error al llamar al mozo' }, { status: 500 });
  }
}
