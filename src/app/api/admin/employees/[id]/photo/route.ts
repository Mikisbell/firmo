/**
 * Employee Photo Upload API
 * POST /api/admin/employees/[id]/photo — Upload profile photo (base64 data URL)
 * DELETE /api/admin/employees/[id]/photo — Remove profile photo
 *
 * Stores as base64 data URL in profile_photo_url column.
 * Future: migrate to S3/Cloudinary for production scale.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createRequestLogger, logAudit } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = randomUUID();
  const log = createRequestLogger(requestId);

  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const tenantId = authResult.user.tenantId;

    // Verify employee belongs to this tenant
    const employee = await prisma.employees.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true, name: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se envio ninguna imagen' },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido. Acepta: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'La imagen excede el limite de 5 MB' },
        { status: 400 },
      );
    }

    // Convert to base64 data URL
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Update employee
    await prisma.employees.update({
      where: { id },
      data: { profile_photo_url: dataUrl },
    });

    // Invalidate caches
    await cache.deleteByTag('employees');
    await cache.deleteByTag('team');

    // Audit log
    logAudit('UPDATE', 'employees', authResult.user.id, {
      employeeId: id,
      action: 'photo_upload',
      fileType: file.type,
      fileSize: file.size,
      tenantId,
    });

    log.info({
      operation: 'upload_employee_photo',
      employeeId: id,
      fileSize: file.size,
      tenantId,
    }, 'Employee photo uploaded');

    return NextResponse.json({ url: dataUrl });
  } catch (error) {
    log.error({
      operation: 'upload_employee_photo_error',
      employeeId: id,
      error: error instanceof Error
        ? { name: error.name, message: error.message }
        : String(error),
    }, 'Failed to upload employee photo');

    return NextResponse.json(
      { error: 'Error al subir la foto' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = randomUUID();
  const log = createRequestLogger(requestId);

  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const tenantId = authResult.user.tenantId;

    // Verify employee belongs to this tenant
    const employee = await prisma.employees.findFirst({
      where: { id, tenant_id: tenantId },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 },
      );
    }

    // Clear photo
    await prisma.employees.update({
      where: { id },
      data: { profile_photo_url: null },
    });

    // Invalidate caches
    await cache.deleteByTag('employees');
    await cache.deleteByTag('team');

    logAudit('UPDATE', 'employees', authResult.user.id, {
      employeeId: id,
      action: 'photo_delete',
      tenantId,
    });

    log.info({
      operation: 'delete_employee_photo',
      employeeId: id,
      tenantId,
    }, 'Employee photo deleted');

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({
      operation: 'delete_employee_photo_error',
      employeeId: id,
      error: error instanceof Error
        ? { name: error.name, message: error.message }
        : String(error),
    }, 'Failed to delete employee photo');

    return NextResponse.json(
      { error: 'Error al eliminar la foto' },
      { status: 500 },
    );
  }
}

