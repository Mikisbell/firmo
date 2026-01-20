/**
 * Promotions API - GET and POST
 * Requirements: 6.2, 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

const promotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO']),
  value: z.number().min(0),
  rules: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const now = new Date();
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Parse filter parameters
    const isActiveParam = request.nextUrl.searchParams.get('is_active');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;
    
    // Auto-deactivate expired promotions
    await prisma.promotions.updateMany({
      where: {
        tenant_id: tenantId,
        ends_at: { lt: now },
        is_active: true,
      },
      data: { is_active: false },
    });
    
    // Build where clause
    const where: any = { tenant_id: tenantId };
    if (isActive !== undefined) {
      where.is_active = isActive;
    }
    
    // Get total count
    const total = await prisma.promotions.count({ where });
    
    // Get paginated promotions
    const promotions = await prisma.promotions.findMany({
      where,
      orderBy: { starts_at: 'desc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        starts_at: true,
        ends_at: true,
        is_active: true,
      },
    });
    
    return NextResponse.json(createPaginatedResponse(promotions, total, params));
  } catch (error) {
    console.error('Promotions GET error:', error);
    return NextResponse.json({ error: 'Error al obtener promociones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    const parsed = promotionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
    }
    
    const data = parsed.data;
    
    // Create promotion in transaction with audit trail
    const promotion = await prisma.$transaction(async (tx) => {
      const newPromotion = await tx.promotions.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
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
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'promotions',
          metadata: { record_id: newPromotion.id },
          created_at: new Date(),
        },
      });

      return newPromotion;
    });
    
    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    console.error('Promotions POST error:', error);
    return NextResponse.json({ error: 'Error al crear promoción' }, { status: 500 });
  }
}
