/**
 * Sidebar Badges API
 * Retorna contadores para badges del sidebar
 * 
 * GET /api/admin/sidebar/badges
 * Returns: { auditoria: number, delivery: number }
 * 
 * Requirements: P0 - Sidebar Improvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Get audit events count (last 24 hours, high severity)
    let auditoriaCount = 0;
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      auditoriaCount = await prisma.admin_access_logs.count({
        where: {
          tenant_id: session.tenantId,
          created_at: { gte: oneDayAgo },
          action: { in: ['DELETE', 'UPDATE'] }, // High-impact actions
        },
      });
    } catch (error) {
      logger.debug('Error al obtener conteo de auditorias', { error: String(error) });
    }

    // Get delivery orders count (pending assignment)
    let deliveryCount = 0;
    try {
      deliveryCount = await prisma.delivery_orders.count({
        where: {
          tenant_id: session.tenantId,
          status: 'PENDING',
          driver_id: null,
        },
      });
    } catch (error) {
      logger.debug('Error al obtener conteo de delivery', { error: String(error) });
    }

    return NextResponse.json({
      auditoria: auditoriaCount,
      delivery: deliveryCount,
    });
  } catch (error) {
    logger.error('Error al obtener badges del sidebar', error instanceof Error ? error : new Error(String(error)));
    // Return zeros on error - non-critical
    return NextResponse.json({
      auditoria: 0,
      delivery: 0,
    });
  }
}
