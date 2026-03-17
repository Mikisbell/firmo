/**
 * Admin CRM Templates API
 * GET /api/admin/crm/templates - List templates
 * POST /api/admin/crm/templates - Create template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TemplateService } from '@/src/core/services/template.service';
import { CreateTemplateSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const channel = request.nextUrl.searchParams.get('channel') ?? undefined;

  try {
    const service = new TemplateService();
    const templates = await service.list(authResult.user.tenantId, channel);
    return NextResponse.json({ data: templates });
  } catch {
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const validated = CreateTemplateSchema.parse(body);

    const service = new TemplateService();
    const result = await service.create(authResult.user.tenantId, validated);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 });
  }
}
