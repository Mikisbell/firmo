/**
 * Products API - GET (list) and POST (create)
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 10.4
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';

// GET - List all products
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

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sku, name, short_name, price_cents, category, station, type = 'SIMPLE', is_active = true } = body;

    // Validate required fields
    if (!sku || !name || price_cents === undefined || !category || !station) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: sku, name, price_cents, category, station' },
        { status: 400 }
      );
    }

    // Validate price is integer
    if (!Number.isInteger(price_cents) || price_cents < 0) {
      return NextResponse.json(
        { error: 'price_cents debe ser un número entero positivo' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Categoría inválida. Debe ser uno de: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate station
    const validStations = ['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE'];
    if (!validStations.includes(station)) {
      return NextResponse.json(
        { error: `Estación inválida. Debe ser uno de: ${validStations.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['SIMPLE', 'COMBO'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Check SKU uniqueness
    const existingSku = await prisma.products.findFirst({
      where: {
        tenant_id: TENANT_ID,
        sku,
      },
    });

    if (existingSku) {
      return NextResponse.json(
        { error: 'Este SKU ya está en uso' },
        { status: 409 }
      );
    }

    // Create product in transaction with audit trail and catalog version increment
    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          sku,
          name,
          short_name: short_name || null,
          price_cents,
          category,
          station,
          type,
          is_active,
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
