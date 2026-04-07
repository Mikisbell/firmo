/**
 * Request Check (Bill) API - POST (public, no auth)
 *
 * Customer presses "Pedir la Cuenta" on the digital menu.
 * Rate limited: max 1 call per 5 minutes per table.
 *
 * @module app/api/menu/[tenantSlug]/[tableId]/request-check/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

// Simple in-memory rate limit (per table)
const lastRequestMap = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

interface RouteContext {
  params: Promise<{ tenantSlug: string; tableId: string }>;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, tableId } = await context.params;

    // Rate limit check
    const rateKey = `${tenantSlug}:${tableId}`;
    const lastRequest = lastRequestMap.get(rateKey);
    const now = Date.now();

    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
      const remainingSecs = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
      return NextResponse.json(
        { error: `Ya solicitaste la cuenta. Espera ${remainingSecs} segundos.` },
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
      select: { id: true, number: true, display_name: true },
    });

    if (!table) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    // Record the request for rate limiting
    lastRequestMap.set(rateKey, now);

    // Clean old entries periodically
    if (lastRequestMap.size > 1000) {
      for (const [key, ts] of lastRequestMap) {
        if (now - ts > RATE_LIMIT_MS) lastRequestMap.delete(key);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cuenta solicitada. Tu mozo la preparara.',
    });
  } catch {
    return NextResponse.json({ error: 'Error al solicitar la cuenta' }, { status: 500 });
  }
}
