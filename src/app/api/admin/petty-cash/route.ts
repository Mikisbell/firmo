/**
 * Admin Petty Cash API - GET / POST
 *
 * GET: Returns balance + transactions for a location.
 * POST: Records a new transaction.
 *
 * @module app/api/admin/petty-cash/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PettyCashService } from '@/src/core/services/petty-cash.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const TransactionSchema = z.object({
  locationId: z.string().uuid(),
  shiftId: z.string().uuid(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().int().positive(),
  category: z.enum(['SUPPLIES', 'TRANSPORT', 'FOOD', 'CLEANING', 'MAINTENANCE', 'OTHER']),
  description: z.string().min(1),
  receiptPhotoUrl: z.string().url().optional(),
  receiptNumber: z.string().optional(),
  supplierName: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const locationId = request.nextUrl.searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'locationId requerido' }, { status: 400 });
  }

  const service = new PettyCashService(prisma);
  const [balanceResult, txResult] = await Promise.all([
    service.getBalance(authResult.user.tenantId, locationId),
    service.getTransactions(authResult.user.tenantId, locationId),
  ]);

  if (!balanceResult.success) {
    return NextResponse.json({ error: balanceResult.error.message }, { status: 404 });
  }

  return NextResponse.json({
    balance: balanceResult.data,
    transactions: txResult.success ? txResult.data : [],
  });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const data = TransactionSchema.parse(body);

    const service = new PettyCashService(prisma);
    const result = await service.recordTransaction({
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
