/**
 * Metrics API Endpoint
 * 
 * Provides access to collected metrics for monitoring and analytics.
 * Requires admin authentication.
 * 
 * GET /api/metrics - Retrieve metrics with optional filtering
 * 
 * Query Parameters:
 * - tenantId: Filter by tenant ID
 * - terminalId: Filter by terminal ID
 * - period: Time period (1h, 24h, 7d, 30d)
 * - metricType: Filter by metric type (counter, gauge, histogram, timing)
 * 
 * @module api/metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import { metrics } from '@/src/core/observability/metrics';

/**
 * GET /api/metrics
 * 
 * Retrieve collected metrics with optional filtering and aggregation.
 * Requires admin authentication.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate - admin only
    const session = await getSessionFromRequest(request, prisma);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    const employee = await prisma.employees.findUnique({
      where: { id: session.employeeId },
      select: { role: true },
    });

    if (!employee || employee.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');
    const terminalId = searchParams.get('terminalId');
    const period = searchParams.get('period') || '1h';
    const metricType = searchParams.get('metricType');

    // Get all metrics from collector
    const allMetrics = metrics.getMetrics();
    const counters = metrics.getCounters();
    const histograms = metrics.getHistograms();

    // Calculate time range based on period
    const now = Date.now();
    const periodMs: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const startTime = now - (periodMs[period] || periodMs['1h']);

    // Filter metrics based on query parameters
    const filteredMetrics = Array.from(allMetrics.values()).filter(metric => {
      // Filter by time period
      if (metric.timestamp < startTime) {
        return false;
      }

      // Filter by tenant ID
      if (tenantId && metric.tags.tenantId !== tenantId) {
        return false;
      }

      // Filter by terminal ID
      if (terminalId && metric.tags.terminalId !== terminalId) {
        return false;
      }

      // Filter by metric type
      if (metricType && metric.type !== metricType) {
        return false;
      }

      return true;
    });

    // Aggregate metrics by name and type
    const aggregated = aggregateMetrics(filteredMetrics);

    // Return metrics with metadata
    return NextResponse.json({
      success: true,
      data: {
        metrics: aggregated,
        summary: {
          totalMetrics: filteredMetrics.length,
          period,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(now).toISOString(),
          filters: {
            tenantId: tenantId || null,
            terminalId: terminalId || null,
            metricType: metricType || null,
          },
        },
        counters: Object.fromEntries(counters),
        histograms: Object.fromEntries(
          Array.from(histograms.entries()).map(([key, values]) => [
            key,
            {
              count: values.length,
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              p50: percentile(values, 50),
              p95: percentile(values, 95),
              p99: percentile(values, 99),
            },
          ])
        ),
      },
    });
  } catch (error) {
    console.error('Error retrieving metrics:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Aggregate metrics by name and type
 */
function aggregateMetrics(metrics: Array<{
  name: string;
  value: number;
  type: string;
  tags: Record<string, string>;
  timestamp: number;
}>) {
  const aggregated: Record<string, {
    name: string;
    type: string;
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    latest: number;
    tags: Record<string, Set<string>>;
  }> = {};

  for (const metric of metrics) {
    if (!aggregated[metric.name]) {
      aggregated[metric.name] = {
        name: metric.name,
        type: metric.type,
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        avg: 0,
        latest: metric.value,
        tags: {},
      };
    }

    const agg = aggregated[metric.name];
    agg.count++;
    agg.sum += metric.value;
    agg.min = Math.min(agg.min, metric.value);
    agg.max = Math.max(agg.max, metric.value);
    agg.avg = agg.sum / agg.count;
    agg.latest = metric.value;

    // Collect unique tag values
    for (const [key, value] of Object.entries(metric.tags)) {
      if (!agg.tags[key]) {
        agg.tags[key] = new Set();
      }
      agg.tags[key].add(value);
    }
  }

  // Convert tag sets to arrays
  return Object.values(aggregated).map(agg => ({
    ...agg,
    tags: Object.fromEntries(
      Object.entries(agg.tags).map(([key, values]) => [key, Array.from(values)])
    ),
  }));
}

/**
 * Calculate percentile from array of values
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
