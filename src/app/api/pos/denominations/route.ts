/**
 * POS Denominations API
 *
 * POST - Save denomination counts for a shift close
 * GET  - Retrieve denomination counts for a shift
 *
 * @module app/api/pos/denominations/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { DenominationService } from '@/src/core/services/denomination.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  let body: { shiftId?: string; counts?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { shiftId, counts } = body;

  if (!shiftId || typeof shiftId !== 'string') {
    return NextResponse.json({ error: 'shiftId es requerido' }, { status: 400 });
  }

  if (!counts || typeof counts !== 'object') {
    return NextResponse.json({ error: 'counts es requerido (objeto face→cantidad)' }, { status: 400 });
  }

  // Convert string keys to numbers
  const numericCounts: Record<number, number> = {};
  for (const [key, val] of Object.entries(counts)) {
    const face = Number(key);
    const qty = Number(val);
    if (isNaN(face) || isNaN(qty)) continue;
    numericCounts[face] = qty;
  }

  const service = new DenominationService(prisma);
  const result = await service.saveCounts(tenantId, shiftId, numericCounts);

  if (!result.success) {
    const status = result.error.code === 'NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.data);
}

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const shiftId = request.nextUrl.searchParams.get('shiftId');

  if (!shiftId) {
    return NextResponse.json({ error: 'shiftId es requerido' }, { status: 400 });
  }

  const service = new DenominationService(prisma);
  const result = await service.getCounts(tenantId, shiftId);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
