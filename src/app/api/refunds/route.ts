/**
 * Refunds API - List Refunds
 * 
 * GET /api/refunds
 * 
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - order_id: Filter by order ID
 * - status: Filter by refund status
 * 
 * Returns all refunds for the current tenant
 * Supports filtering by order_id, status, date range
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

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
    
    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Parse filter parameters
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');
    const status = searchParams.get('status');

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

    // Get total count
    const total = await prisma.refunds.count({ where });

    // Get refunds with pagination
    const refunds = await prisma.refunds.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      skip: params.skip,
      take: params.limit,
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

    pinoLogger.info({
      count: refunds.length,
      total,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Refunds listed');

    // Transform refunds data
    const transformedRefunds = refunds.map(refund => ({
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
    }));

    // Return standardized paginated response
    const response = createPaginatedResponse(transformedRefunds, total, params);

    return NextResponse.json({
      success: true,
      ...response,
      // Maintain backward compatibility with 'refunds' key
      refunds: response.items,
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error listing refunds');
    return NextResponse.json(
      { error: 'Failed to list refunds' },
      { status: 500 }
    );
  }
}
