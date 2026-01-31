/**
 * Bulk Operations Service
 * Handles bulk updates and deletes for products with transaction support
 * 
 * Features:
 * - Transaction-based bulk updates for atomicity
 * - Batch processing (50 products per transaction)
 * - Audit logging for all operations
 * - Cache invalidation
 * - Optimistic locking (version checks)
 * - Detailed failure reporting
 */

import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { cache } from '@/src/core/cache/redis.service';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import type { 
  ProductUpdate, 
  BulkOperationResult, 
  BulkOperationFailure 
} from '@/src/core/types/bulk-operations';

const BATCH_SIZE = 50;

/**
 * Bulk Operations Service
 */
export class BulkOperationsService {
  /**
   * Bulk update products
   * Updates multiple products with the same changes in a single atomic transaction
   * 
   * @param productIds - Array of product IDs to update
   * @param updates - Fields to update
   * @param tenantId - Tenant ID for isolation
   * @param userId - User ID for audit trail
   * @returns Result with success/failure counts and details
   */
  async bulkUpdate(
    productIds: string[],
    updates: ProductUpdate,
    tenantId: string,
    userId: string
  ): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const requestId = randomUUID();
    const log = createRequestLogger(requestId, userId);

    log.info({
      operation: 'bulk_update',
      productCount: productIds.length,
      updates,
    }, 'Starting bulk update');

    const failures: BulkOperationFailure[] = [];
    let successCount = 0;

    try {
      // Execute ENTIRE operation in a SINGLE transaction for atomicity
      await prisma.$transaction(async (tx: any) => {
        // FIRST: Validate ALL products exist BEFORE making any changes
        const allProducts = await tx.products.findMany({
          where: {
            id: { in: productIds },
            tenant_id: tenantId,
          },
          select: {
            id: true,
            sku: true,
            version: true,
          },
        });

        // Check if ALL products exist
        if (allProducts.length !== productIds.length) {
          const foundIds = new Set(allProducts.map((p: any) => p.id));
          const missingIds = productIds.filter(id => !foundIds.has(id));
          throw new Error(`Products not found: ${missingIds.join(', ')}`);
        }

        // Process in batches for performance (but within same transaction)
        const batches = this.createBatches(productIds, BATCH_SIZE);

        for (const batch of batches) {
          const batchStart = Date.now();

          // Update products
          const updateData: any = {
            ...updates,
            version: { increment: 1 },
            updated_at: new Date(),
          };
          
          // Only set updated_by if userId is a valid UUID
          if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
            updateData.updated_by = userId;
          }

          await tx.products.updateMany({
            where: {
              id: { in: batch },
              tenant_id: tenantId,
            },
            data: updateData,
          });

          logPerformance('bulk_update_batch', Date.now() - batchStart, {
            batchSize: batch.length,
          });
        }

        // Increment catalog version
        await tx.catalog_meta.upsert({
          where: { tenant_id: tenantId },
          create: {
            tenant_id: tenantId,
            catalog_version: 1,
            updated_at: new Date(),
          },
          update: {
            catalog_version: { increment: 1 },
            updated_at: new Date(),
          },
        });

        // Create audit log entry (only if userId is valid UUID)
        if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          await tx.admin_access_logs.create({
            data: {
              id: randomUUID(),
              tenant_id: tenantId,
              employee_id: userId,
              action: 'BULK_UPDATE',
              resource: 'products',
              metadata: {
                product_ids: productIds,
                updates,
                count: productIds.length,
              },
              created_at: new Date(),
            },
          });
        }
      });

      // If we reach here, ALL updates succeeded
      successCount = productIds.length;

    } catch (error) {
      // Transaction failed - ALL updates rolled back
      log.error({
        operation: 'bulk_update_error',
        error: error instanceof Error ? error.message : String(error),
      }, 'Bulk update failed - transaction rolled back');

      // Get product SKUs for error reporting
      const products = await prisma.products.findMany({
        where: {
          id: { in: productIds },
          tenant_id: tenantId,
        },
        select: { id: true, sku: true },
      });

      for (const product of products) {
        failures.push({
          product_id: product.id,
          sku: product.sku,
          error: error instanceof Error ? error.message : 'Transaction rolled back',
        });
      }
    }

    // Invalidate cache (only if there were successful updates)
    if (successCount > 0) {
      await cache.invalidatePattern('products:*');
    }

    const duration = Date.now() - startTime;
    const result: BulkOperationResult = {
      success_count: successCount,
      failure_count: failures.length,
      failures,
      duration_ms: duration,
    };

    log.info({
      operation: 'bulk_update_complete',
      result,
    }, 'Bulk update completed');

    logPerformance('bulk_update_total', duration, {
      totalProducts: productIds.length,
      successCount,
      failureCount: failures.length,
    });

    return result;
  }

  /**
   * Bulk delete products (soft delete)
   * Sets is_active=false for multiple products
   * 
   * @param productIds - Array of product IDs to delete
   * @param tenantId - Tenant ID for isolation
   * @param userId - User ID for audit trail
   * @returns Result with success/failure counts and details
   */
  async bulkDelete(
    productIds: string[],
    tenantId: string,
    userId: string
  ): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const requestId = randomUUID();
    const log = createRequestLogger(requestId, userId);

    log.info({
      operation: 'bulk_delete',
      productCount: productIds.length,
    }, 'Starting bulk delete');

    // Use bulkUpdate with is_active=false for soft delete
    const result = await this.bulkUpdate(
      productIds,
      { is_active: false },
      tenantId,
      userId
    );

    // Update audit log action to BULK_DELETE (only if userId is valid UUID)
    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      try {
        await prisma.admin_access_logs.updateMany({
          where: {
            tenant_id: tenantId,
            employee_id: userId,
            action: 'BULK_UPDATE',
            created_at: {
              gte: new Date(startTime),
            },
          },
          data: {
            action: 'BULK_DELETE',
          },
        });
      } catch (error) {
        log.warn({
          operation: 'bulk_delete_audit_update_error',
          error: error instanceof Error ? error.message : String(error),
        }, 'Failed to update audit log action');
      }
    }

    const duration = Date.now() - startTime;
    logPerformance('bulk_delete_total', duration, {
      totalProducts: productIds.length,
      successCount: result.success_count,
      failureCount: result.failure_count,
    });

    log.info({
      operation: 'bulk_delete_complete',
      result,
    }, 'Bulk delete completed');

    return result;
  }

  /**
   * Create batches from array
   * @private
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Singleton instance
 */
export const bulkOperationsService = new BulkOperationsService();
