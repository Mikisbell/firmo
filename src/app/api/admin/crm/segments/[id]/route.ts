/**
 * Admin CRM Segment Detail API
 * GET/PUT/DELETE /api/admin/crm/segments/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { SegmentService } from '@/src/core/services/segment.service';
import { UpdateSegmentSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new SegmentService();
    const result = await service.getById(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Error al obtener segmento' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const validated = UpdateSegmentSchema.parse(body);

    const service = new SegmentService();
    const result = await service.update(authResult.user.tenantId, id, validated);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar segmento' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new SegmentService();
    const result = await service.delete(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar segmento' }, { status: 500 });
  }
}
