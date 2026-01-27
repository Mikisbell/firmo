/**
 * CSV Template API - GET
 * Generates and downloads a CSV template with example data
 * 
 * Requirements: 3.3, 9.3, 9.4
 * Properties: 23
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { csvService } from '@/src/core/services/csv.service';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit } from '@/src/core/observability/logger-pino';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

/**
 * GET - Download CSV template
 * 
 * Response:
 * - Content-Type: text/csv
 * - Content-Disposition: attachment; filename="products-template.csv"
 * - CSV template with headers and 3 example rows
 */
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    log.info({ operation: 'csv_template_request' }, 'Processing CSV template request');

    // Generate CSV template
    const template = csvService.generateTemplate();

    // Record business metrics
    metrics.increment('products_csv_template_downloaded_total', {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('CSV_TEMPLATE_DOWNLOAD', 'products', authResult.user.id, {});

    const filename = 'products-template.csv';

    log.info({
      operation: 'csv_template_success',
      filename,
      sizeBytes: template.length,
      durationMs: Date.now() - startTime,
    }, 'CSV template generated');

    // Return CSV template
    return new NextResponse(template, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(template.length),
      },
    });
  } catch (error) {
    log.error({
      operation: 'csv_template_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to generate CSV template');
    
    return NextResponse.json(
      { error: 'Error al generar plantilla CSV' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
