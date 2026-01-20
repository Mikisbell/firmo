/**
 * Dashboard Stats API
 * Returns real-time metrics for admin dashboard
 * 
 * Requirements: 2.2, 2.3
 */

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getBusinessDate } from '@/src/core/utils/business-date';

export interface DashboardStats {
  salesToday: number;        // In centavos
  activeOrders: number;
  terminalsOnline: number;
  totalProducts: number;
  lastUpdated: string;
}

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    // Check if database is available
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      // Return default stats if DB is not available
      return NextResponse.json({
        salesToday: 0,
        activeOrders: 0,
        terminalsOnline: 0,
        totalProducts: 0,
        lastUpdated: new Date().toISOString(),
      });
    }
    
    const businessDate = getBusinessDate(new Date());
    
    // Get today's sales (completed orders)
    const salesResult = await prisma.orders.aggregate({
      where: {
        tenant_id: tenantId,
        business_date: new Date(businessDate),
        order_status: 'CONFIRMED',
      },
      _sum: {
        total_cents: true,
      },
    }).catch(() => ({ _sum: { total_cents: 0 } }));
    
    // Get active orders (not done, not cancelled)
    const activeOrders = await prisma.orders.count({
      where: {
        tenant_id: tenantId,
        order_status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      },
    }).catch(() => 0);
    
    // Get terminals online (seen in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const terminalsOnline = await prisma.terminals.count({
      where: {
        tenant_id: tenantId,
        is_allowed: true,
        last_seen_at: {
          gte: fiveMinutesAgo,
        },
      },
    }).catch(() => 0);
    
    // Get total active products
    const totalProducts = await prisma.products.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    }).catch(() => 0);
    
    const stats: DashboardStats = {
      salesToday: salesResult._sum?.total_cents || 0,
      activeOrders,
      terminalsOnline,
      totalProducts,
      lastUpdated: new Date().toISOString(),
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del dashboard' },
      { status: 500 }
    );
  }
}
