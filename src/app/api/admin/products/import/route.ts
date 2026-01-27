/**
 * CSV Import API - POST
 * Imports products from CSV format with validation and upsert logic
 * 
 * Requirements: 3.2, 3.4, 9.3, 9.4
 * Properties: 26, 27, 28, 29, 30, 31, 32, 33
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { csvService } from '@/src/core/services/csv.service';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

/**
 * CSV Import Request Schema
 */
const CSVImportSchema = z.object({
  csv_content: z.string().min(1, 'CSV content is required'),
});

/**
 * POST - Import products from CSV
 * 
 * Request body:
 * - csv_content: string - CSV file content as string
 * 
 * Response:
 * - total_rows: number - Total rows processed
 * - created_count: number - Number of products created
 * - updated_count: number - Number of products updated
 * - skipped_count: number - Number of rows skipped due to errors
 * - errors: Array<{ row: number, sku?: string, error: string }> - Validation/processing errors
 * - duration_ms: number - Processing duration in milliseconds
 */
async function handlePOST(request: NextRequest) {
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
    log.info({ operation: 'csv_import_request' }, 'Processing CSV import request');
    
    const body = await request.json();
    
    // Validate request body
    const validatedData = CSVImportSchema.parse(body);
    const { csv_content } = validatedData;

    // Validate CSV size (max 5MB)
    const csvSizeBytes = Buffer.byteLength(csv_content, 'utf8');
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    
    if (csvSizeBytes > maxSizeBytes) {
      log.warn({
        operation: 'csv_import_size_exceeded',
        sizeBytes: csvSizeBytes,
        maxSizeBytes,
      }, 'CSV file too large');
      
      return NextResponse.json(
        {
          error: 'Archivo CSV demasiado grande',
          details: `Tamaño máximo permitido: ${maxSizeBytes / 1024 / 1024}MB`,
        },
        { status: 413 } // 413 = Payload Too Large
      );
    }

    log.info({
      operation: 'csv_import_validated',
      sizeBytes: csvSizeBytes,
    }, 'CSV import request validated');

    // Import products from CSV
    const importStart = Date.now();
    const result = await csvService.importFromCSV(
      csv_content,
      TENANT_ID,
      authResult.user.id
    );
    
    const importDuration = Date.now() - importStart;
    
    logPerformance('api_csv_import', importDuration, {
      totalRows: result.total_rows,
      createdCount: result.created_count,
      updatedCount: result.updated_count,
      skippedCount: result.skipped_count,
      errorCount: result.errors.length,
    });

    // Record business metrics
    metrics.increment('products_csv_imported_total', {
      tenant_id: TENANT_ID,
      created_count: String(result.created_count),
      updated_count: String(result.updated_count),
      skipped_count: String(result.skipped_count),
    });

    // Log audit event (already logged by csvService, but log API-level event too)
    logAudit('CSV_IMPORT_API', 'products', authResult.user.id, {
      totalRows: result.total_rows,
      createdCount: result.created_count,
      updatedCount: result.updated_count,
      skippedCount: result.skipped_count,
      errorCount: result.errors.length,
    });

    // Determine HTTP status code
    let statusCode = 200;
    if (result.errors.length > 0 && result.created_count === 0 && result.updated_count === 0) {
      statusCode = 400; // All rows failed
    } else if (result.errors.length > 0) {
      statusCode = 207; // Partial success (Multi-Status)
    }

    log.info({
      operation: 'csv_import_success',
      result: {
        totalRows: result.total_rows,
        createdCount: result.created_count,
        updatedCount: result.updated_count,
        skippedCount: result.skipped_count,
        errorCount: result.errors.length,
      },
      durationMs: Date.now() - startTime,
    }, 'CSV import completed');

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.warn({
        operation: 'csv_import_validation_error',
        errors: error.errors,
      }, 'Invalid CSV import request');
      
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'csv_import_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to import CSV');
    
    return NextResponse.json(
      { error: 'Error al importar productos desde CSV' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
