/**
 * Bulk Operations API - POST
 * Handles bulk updates and deletes for products
 * 
 * Requirements: 2.4, 5.2, 5.6, 9.3, 9.4, 9.6
 * Properties: 16, 17, 18, 21, 22, 41, 42
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { BulkUpdateSchema, BulkDeleteSchema } from '@/src/core/admin/schemas/bulk-operations.schema';
import { bulkOperationsService } from '@/src/core/services/bulk-operations.service';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { metrics } from '@/src/core/observability/metrics';

/**
 * POST - Bulk update or delete products
 * 
 * Request body:
 * - For bulk update: { product_ids: string[], updates: { is_active?, category?, station? } }
 * - For bulk delete: { product_ids: string[], operation: 'delete' }
 */
async function handlePOST(request: NextRequest) {
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
    log.info({ operation: 'bulk_operation' }, 'Processing bulk operation');
    
    const body = await request.json();
    
    // Determine operation type
    const isDelete = body.operation === 'delete';
    
    // Validate with appropriate Zod schema
    const validatedData = isDelete
      ? BulkDeleteSchema.parse(body)
      : BulkUpdateSchema.parse(body);

    const { product_ids } = validatedData;
    const updates = 'updates' in validatedData ? validatedData.updates : undefined;

    log.info({
      operation: isDelete ? 'bulk_delete' : 'bulk_update',
      productCount: product_ids.length,
      updates,
    }, 'Validated bulk operation request');

    // Execute bulk operation
    const operationStart = Date.now();
    let result;
    
    if (isDelete) {
      result = await bulkOperationsService.bulkDelete(
        product_ids,
        tenantId,
        authResult.user.id
      );
    } else {
      result = await bulkOperationsService.bulkUpdate(
        product_ids,
        updates!,
        tenantId,
        authResult.user.id
      );
    }
    
    logPerformance(
      isDelete ? 'api_bulk_delete' : 'api_bulk_update',
      Date.now() - operationStart,
      {
        productCount: product_ids.length,
        successCount: result.success_count,
        failureCount: result.failure_count,
      }
    );

    // Record business metrics
    metrics.increment(
      isDelete ? 'products_bulk_deleted_total' : 'products_bulk_updated_total',
      {
        tenant_id: tenantId,
        success_count: String(result.success_count),
        failure_count: String(result.failure_count),
      }
    );

    // Log audit event
    logAudit(
      isDelete ? 'BULK_DELETE' : 'BULK_UPDATE',
      'products',
      authResult.user.id,
      {
        productIds: product_ids,
        updates: isDelete ? undefined : updates,
        successCount: result.success_count,
        failureCount: result.failure_count,
      }
    );

    // Determine HTTP status code
    const statusCode = result.failure_count === 0 ? 200 : 207; // 207 = Multi-Status (partial success)

    log.info({
      operation: isDelete ? 'bulk_delete_success' : 'bulk_update_success',
      result,
      durationMs: Date.now() - startTime,
    }, 'Bulk operation completed');

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'bulk_operation_validation_error',
        errors: error.errors,
      }, 'Invalid bulk operation request');
      
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
      operation: 'bulk_operation_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to execute bulk operation');
    
    return NextResponse.json(
      { error: 'Error al ejecutar operación masiva' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
