/**
 * POS Shifts API - GET
 *
 * Returns active shift, shift summary, or shift history.
 * ?action=active|summary|history&terminalId=X&shiftId=Y
 *
 * @module app/api/pos/shifts/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { ShiftService } from '@/src/core/services/shift.service';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const action = request.nextUrl.searchParams.get('action') || 'active';
  const terminalId = request.nextUrl.searchParams.get('terminalId') || (authResult.user as any).terminalId || '';
  const shiftId = request.nextUrl.searchParams.get('shiftId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10', 10);

  const service = new ShiftService(prisma);
  const tenantId = authResult.user.tenantId;

  switch (action) {
    case 'active': {
      if (!terminalId) {
        return NextResponse.json({ error: 'terminalId es requerido' }, { status: 400 });
      }
      const result = await service.getActiveShift(tenantId, terminalId);
      if (!result.success) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
      }
      return NextResponse.json({ shift: result.data });
    }

    case 'summary': {
      if (!shiftId) {
        return NextResponse.json({ error: 'shiftId es requerido para summary' }, { status: 400 });
      }
      const result = await service.getShiftSummary(tenantId, shiftId);
      if (!result.success) {
        return NextResponse.json({ error: result.error.message }, { status: 404 });
      }
      return NextResponse.json(result.data);
    }

    case 'history': {
      if (!terminalId) {
        return NextResponse.json({ error: 'terminalId es requerido' }, { status: 400 });
      }
      const result = await service.getShiftHistory(tenantId, terminalId, limit);
      if (!result.success) {
        return NextResponse.json({ error: result.error.message }, { status: 400 });
      }
      return NextResponse.json({ shifts: result.data });
    }

    default:
      return NextResponse.json(
        { error: 'action inválido (active, summary, history)' },
        { status: 400 },
      );
  }
}
