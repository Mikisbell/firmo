/**
 * Admin Feedback API
 * GET /api/admin/feedback
 *
 * Returns paginated customer feedback for the tenant.
 * Supports filter by type and date range.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('admin-feedback');

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const tenantId = authResult.user.tenantId;

  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (type && ['QUEJA', 'SUGERENCIA', 'ELOGIO'].includes(type)) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      prisma.customer_feedback.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          type: true,
          message: true,
          customer_name: true,
          rating: true,
          table_number: true,
          created_at: true,
        },
      }),
      prisma.customer_feedback.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    logger.error('Error fetching feedback', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Error al obtener opiniones' }, { status: 500 });
  }
}
