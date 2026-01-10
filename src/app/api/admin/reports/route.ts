/**
 * Sales Reports API
 * Requirements: 9.2, 9.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default: // daily
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    // Get orders in period
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: startDate },
        order_status: 'CONFIRMED',
      },
      select: {
        total_cents: true,
        discount_cents: true,
        checks: true,
      },
    });
    
    // Calculate totals
    let salesNet = 0;
    let discounts = 0;
    let tips = 0;
    const paymentTotals: Record<string, number> = {};
    
    for (const order of orders) {
      salesNet += order.total_cents;
      discounts += order.discount_cents;
      
      // Parse checks for payment methods and tips
      const checks = order.checks as Array<{ payments?: Array<{ method: string; amount_cents: number }>; tip_cents?: number }>;
      if (Array.isArray(checks)) {
        for (const check of checks) {
          tips += check.tip_cents || 0;
          if (check.payments) {
            for (const payment of check.payments) {
              paymentTotals[payment.method] = (paymentTotals[payment.method] || 0) + payment.amount_cents;
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      period,
      sales_net: salesNet,
      discounts,
      tips,
      order_count: orders.length,
      by_payment_method: Object.entries(paymentTotals).map(([method, total]) => ({ method, total })),
    });
  } catch (error) {
    console.error('Reports GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
