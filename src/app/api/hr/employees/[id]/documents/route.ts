/**
 * HR Employee Documents API - POST
 *
 * Delegates to EmployeeService.uploadDocument().
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { EmployeeService } from '@/src/core/services/employee.service';
import { z } from 'zod';
import { logger } from '@/src/core/observability/structured-logger';

const service = new EmployeeService(prisma);

type RouteContext = { params: Promise<{ id: string }> };

const UploadDocumentBody = z.object({
  document_type: z.enum([
    'CONTRACT',
    'CERTIFICATE',
    'BACKGROUND_CHECK',
    'ID_COPY',
    'MEDICAL_CERTIFICATE',
    'OTHER',
  ]),
  document_url: z.string().url(),
  expiry_date: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function POST(request: NextRequest, { params }: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;
  const tenantId = authResult.user.tenantId;
  const { id: employeeId } = await params;

  try {
    const body = await request.json();
    const parsed = UploadDocumentBody.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await service.uploadDocument(tenantId, employeeId, {
      document_type: parsed.data.document_type as any,
      document_url: parsed.data.document_url,
      expiry_date: parsed.data.expiry_date ? new Date(parsed.data.expiry_date) : null,
      notes: parsed.data.notes ?? null,
      uploaded_by: authResult.user.id,
    });

    if (!result.success) {
      const status =
        result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'VALIDATION_ERROR' ? 400
        : 500;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    logger.error('Error al subir documento de empleado', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al subir documento' },
      { status: 500 },
    );
  }
}
