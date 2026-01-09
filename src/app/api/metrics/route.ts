/**
 * Prometheus Metrics Endpoint
 * 
 * Exposes metrics in Prometheus format for scraping.
 * GET /api/metrics - Returns all metrics
 * GET /api/metrics?format=json - Returns metrics as JSON summary
 */

import { NextResponse } from 'next/server';
import { getPrometheusMetrics, getMetricsSummary } from '@/src/core/observability/metrics';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');
    
    if (format === 'json') {
        return NextResponse.json(getMetricsSummary());
    }
    
    // Default: Prometheus format
    const metrics = getPrometheusMetrics();
    
    return new NextResponse(metrics, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
}
