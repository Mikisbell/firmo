/**
 * Course Management API
 *
 * GET  - Get course status for an order
 * POST - Assign course to items
 *
 * @module app/api/admin/orders/[id]/courses/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { CourseFireService } from '@/src/core/services/course-fire.service';
import prisma from '@/src/core/db/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  const service = new CourseFireService(prisma);
  const result = await service.getCourseStatus(authResult.user.tenantId, id);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 404 });
  }

  return NextResponse.json(result.data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;

  let body: { lineIds?: string[]; course?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.lineIds || !Array.isArray(body.lineIds) || body.lineIds.length === 0) {
    return NextResponse.json({ error: 'lineIds requerido (array)' }, { status: 400 });
  }
  if (!body.course || typeof body.course !== 'number' || body.course < 1) {
    return NextResponse.json({ error: 'course requerido (entero positivo)' }, { status: 400 });
  }

  const service = new CourseFireService(prisma);
  const result = await service.assignCourse(
    authResult.user.tenantId,
    id,
    body.lineIds,
    body.course,
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data);
}
