/**
 * Products API - GET, PUT, DELETE for single product
 * Requirements: 2.3, 2.4, 2.7, 10.5, 10.6, 1.10 (images)
 * Properties: 8 (image reordering)
 * 
 * Cache Integration: Task 9.7
 * - Invalidate product cache on updates
 * - Use tag-based invalidation
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { cache } from '@/src/core/cache/cache-service';
import { ImageReorderRequestSchema } from '@/src/core/admin/schemas/product-image.schema';
import type { ProductImage } from '@/src/core/types/product-images';
import { ZodError } from 'zod';
import { metrics } from '@/src/core/observability/metrics';
import { logger } from '@/src/core/observability/structured-logger';

const TENANT_ID = getTenantId();

// Validate UUID format
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// GET - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }
    
    const product = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    logger.error('Error al obtener producto', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    );
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { sku, name, short_name, price_cents, category, station, type, is_active, images } = body;

    // Check product exists and belongs to tenant
    const existing = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Producto no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // Validate price is integer if provided
    if (price_cents !== undefined && (!Number.isInteger(price_cents) || price_cents < 0)) {
      return NextResponse.json(
        { error: 'price_cents debe ser un número entero positivo' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Categoría inválida. Debe ser uno de: ${validCategories.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate station if provided
    if (station) {
      const validStations = ['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE'];
      if (!validStations.includes(station)) {
        return NextResponse.json(
          { error: `Estación inválida. Debe ser uno de: ${validStations.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate type if provided
    if (type) {
      const validTypes = ['SIMPLE', 'COMBO'];
      if (!validTypes.includes(type)) {
        return NextResponse.json(
          { error: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate images if provided (for reordering)
    if (images !== undefined) {
      try {
        ImageReorderRequestSchema.parse({ images });
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            {
              error: 'Imágenes inválidas',
              details: error.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
              })),
            },
            { status: 400 }
          );
        }
      }
    }

    // Check SKU uniqueness if changing SKU
    if (sku && sku !== existing.sku) {
      const existingSku = await prisma.products.findFirst({
        where: {
          tenant_id: tenantId,
          sku,
          id: { not: id },
        },
      });

      if (existingSku) {
        return NextResponse.json(
          { error: 'Este SKU ya está en uso' },
          { status: 409 }
        );
      }
    }

    // Update product in transaction with audit trail and catalog version increment
    const updated = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.products.update({
        where: { id },
        data: {
          ...(sku && { sku }),
          ...(name && { name }),
          ...(short_name !== undefined && { short_name: short_name || null }),
          ...(price_cents !== undefined && { price_cents }),
          ...(category && { category }),
          ...(station && { station }),
          ...(type && { type }),
          ...(typeof is_active === 'boolean' && { is_active }),
          ...(images !== undefined && { images: images as any }),
          version: { increment: 1 },
          updated_at: new Date(),
          updated_by: authResult.user.id,
        },
      });

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
            record_id: id,
            changes: body,
          },
          created_at: new Date(),
        },
      });

      return updatedProduct;
    });

    // Invalidate cache using tag-based invalidation
    await cache.deleteByTag(`tenant:${tenantId}`);
    await cache.deleteByTag('products');
    metrics.increment('cache.invalidation', { resource: 'products', reason: 'update' });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error al actualizar producto', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // ✅ Use tenant_id from authenticated user's JWT token
  const tenantId = authResult.user.tenantId;

  try {
    const { id } = await params;
    
    // Validate UUID format - return 404 for invalid UUIDs (not found)
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }
    
    // Check product exists and belongs to tenant
    const existing = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Producto no encontrado o no autorizado' },
        { status: 403 }
      );
    }

    // Soft delete in transaction with audit trail
    await prisma.$transaction(async (tx) => {
      await tx.products.update({
        where: { id },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'products',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });

    // Invalidate cache using tag-based invalidation
    await cache.deleteByTag(`tenant:${tenantId}`);
    await cache.deleteByTag('products');
    metrics.increment('cache.invalidation', { resource: 'products', reason: 'delete' });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Error al eliminar producto', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}
