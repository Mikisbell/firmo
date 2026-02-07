/**
 * Product Images API - POST (upload)
 * Requirements: 1.10, 4.7, 4.8
 * Properties: 7, 9
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
import { uploadImage } from '@/src/core/images/image.service';
import { ImageUploadRequestSchema } from '@/src/core/admin/schemas/product-image.schema';
import { ZodError } from 'zod';
import type { ProductImage } from '@/src/core/types/product-images';

const MAX_IMAGES_PER_PRODUCT = 5;

// POST - Upload image for product
async function handlePOST(request: NextRequest) {
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
    log.info({ operation: 'upload_product_image' }, 'Uploading product image');
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productId = formData.get('product_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó archivo' },
        { status: 400 }
      );
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'No se proporcionó product_id' },
        { status: 400 }
      );
    }

    // Validate request data
    const validatedData = ImageUploadRequestSchema.parse({
      product_id: productId,
    });

    // Check if product exists
    const productResult = await prisma.$queryRaw<Array<{ id: string; images: any }>>`
      SELECT id, images FROM products 
      WHERE id = ${validatedData.product_id}::uuid 
      AND tenant_id = ${tenantId}::uuid
      LIMIT 1
    `;

    if (productResult.length === 0) {
      log.warn({
        operation: 'upload_product_image_not_found',
        productId: validatedData.product_id,
      }, 'Product not found');
      
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const product = productResult[0];

    // Check image limit
    const currentImages = (product.images as ProductImage[]) || [];
    if (currentImages.length >= MAX_IMAGES_PER_PRODUCT) {
      log.warn({
        operation: 'upload_product_image_limit_exceeded',
        productId: validatedData.product_id,
        currentCount: currentImages.length,
        maxAllowed: MAX_IMAGES_PER_PRODUCT,
      }, 'Image limit exceeded');
      
      return NextResponse.json(
        { error: `Máximo ${MAX_IMAGES_PER_PRODUCT} imágenes por producto` },
        { status: 400 }
      );
    }

    // Upload image with optimization
    const uploadStart = Date.now();
    const uploadedImage = await uploadImage(
      file,
      tenantId,
      validatedData.product_id,
      authResult.user.id
    );
    logPerformance('image_upload_and_optimize', Date.now() - uploadStart, {
      imageId: uploadedImage.id,
      sizeBytes: uploadedImage.size_bytes,
    });

    // Update product with new image
    const txStart = Date.now();
    const updatedProduct = await prisma.$transaction(async (tx: any) => {
      // Get current images
      const currentResult = await tx.$queryRaw<Array<{ images: any; version: number }>>`
        SELECT images, version FROM products WHERE id = ${validatedData.product_id}::uuid
      `;
      const current = currentResult[0];

      const existingImages = (current?.images as ProductImage[]) || [];
      const newOrder = existingImages.length;

      // Add new image
      const newImage: ProductImage = {
        id: uploadedImage.id,
        url: uploadedImage.url,
        thumbnail_url: uploadedImage.thumbnail_url,
        medium_url: uploadedImage.medium_url,
        size_bytes: uploadedImage.size_bytes,
        format: uploadedImage.format,
        order: newOrder,
        uploaded_at: uploadedImage.uploaded_at,
        uploaded_by: uploadedImage.uploaded_by,
      };

      const updatedImages = [...existingImages, newImage];

      // Update product
      await tx.$executeRaw`
        UPDATE products 
        SET images = ${JSON.stringify(updatedImages)}::jsonb,
            version = version + 1,
            updated_at = NOW(),
            updated_by = ${authResult.user.id}::uuid
        WHERE id = ${validatedData.product_id}::uuid
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
            record_id: validatedData.product_id,
            action: 'add_image',
            image_id: newImage.id,
          },
          created_at: new Date(),
        },
      });

      return { images: updatedImages };
    });
    logPerformance('db_transaction_add_image', Date.now() - txStart);

    // Invalidate cache
    await cache.invalidatePattern('products:*');

    // Record metrics
    metrics.increment('product_images_uploaded_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('UPDATE', 'products', authResult.user.id, {
      productId: validatedData.product_id,
      action: 'add_image',
      imageId: uploadedImage.id,
    });

    log.info({
      operation: 'upload_product_image_success',
      productId: validatedData.product_id,
      imageId: uploadedImage.id,
      sizeBytes: uploadedImage.size_bytes,
      durationMs: Date.now() - startTime,
    }, 'Product image uploaded successfully');

    return NextResponse.json({
      id: uploadedImage.id,
      url: uploadedImage.url,
      thumbnail_url: uploadedImage.thumbnail_url,
      medium_url: uploadedImage.medium_url,
      size_bytes: uploadedImage.size_bytes,
      format: uploadedImage.format,
      order: (updatedProduct.images as ProductImage[]).length - 1,
      uploaded_at: uploadedImage.uploaded_at,
      uploaded_by: uploadedImage.uploaded_by,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'upload_product_image_validation_error',
        errors: error.errors,
      }, 'Invalid upload data');
      
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

    // Handle image service errors
    if (error instanceof Error && error.message.includes('formato')) {
      log.warn({
        operation: 'upload_product_image_invalid_format',
        error: error.message,
      }, 'Invalid image format');
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('tamaño')) {
      log.warn({
        operation: 'upload_product_image_too_large',
        error: error.message,
      }, 'Image too large');
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'upload_product_image_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to upload product image');
    
    return NextResponse.json(
      { error: 'Error al subir imagen' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
