/**
 * Products API - GET, PUT, DELETE for single product
 * Requirements: 2.3, 2.4, 2.7, 10.5, 10.6
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

// GET - Get single product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
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
    console.error('Product GET error:', error);
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

  try {
    const { id } = await params;
    const body = await request.json();
    const { sku, name, short_name, price_cents, category, station, type, is_active } = body;

    // Check product exists
    const existing = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
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

    // Check SKU uniqueness if changing SKU
    if (sku && sku !== existing.sku) {
      const existingSku = await prisma.products.findFirst({
        where: {
          tenant_id: TENANT_ID,
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
        },
      });

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
            record_id: id,
            changes: body,
          },
          created_at: new Date(),
        },
      });

      return updatedProduct;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Product PUT error:', error);
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

  try {
    const { id } = await params;
    // Check product exists
    const existing = await prisma.products.findFirst({
      where: {
        id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
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
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'products',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    );
  }
}
