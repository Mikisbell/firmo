/**
 * Product Images API - DELETE (remove image)
 * Requirements: 1.10, 4.8
 * Properties: 9
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { deleteImage } from '@/src/core/images/image.service';
import type { ProductImage } from '@/src/core/types/product-images';

// DELETE - Remove image from product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication
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
    const { id: imageId } = await params;
    
    log.info({ 
      operation: 'delete_product_image',
      imageId,
    }, 'Deleting product image');

    // Find product with this image
    const productsResult = await prisma.$queryRaw<Array<{ id: string; images: any; version: number }>>`
      SELECT id, images, version FROM products 
      WHERE tenant_id = ${tenantId}::uuid
      AND images @> ${JSON.stringify([{ id: imageId }])}::jsonb
      LIMIT 1
    `;

    if (productsResult.length === 0) {
      log.warn({
        operation: 'delete_product_image_not_found',
        imageId,
      }, 'Image not found in any product');
      
      return NextResponse.json(
        { error: 'Imagen no encontrada' },
        { status: 404 }
      );
    }

    const product = productsResult[0];
    const currentImages = (product.images as ProductImage[]) || [];
    const imageToDelete = currentImages.find(img => img.id === imageId);

    if (!imageToDelete) {
      return NextResponse.json(
        { error: 'Imagen no encontrada' },
        { status: 404 }
      );
    }

    // Delete from storage
    const deleteStart = Date.now();
    try {
      await deleteImage(imageToDelete.url, tenantId, product.id);
      logPerformance('image_delete_from_storage', Date.now() - deleteStart, {
        imageId,
      });
    } catch (storageError) {
      log.warn({
        operation: 'delete_product_image_storage_error',
        imageId,
        error: storageError instanceof Error ? storageError.message : String(storageError),
      }, 'Failed to delete image from storage, continuing with database cleanup');
      // Continue with database cleanup even if storage deletion fails
    }

    // Update product - remove image and reorder remaining
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      // Remove image and reorder
      const updatedImages = currentImages
        .filter(img => img.id !== imageId)
        .map((img, index) => ({ ...img, order: index }));

      // Update product
      await tx.$executeRaw`
        UPDATE products 
        SET images = ${JSON.stringify(updatedImages)}::jsonb,
            version = version + 1,
            updated_at = NOW(),
            updated_by = ${authResult.user.id}::uuid
        WHERE id = ${product.id}::uuid
      `;

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

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'products',
          metadata: {
            record_id: product.id,
            action: 'delete_image',
            image_id: imageId,
          },
          created_at: new Date(),
        },
      });
    });
    logPerformance('db_transaction_delete_image', Date.now() - txStart);

    // Invalidate cache
    await cache.invalidatePattern('products:*');

    // Record metrics
    metrics.increment('product_images_deleted_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('UPDATE', 'products', authResult.user.id, {
      productId: product.id,
      action: 'delete_image',
      imageId,
    });

    log.info({
      operation: 'delete_product_image_success',
      productId: product.id,
      imageId,
      durationMs: Date.now() - startTime,
    }, 'Product image deleted successfully');

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    log.error({
      operation: 'delete_product_image_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to delete product image');
    
    return NextResponse.json(
      { error: 'Error al eliminar imagen' },
      { status: 500 }
    );
  }
}
