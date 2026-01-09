/**
 * Products API - GET and POST
 * 
 * Requirements: 3.2, 3.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

// Validation schema for creating/updating products
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

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    const products = await prisma.products.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
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
    
    return NextResponse.json(products);
  } catch (error) {
    console.error('Products GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
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
    
    // Check for duplicate SKU
    const existing = await prisma.products.findFirst({
      where: { tenant_id: tenantId, sku: data.sku },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 409 }
      );
    }
    
    // Create product
    const product = await prisma.products.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
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
    await prisma.catalog_meta.upsert({
      where: { tenant_id: tenantId },
      update: { catalog_version: { increment: 1 }, updated_at: new Date() },
      create: { tenant_id: tenantId, catalog_version: 1 },
    });
    
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Products POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
