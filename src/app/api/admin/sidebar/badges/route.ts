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

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get audit events count (last 24 hours, high severity)
    let auditoriaCount = 0;
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      auditoriaCount = await prisma.admin_access_logs.count({
        where: {
          created_at: { gte: oneDayAgo },
          action: { in: ['DELETE', 'UPDATE'] }, // High-impact actions
        },
      });
    } catch (error) {
      console.debug('Failed to fetch audit count:', error);
    }

    // Get delivery orders count (pending assignment)
    let deliveryCount = 0;
    try {
      deliveryCount = await prisma.delivery_orders.count({
        where: {
          status: 'PENDING',
          driver_id: null,
        },
      });
    } catch (error) {
      console.debug('Failed to fetch delivery count:', error);
    }

    return NextResponse.json({
      auditoria: auditoriaCount,
      delivery: deliveryCount,
    });
  } catch (error) {
    console.error('Sidebar badges error:', error instanceof Error ? error.message : String(error));
    // Return zeros on error - non-critical
    return NextResponse.json({
      auditoria: 0,
      delivery: 0,
    });
  }
}
