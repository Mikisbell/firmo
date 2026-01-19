/**
 * Product API - GET, PUT, DELETE for single product
 * Requirements: 2.3, 2.4, 2.7, 2.8, 10.5, 10.6
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

// Validation schema for updating products
const productSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  short_name: z.string().max(30).nullable().optional(),
  price_cents: z.number().int().min(0), // Always integer, never float
  category: z.string().min(1),
  station: z.string().min(1),
  type: z.enum(['SIMPLE', 'COMBO']).default('SIMPLE'),
  is_active: z.boolean().default(true),
});

// GET - Fetch single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.products.findFirst({
      where: {
        id: params.id,
        tenant_id: TENANT_ID,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        short_name: true,
        price_cents: true,
        category: true,
        station: true,
        type: true,
        is_active: true,
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
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Validate input
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid product data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check product exists
    const existing = await prisma.products.findFirst({
      where: {
        id: params.id,
        tenant_id: TENANT_ID,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }
    
    // Check for duplicate SKU (excluding current product)
    const duplicateSku = await prisma.products.findFirst({
      where: {
        tenant_id: TENANT_ID,
        sku: data.sku,
        id: { not: params.id },
      },
    });
    
    if (duplicateSku) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 409 }
      );
    }
    
    // Update product in transaction with audit trail and catalog version increment
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.products.update({
        where: { id: params.id },
        data: {
          sku: data.sku,
          name: data.name,
          short_name: data.short_name || null,
          price_cents: data.price_cents,
          category: data.category,
          station: data.station,
          type: data.type,
          is_active: data.is_active,
        },
      });
      
      // Increment catalog version
      await tx.catalog_meta.upsert({
        where: { tenant_id: TENANT_ID },
        update: { catalog_version: { increment: 1 }, updated_at: new Date() },
        create: { tenant_id: TENANT_ID, catalog_version: 1 },
      });
      
      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: ADMIN_ID,
          action: 'UPDATE',
          resource: 'products',
          metadata: {
            record_id: params.id,
            changes: data,
          },
          created_at: new Date(),
        },
      });
      
      return updated;
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check product exists
    const existing = await prisma.products.findFirst({
      where: {
        id: params.id,
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
        where: { id: params.id },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: ADMIN_ID,
          action: 'DELETE',
          resource: 'products',
          metadata: { record_id: params.id },
          created_at: new Date(),
        },
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
