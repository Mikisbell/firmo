/**
 * Admin CRM Template Detail API
 * GET/PUT/DELETE /api/admin/crm/templates/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TemplateService } from '@/src/core/services/template.service';
import { UpdateTemplateSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const service = new TemplateService();
    const result = await service.getById(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Error al obtener plantilla' }, { status: 500 });
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
    const validated = UpdateTemplateSchema.parse(body);

    const service = new TemplateService();
    const result = await service.update(authResult.user.tenantId, id, validated);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 });
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
    const service = new TemplateService();
    const result = await service.delete(authResult.user.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 });
  }
}
