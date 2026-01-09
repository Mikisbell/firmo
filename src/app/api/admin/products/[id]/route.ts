/**
 * Products API - GET, PUT, DELETE by ID
 * 
 * Requirements: 3.2, 3.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

// Validation schema for updating products
const updateProductSchema = z.object({
  sku: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  short_name: z.string().max(30).nullable().optional(),
  price_cents: z.number().int().min(0).optional(), // Always integer
  category: z.string().min(1).optional(),
  station: z.string().min(1).optional(),
  type: z.enum(['SIMPLE', 'COMBO']).optional(),
  is_active: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    const product = await prisma.products.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    const body = await request.json();
    
    // Validate input
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid product data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    // Check product exists
    const existing = await prisma.products.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    const data = parsed.data;
    
    // Check for duplicate SKU if changing
    if (data.sku && data.sku !== existing.sku) {
      const duplicate = await prisma.products.findFirst({
        where: { tenant_id: tenantId, sku: data.sku, id: { not: id } },
      });
      
      if (duplicate) {
        return NextResponse.json(
          { error: 'SKU already exists' },
          { status: 409 }
        );
      }
    }
    
    // Update product
    const product = await prisma.products.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    
    // Increment catalog version
    await prisma.catalog_meta.upsert({
      where: { tenant_id: tenantId },
      update: { catalog_version: { increment: 1 }, updated_at: new Date() },
      create: { tenant_id: tenantId, catalog_version: 1 },
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    // Check product exists
    const existing = await prisma.products.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Soft delete by setting is_active to false
    await prisma.products.update({
      where: { id },
      data: { is_active: false },
    });
    
    // Increment catalog version
    await prisma.catalog_meta.upsert({
      where: { tenant_id: tenantId },
      update: { catalog_version: { increment: 1 }, updated_at: new Date() },
      create: { tenant_id: tenantId, catalog_version: 1 },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
