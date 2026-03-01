/**
 * POS Z-Reports API
 *
 * POST - Generate Z or X report for a shift
 * GET  - Retrieve reports by terminal or shift
 *
 * @module app/api/pos/z-reports/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { ZReportService } from '@/src/core/services/z-report.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;
  const actorId = authResult.user.id;

  let body: { shiftId?: string; reportType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { shiftId, reportType } = body;

  if (!shiftId || typeof shiftId !== 'string') {
    return NextResponse.json({ error: 'shiftId es requerido' }, { status: 400 });
  }

  const type = (reportType === 'X' ? 'X' : 'Z') as 'Z' | 'X';

  const service = new ZReportService(prisma);
  const result = await service.generateReport(tenantId, shiftId, type, actorId);

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
  const terminalId = request.nextUrl.searchParams.get('terminalId');
  const shiftId = request.nextUrl.searchParams.get('shiftId');
  const reportId = request.nextUrl.searchParams.get('reportId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);

  const service = new ZReportService(prisma);

  // Get specific report by ID
  if (reportId) {
    const result = await service.getReport(tenantId, reportId);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }
    return NextResponse.json(result.data);
  }

  // Get report by shift
  if (shiftId) {
    const reportType = request.nextUrl.searchParams.get('reportType') as 'Z' | 'X' | null;
    const result = await service.getReportByShift(tenantId, shiftId, reportType ?? undefined);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ report: result.data });
  }

  // Get reports by terminal
  if (terminalId) {
    const result = await service.getReportsByTerminal(tenantId, terminalId, limit);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ reports: result.data });
  }

  return NextResponse.json(
    { error: 'Se requiere terminalId, shiftId, o reportId' },
    { status: 400 },
  );
}
