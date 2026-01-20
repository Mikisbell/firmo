/**
 * GET /api/admin/analytics/history
 * Returns historical metrics for a date range
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import type { RealtimeMetrics } from '@/src/core/analytics/types';
import { asCentavos, type PaymentMethod, type Centavos } from '@/src/core/types/shared';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Faltan parámetros de fecha from/to' },
        { status: 400 }
      );
    }

    // Validate date format
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'La fecha from debe ser anterior a la fecha to' },
        { status: 400 }
      );
    }

    // Limit range to 90 days
    const daysDiff = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: 'El rango de fechas no puede exceder 90 días' },
        { status: 400 }
      );
    }

    // Get daily summaries if available, otherwise calculate from orders
    const summaries = await prisma.daily_sales_summary.findMany({
      where: {
        tenant_id: tenantId,
        business_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { business_date: 'asc' },
    });

    // Convert to RealtimeMetrics format
    const metrics: Partial<RealtimeMetrics>[] = summaries.map(s => ({
      total_sales_cents: asCentavos(s.net_sales_cents),
      orders_count: s.orders_count,
      avg_ticket_cents: asCentavos(s.orders_count > 0 
        ? Math.round(s.net_sales_cents / s.orders_count) 
        : 0),
      sales_by_payment_method: (s.payments_breakdown as Record<PaymentMethod, Centavos>) || {
        CASH: asCentavos(0), YAPE: asCentavos(0), PLIN: asCentavos(0), CARD: asCentavos(0), TRANSFER: asCentavos(0),
      },
      business_date: s.business_date.toISOString().split('T')[0],
      last_updated: s.created_at.toISOString(),
    }));

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Analytics history error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
