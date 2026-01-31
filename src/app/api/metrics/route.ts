/**
 * Metrics Endpoint
 * Exposes Prometheus-compatible metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/src/core/observability/metrics';

/**
 * GET /api/metrics
 * Returns metrics in Prometheus format
 */
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'prometheus';
    
    if (format === 'json') {
      // Return JSON format
      const metricsData = metrics.getMetricsJSON();
      return NextResponse.json(metricsData);
    } else {
      // Return Prometheus format
      const prometheusMetrics = metrics.getMetrics();
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener métricas' },
      { status: 500 }
    );
  }
}
