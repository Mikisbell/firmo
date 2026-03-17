/**
 * Admin CRM Template Preview API
 * POST /api/admin/crm/templates/[id]/preview - Preview with sample variables
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { TemplateService } from '@/src/core/services/template.service';
import { PreviewTemplateSchema } from '@/src/core/admin/schemas/crm.schema';
import { ZodError } from 'zod';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { variables } = PreviewTemplateSchema.parse(body);

    const service = new TemplateService();
    const result = await service.preview(authResult.user.tenantId, id, variables);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 404 });
    }

    return NextResponse.json({ preview: result.data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al previsualizar' }, { status: 500 });
  }
}
