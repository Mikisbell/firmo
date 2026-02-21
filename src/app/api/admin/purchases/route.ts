/**
 * Admin Purchases API - GET / POST
 *
 * GET: Lists purchase orders with optional filters.
 * POST: Creates a new purchase order.
 *
 * @module app/api/admin/purchases/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PurchasesService } from '@/src/core/services/purchases.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const CreatePOSchema = z.object({
  locationId: z.string().uuid(),
  supplierId: z.string().uuid(),
  items: z.array(z.object({
    inventoryCode: z.string().min(1),
    quantityOrdered: z.number().positive(),
    unit: z.string().min(1),
    unitCostCents: z.number().int().min(0),
  })).min(1),
  expectedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'locationId requerido' }, { status: 400 });
  }

  const status = request.nextUrl.searchParams.get('status') as any;
  const supplierId = request.nextUrl.searchParams.get('supplierId') ?? undefined;

  const service = new PurchasesService(prisma);
  const result = await service.getPurchaseOrders(
    authResult.user.tenantId,
    locationId,
    { status: status || undefined, supplierId },
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ orders: result.data });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const data = CreatePOSchema.parse(body);

    const service = new PurchasesService(prisma);
    const result = await service.createPurchaseOrder({
      tenantId: authResult.user.tenantId,
      ...data,
      createdBy: authResult.user.id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
