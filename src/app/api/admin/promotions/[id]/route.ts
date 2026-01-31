/**
 * Promotions API - GET, PUT, DELETE by ID
 * Requirements: 3.3, 3.4, 3.6, 10.8, 10.9
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

const promotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO']),
  value: z.number().min(0),
  rules: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  is_active: z.boolean().default(true),
}).refine(data => new Date(data.starts_at) < new Date(data.ends_at), {
  message: 'La fecha de inicio debe ser anterior a la fecha de fin',
  path: ['starts_at'],
});

// GET - Fetch single promotion
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promotion = await prisma.promotions.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
      },
    });

    if (!promotion) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json(promotion);
  } catch (error) {
    console.error('Promotion GET error:', error);
    return NextResponse.json(
      { error: 'Error al obtener promoción' },
      { status: 500 }
    );
  }
}

// PUT - Update promotion
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate input
    const parsed = promotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check promotion exists
    const existing = await prisma.promotions.findFirst({
      where: { id, tenant_id: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      );
    }

    // Update promotion in transaction with audit trail
    const promotion = await prisma.$transaction(async (tx) => {
      const updated = await tx.promotions.update({
        where: { id },
        data: {
          name: data.name,
          type: data.type,
          value: data.value,
          rules: data.rules ? JSON.parse(JSON.stringify(data.rules)) : {},
          starts_at: new Date(data.starts_at),
          ends_at: new Date(data.ends_at),
          is_active: data.is_active,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'promotions',
          metadata: {
            record_id: id,
            changes: JSON.parse(JSON.stringify(data)),
          },
          created_at: new Date(),
        },
      });

      return updated;
    });

    return NextResponse.json(promotion);
  } catch (error) {
    console.error('Promotion PUT error:', error);
    return NextResponse.json(
      { error: 'Error al actualizar promoción' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete promotion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { id } = await params;
    // Check promotion exists
    const existing = await prisma.promotions.findFirst({
      where: { id, tenant_id: TENANT_ID },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Promoción no encontrada' },
        { status: 404 }
      );
    }

    // Soft delete in transaction with audit trail
    await prisma.$transaction(async (tx) => {
      await tx.promotions.update({
        where: { id },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'promotions',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Promotion DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar promoción' },
      { status: 500 }
    );
  }
}
