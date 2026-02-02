/**
 * Refunds API - List Refunds
 * 
 * GET /api/refunds
 * 
 * Returns all refunds for the current tenant
 * Supports filtering by order_id, status, date range
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = getTenantId();
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (orderId) {
      where.order_id = orderId;
    }

    if (status) {
      where.status = status;
    }

    // Get refunds
    const refunds = await prisma.refunds.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        credit_notes: {
          select: {
            id: true,
            number: true,
            series: true,
            status: true,
          },
        },
      },
    });

    // Get total count
    const total = await prisma.refunds.count({ where });

    pinoLogger.info({
      count: refunds.length,
      total,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Refunds listed');

    return NextResponse.json({
      success: true,
      refunds: refunds.map(refund => ({
        id: refund.id,
        order_id: refund.order_id,
        check_id: refund.check_id,
        invoice_id: refund.invoice_id,
        type: refund.type,
        status: refund.status,
        reason_code: refund.reason_code,
        reason_detail: refund.reason_detail,
        original_amount: refund.original_amount,
        refund_amount: refund.refund_amount,
        refund_method: refund.refund_method,
        items: refund.items as any,
        credit_note: refund.credit_notes,
        created_at: refund.created_at.toISOString(),
        issued_at: refund.issued_at?.toISOString(),
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + refunds.length < total,
      },
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error listing refunds');
    return NextResponse.json(
      { error: 'Failed to list refunds' },
      { status: 500 }
    );
  }
}
