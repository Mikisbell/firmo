/**
 * Products API - GET and POST
 * 
 * Requirements: 3.2, 3.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

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
    const products = await prisma.products.findMany({
      where: { tenant_id: TENANT_ID },
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
      where: { tenant_id: TENANT_ID, sku: data.sku },
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'SKU already exists' },
        { status: 409 }
      );
    }
    
    // Create product in transaction with audit trail and catalog version increment
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
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
          action: 'CREATE',
          resource: 'products',
          metadata: { record_id: newProduct.id },
          created_at: new Date(),
        },
      });
      
      return newProduct;
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
