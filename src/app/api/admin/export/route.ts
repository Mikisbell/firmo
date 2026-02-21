/**
 * Universal Export API - GET
 *
 * Export any entity in xlsx, csv, or pdf format.
 * ?entity=ventas&format=xlsx&start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * @module app/api/admin/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { UniversalExportService } from '@/src/core/services/universal-export.service';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const entity = request.nextUrl.searchParams.get('entity');
  const format = request.nextUrl.searchParams.get('format') || 'xlsx';
  const start = request.nextUrl.searchParams.get('start') || undefined;
  const end = request.nextUrl.searchParams.get('end') || undefined;
  const status = request.nextUrl.searchParams.get('status') || undefined;

  if (!entity) {
    return NextResponse.json({ error: 'entity es requerido' }, { status: 400 });
  }

  const validFormats = ['xlsx', 'csv', 'pdf'];
  if (!validFormats.includes(format)) {
    return NextResponse.json({ error: 'format inválido (xlsx, csv, pdf)' }, { status: 400 });
  }

  const service = new UniversalExportService(prisma);
  const result = await service.exportEntity(
    authResult.user.tenantId,
    entity,
    format as any,
    { start, end, status },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return new Response(new Uint8Array(result.data.buffer), {
    status: 200,
    headers: {
      'Content-Type': result.data.contentType,
      'Content-Disposition': `attachment; filename="${result.data.filename}"`,
    },
  });
}
