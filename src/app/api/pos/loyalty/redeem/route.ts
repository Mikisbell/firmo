/**
 * POS Loyalty Redeem API
 * POST /api/pos/loyalty/redeem - Redeem loyalty points for discount
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { LoyaltyService } from '@/src/core/services/loyalty.service';
import { RedeemPointsSchema } from '@/src/core/admin/schemas/loyalty.schema';
import { withTransaction } from '@/src/core/db/transaction';
import prisma from '@/src/core/db/prisma';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const validated = RedeemPointsSchema.parse(body);

    const service = new LoyaltyService();
    const txResult = await withTransaction(prisma, async (tx) => {
      return service.redeemPoints(tx, {
        tenantId: authResult.user.tenantId,
        customerId: validated.customerId,
        points: validated.pointsToRedeem,
        orderId: validated.orderId,
        checkId: validated.checkId,
        actorId: authResult.user.id,
      });
    });

    if (!txResult.success) {
      return NextResponse.json({ error: txResult.error.message }, { status: 500 });
    }

    const result = txResult.data;
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos de canje inválidos', details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: 'Error al canjear puntos' },
      { status: 500 },
    );
  }
}
