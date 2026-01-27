/**
 * Product Image API - DELETE (remove image)
 * Requirements: 1.10, 4.8
 * Properties: 5, 9
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';
import { deleteImage } from '@/src/core/images/image.service';
import { ImageDeleteRequestSchema } from '@/src/core/admin/schemas/product-image.schema';
import { ZodError } from 'zod';
import type { ProductImage } from '@/src/core/types/product-images';

const TENANT_ID = getTenantId();

// DELETE - Remove image from product
async function handleDELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    const imageId = context.params.id;
    log.info({ 
      operation: 'delete_product_image',
      imageId,
    }, 'Deleting product image');
    
    // Get product_id from query params
    const productId = request.nextUrl.searchParams.get('product_id');
    
    if (!productId) {
      return NextResponse.json(
        { error: 'No se proporcionó product_id' },
        { status: 400 }
      );
    }

    // Validate request data
    const validatedData = ImageDeleteRequestSchema.parse({
      image_id: imageId,
      product_id: productId,
    });

    // Check if product exists and has the image
    const productResult = await prisma.$queryRaw<Array<{ id: string; images: any }>>`
      SELECT id, images FROM products 
      WHERE id = ${validatedData.product_id}::uuid 
      AND tenant_id = ${TENANT_ID}::uuid
      LIMIT 1
    `;

    if (productResult.length === 0) {
      log.warn({
        operation: 'delete_product_image_not_found',
        productId: validatedData.product_id,
      }, 'Product not found');
      
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const product = productResult[0];
    const currentImages = (product.images as ProductImage[]) || [];
    const imageToDelete = currentImages.find(img => img.id === validatedData.image_id);

    if (!imageToDelete) {
      log.warn({
        operation: 'delete_product_image_not_found',
        productId: validatedData.product_id,
        imageId: validatedData.image_id,
      }, 'Image not found in product');
      
      return NextResponse.json(
        { error: 'Imagen no encontrada' },
        { status: 404 }
      );
    }

    // Delete image from storage
    const deleteStart = Date.now();
    await deleteImage(
      validatedData.image_id,
      TENANT_ID,
      validatedData.product_id
    );
    logPerformance('image_delete_from_storage', Date.now() - deleteStart, {
      imageId: validatedData.image_id,
    });

    // Update product - remove image and reorder remaining
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      // Remove image and reorder
      const remainingImages = currentImages
        .filter(img => img.id !== validatedData.image_id)
        .map((img, index) => ({
          ...img,
          order: index, // Reorder sequentially
        }));

      // Update product
      await tx.$executeRaw`
        UPDATE products 
        SET images = ${JSON.stringify(remainingImages)}::jsonb,
            version = version + 1,
            updated_at = NOW(),
            updated_by = ${authResult.user.id}::uuid
        WHERE id = ${validatedData.product_id}::uuid
      `;

      // Increment catalog version
      await tx.catalog_meta.upsert({
        where: { tenant_id: TENANT_ID },
        create: {
          tenant_id: TENANT_ID,
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
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'products',
          metadata: {
            record_id: validatedData.product_id,
            action: 'delete_image',
            image_id: validatedData.image_id,
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
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('UPDATE', 'products', authResult.user.id, {
      productId: validatedData.product_id,
      action: 'delete_image',
      imageId: validatedData.image_id,
    });

    log.info({
      operation: 'delete_product_image_success',
      productId: validatedData.product_id,
      imageId: validatedData.image_id,
      durationMs: Date.now() - startTime,
    }, 'Product image deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Imagen eliminada correctamente',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'delete_product_image_validation_error',
        errors: error.errors,
      }, 'Invalid delete data');
      
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

export { handleDELETE as DELETE };
