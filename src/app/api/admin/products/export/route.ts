/**
 * CSV Export API - GET
 * Exports products to CSV format with optional filters
 * 
 * Requirements: 3.2, 3.9, 9.3, 9.4
 * Properties: 23, 24, 25
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { csvService } from '@/src/core/services/csv.service';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { metrics } from '@/src/core/observability/metrics';

/**
 * GET - Export products to CSV
 * 
 * Query parameters:
 * - category?: string - Filter by category (POLLOS, PARRILLAS, BEBIDAS, etc.)
 * - station?: string - Filter by station (PARRILLA, COCINA, BAR, etc.)
 * - includeInactive?: string - Include inactive products ("true" or "false")
 * 
 * Response:
 * - Content-Type: text/csv
 * - Content-Disposition: attachment; filename="products-export-{timestamp}.csv"
 */
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Extract tenantId from JWT
  const tenantId = authResult.user.tenantId;

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const station = searchParams.get('station') || undefined;
    const includeInactive = searchParams.get('includeInactive') === 'true';

    log.info({
      operation: 'csv_export_request',
      filters: { category, station, includeInactive },
    }, 'Processing CSV export request');

    // Export products to CSV
    const exportStart = Date.now();
    const csv = await csvService.exportToCSV(tenantId, {
      category,
      station,
      includeInactive,
    });
    
    const exportDuration = Date.now() - exportStart;
    const productCount = csv.split('\n').length - 1; // -1 for header
    
    logPerformance('api_csv_export', exportDuration, {
      productCount,
      hasFilters: !!(category || station || includeInactive),
    });

    // Record business metrics
    metrics.increment('products_csv_exported_total', {
      tenant_id: tenantId,
      product_count: String(productCount),
    });

    // Log audit event
    logAudit('CSV_EXPORT', 'products', authResult.user.id, {
      filters: { category, station, includeInactive },
      productCount,
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `products-export-${timestamp}.csv`;

    log.info({
      operation: 'csv_export_success',
      productCount,
      filename,
      sizeBytes: csv.length,
      durationMs: Date.now() - startTime,
    }, 'CSV export completed');

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(csv.length),
      },
    });
  } catch (error) {
    log.error({
      operation: 'csv_export_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to export CSV');
    
    return NextResponse.json(
      { error: 'Error al exportar productos a CSV' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
