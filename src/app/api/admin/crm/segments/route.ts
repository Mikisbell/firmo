/**
 * Admin CRM Segments API
 * GET /api/admin/crm/segments - List segments
 * POST /api/admin/crm/segments - Create segment
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { SegmentService } from '@/src/core/services/segment.service';
import { CreateSegmentSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const service = new SegmentService();
    const segments = await service.list(authResult.user.tenantId);
    return NextResponse.json({ data: segments });
  } catch {
    return NextResponse.json({ error: 'Error al obtener segmentos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const validated = CreateSegmentSchema.parse(body);

    const service = new SegmentService();
    const result = await service.create(authResult.user.tenantId, validated, authResult.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear segmento' }, { status: 500 });
  }
}
