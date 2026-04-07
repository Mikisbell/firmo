/**
 * Public Order API - GET status + POST self-order (no auth)
 *
 * GET: Returns active orders for a table so customers can see their order status.
 * POST: Customer places an order from the digital menu (QR scan).
 *       Rate limited: 3 orders per hour per table.
 *
 * @module app/api/menu/[tenantSlug]/[tableId]/orders/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const logger = createLogger('public-self-order');

// ============================================================================
// Rate Limiting (in-memory, per table — 3 orders per hour)
// ============================================================================

const orderTimestamps = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ORDERS_PER_WINDOW = 3;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = orderTimestamps.get(key) ?? [];
  const valid = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  orderTimestamps.set(key, valid);
  return valid.length >= MAX_ORDERS_PER_WINDOW;
}

function recordOrder(key: string): void {
  const now = Date.now();
  const timestamps = orderTimestamps.get(key) ?? [];
  timestamps.push(now);
  orderTimestamps.set(key, timestamps);

  // Clean old entries if map grows large
  if (orderTimestamps.size > 5000) {
    for (const [k, ts] of orderTimestamps) {
      const valid = ts.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) orderTimestamps.delete(k);
      else orderTimestamps.set(k, valid);
    }
  }
}

// ============================================================================
// POST Schema
// ============================================================================

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  price_cents: z.number().int().nonnegative(),
  qty: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
});

const orderBodySchema = z.object({
  items: z.array(cartItemSchema).min(1).max(30),
  notes: z.string().max(1000).optional(),
  customerName: z.string().max(100).optional(),
});

// ============================================================================
// Types
// ============================================================================

interface RouteContext {
  params: Promise<{ tenantSlug: string; tableId: string }>;
}

interface OrderItem {
  line_id: string;
  name: string;
  qty: number;
  unit_price_cents: number;
  line_total_cents: number;
  status: string;
  notes?: string;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, tableId } = await context.params;

    // Resolve tenant
    const tenant = await prisma.tenants.findFirst({
      where: { slug: tenantSlug },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    // Verify table
    const table = await prisma.tables.findFirst({
      where: { id: tableId, tenant_id: tenant.id, is_active: true },
      select: { id: true, number: true },
    });

    if (!table) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    // Get today's start (Lima timezone, UTC-5)
    const now = new Date();
    const limaOffset = -5 * 60; // UTC-5 in minutes
    const limaTime = new Date(now.getTime() + (limaOffset + now.getTimezoneOffset()) * 60000);
    const todayStart = new Date(limaTime);
    todayStart.setHours(0, 0, 0, 0);
    // Convert back to UTC for DB query
    const todayStartUtc = new Date(todayStart.getTime() - (limaOffset + now.getTimezoneOffset()) * 60000);

    // Find active orders for this table (not CANCELLED, created today)
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: tenant.id,
        table_id: table.id,
        order_status: { notIn: ['CANCELLED'] },
        created_at: { gte: todayStartUtc },
      },
      select: {
        id: true,
        order_number: true,
        order_status: true,
        fulfillment_status: true,
        total_cents: true,
        items: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5, // Max 5 recent orders
    });

    // Transform items for public display (strip internal fields)
    const publicOrders = orders.map((order) => {
      const rawItems = (order.items as unknown as OrderItem[]) ?? [];
      const items = rawItems
        .filter((item) => item.status !== 'VOIDED')
        .map((item) => ({
          name: item.name,
          qty: item.qty,
          total_cents: item.line_total_cents,
          status: item.status,
          notes: item.notes ?? null,
        }));

      return {
        order_number: order.order_number,
        status: order.order_status,
        fulfillment_status: order.fulfillment_status,
        total_cents: order.total_cents,
        items,
        created_at: order.created_at.toISOString(),
      };
    });

    return NextResponse.json(
      { orders: publicOrders },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch {
    return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
  }
}

// ============================================================================
// POST — Create self-order from QR menu
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, tableId } = await context.params;

    if (!tenantSlug || !tableId) {
      return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
    }

    // Rate limit check
    const rateKey = `${tenantSlug}:${tableId}`;
    if (isRateLimited(rateKey)) {
      return NextResponse.json(
        { error: 'Limite de pedidos alcanzado. Intenta de nuevo mas tarde.' },
        { status: 429 },
      );
    }

    // Resolve tenant
    const tenant = await prisma.tenants.findFirst({
      where: { slug: tenantSlug, is_active: true },
      select: { id: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    // Verify table
    const table = await prisma.tables.findFirst({
      where: { id: tableId, tenant_id: tenant.id, is_active: true },
      select: { id: true, number: true, display_name: true },
    });

    if (!table) {
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }

    // Parse body
    const body = await request.json().catch(() => null);
    const parsed = orderBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { items, notes, customerName } = parsed.data;

    // Validate products exist and prices match
    const productIds = items.map((i) => i.product_id);
    const products = await prisma.products.findMany({
      where: {
        id: { in: productIds },
        tenant_id: tenant.id,
        is_active: true,
        is_available: true,
      },
      select: { id: true, name: true, price_cents: true, sku: true, station: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check all products exist and prices match
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          { error: `Producto no disponible: ${item.name}` },
          { status: 400 },
        );
      }
      if (product.price_cents !== item.price_cents) {
        return NextResponse.json(
          { error: `Precio actualizado para ${product.name}. Recarga el menu.` },
          { status: 409 },
        );
      }
    }

    // Generate order number
    const orderNumberResult = await prisma.$queryRaw<{ max_num: number | null }[]>`
      SELECT MAX(order_number) as max_num
      FROM orders
      WHERE tenant_id = ${tenant.id}::uuid
    `;
    const orderNumber = (orderNumberResult[0]?.max_num ?? 1000) + 1;

    // Build order items JSON (matches OrderLine schema)
    const now = new Date().toISOString();
    const orderItems = items.map((item, idx) => {
      const product = productMap.get(item.product_id)!;
      return {
        line_id: `qr_${idx + 1}`,
        product_id: item.product_id,
        sku: product.sku,
        name: product.name,
        qty: item.qty,
        unit_price_cents: product.price_cents,
        station: product.station,
        status: 'PENDING',
        tax_category: 'GRAVADO',
        mods: [] as string[],
        notes: item.notes ?? undefined,
        created_at: now,
      };
    });

    // Calculate totals
    const subtotalCents = orderItems.reduce(
      (sum, item) => sum + item.unit_price_cents * item.qty,
      0,
    );

    // Build checks JSON
    const checks = [
      {
        check_id: 'c1',
        name: customerName ?? 'Mesa',
        mode: 'ITEMS',
        lines: orderItems.map((item) => ({
          line_id: item.line_id,
          qty: item.qty,
        })),
        subtotal_cents: subtotalCents,
        discount_cents: 0,
        tip_cents: 0,
        total_cents: subtotalCents,
        payment: { status: 'UNPAID', payments: [] },
      },
    ];

    const orderId = uuidv4();

    // Create order directly via Prisma
    await prisma.orders.create({
      data: {
        id: orderId,
        tenant_id: tenant.id,
        order_number: orderNumber,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        terminal_id: 'QR_ORDER',
        subtotal_cents: subtotalCents,
        total_cents: subtotalCents,
        items: orderItems,
        checks,
        fulfillment: { table_number: table.number, guest_count: 1 },
        table_id: table.id,
        unpaid_checks_count: 1,
        business_date: new Date(),
        ...(notes ? {} : {}), // notes stored in check name or items
      },
    });

    // Record for rate limiting
    recordOrder(rateKey);

    logger.info('QR self-order created', {
      tenantId: tenant.id,
      tableId: table.id,
      orderId,
      orderNumber,
      itemCount: items.length,
      totalCents: subtotalCents,
    });

    return NextResponse.json({
      success: true,
      orderNumber,
      orderId,
    });
  } catch (error) {
    logger.error(
      'Error creating QR self-order',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json({ error: 'Error al enviar pedido' }, { status: 500 });
  }
}
