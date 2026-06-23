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
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';
import type { ParkEvent } from '@/src/core/domain/events';
import { markAsProcessed } from '@/src/core/events/mark-processed';
import { projectEvent } from '@/src/core/events/project-event';

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

    // El status VIVO de cada item vive en order_item_projections (lo actualiza la
    // cocina vía ORDER_ITEM_STATUS_CHANGED). El JSON orders.items se queda en el
    // estado inicial, así que el cliente NUNCA veía READY/DONE. Leemos la
    // proyección y la usamos como fuente de verdad del estado (fallback al JSON si
    // todavía no hay fila proyectada, p.ej. un item recién agregado).
    const orderIds = orders.map((o) => o.id);
    const projections = orderIds.length
      ? await prisma.order_item_projections.findMany({
          where: { tenant_id: tenant.id, order_id: { in: orderIds } },
          select: { order_id: true, line_id: true, status: true },
        })
      : [];
    const statusByLine = new Map(
      projections.map((p) => [`${p.order_id}:${p.line_id}`, p.status]),
    );

    // Transform items for public display (strip internal fields)
    const publicOrders = orders.map((order) => {
      const rawItems = (order.items as unknown as OrderItem[]) ?? [];
      const items = rawItems
        .filter((item) => item.status !== 'VOIDED')
        .map((item) => ({
          name: item.name,
          qty: item.qty,
          total_cents: item.line_total_cents,
          // Fuente viva: la proyección; fallback al status del JSON inicial.
          status: statusByLine.get(`${order.id}:${item.line_id}`) ?? item.status,
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

    // Build order item lines (matches OrderLineSchema en domain/events.ts).
    // line_ids `qr_N` se preservan (consumidos por el KDS/proyección).
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
        station: product.station ?? 'COCINA',
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

    // Build checks JSON (mismo formato que el POS)
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
    const terminalId = 'QR_ORDER';
    const fulfillment = { table_number: table.number, guest_count: 1 };

    // ════════════════════════════════════════════════════════════════════════
    // EVENT SOURCING: el portal QR entra por la MISMA arquitectura que el POS.
    //
    // Antes: `prisma.orders.create` DIRECTO metía los items en orders.items[]
    // SIN emitir eventos ni proyectar a order_item_projections → los items eran
    // INVISIBLES para el KDS y /api/pos/ready-items, y su status NUNCA podía
    // progresar (ORDER_ITEM_STATUS_CHANGED hace UPDATE WHERE order_id+line_id →
    // 0 filas). Ver Engram bugs/qr-portal-bypasses-event-sourcing.
    //
    // Ahora: emitimos ORDER_CREATED (items:[] + checks) + N ORDER_ITEM_ADDED,
    // los proyectamos vía `projectEvent` (que INSERTA en order_item_projections)
    // y persistimos cada evento en la tabla `events`. El handler ORDER_CREATED
    // crea la orden; cada ORDER_ITEM_ADDED agrega la línea al JSON + proyecta.
    //
    // SEGURIDAD: el QR es PÚBLICO. tenant_id se resuelve server-side por slug
    // (confiable, NUNCA del cliente). actor_id = null (sin sesión). El
    // ORDER_CREATED no maneja table_id/fulfillment/business_date, así que las
    // seteamos en un UPDATE final dentro de la misma transacción (preserva el
    // comportamiento del create directo: la GET del QR filtra por table_id).
    // ════════════════════════════════════════════════════════════════════════

    function baseEnvelope(eventType: string): Omit<ParkEvent, 'payload' | 'event_type'> {
      return {
        event_id: uuidv4(),
        tenant_id: tenant!.id,
        terminal_id: terminalId,
        terminal_sequence: 0,
        occurred_at: now,
        aggregate_type: 'ORDER',
        aggregate_id: orderId,
        correlation_id: orderId,
        causation_id: null,
        actor_id: null,
        actor_role_snapshot: null,
        schema_version: 1,
        payload_version: 1,
        shift_id: null,
        business_date: null,
      } as Omit<ParkEvent, 'payload' | 'event_type'>;
    }

    const orderCreatedEvent = {
      ...baseEnvelope('ORDER_CREATED'),
      event_type: 'ORDER_CREATED',
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        order_type: 'DINE_IN',
        items: [], // el POS también nace vacío; las líneas entran por ITEM_ADDED
        checks,
        fulfillment,
      },
    } as ParkEvent;

    const itemAddedEvents = orderItems.map(
      (line) =>
        ({
          ...baseEnvelope('ORDER_ITEM_ADDED'),
          event_type: 'ORDER_ITEM_ADDED',
          payload: { order_id: orderId, line },
        }) as ParkEvent,
    );

    const orderEvents: ParkEvent[] = [orderCreatedEvent, ...itemAddedEvents];

    await prisma.$transaction(async (tx) => {
      for (const ev of orderEvents) {
        // Dedup (idempotencia por processed_events). Sin esto, dos commits con
        // el mismo event_id duplicarían proyección. Los event_ids son uuid v4
        // generados aquí, así que en condiciones normales nunca son duplicados.
        const { isDuplicate } = await markAsProcessed(tx, ev);
        if (isDuplicate) continue;

        // Proyecta al read-model (crea la orden / inserta order_item_projections).
        const projected = await projectEvent(tx, ev);
        if (!projected) {
          // projectEvent ya logueó; abortamos la transacción para no dejar la
          // orden a medio proyectar (consistencia).
          throw new Error(`PROJECTION_FAILED:${ev.event_type}`);
        }

        // Persiste el evento en el event store (mismos campos que el ingest).
        await tx.events.create({
          data: {
            id: ev.event_id,
            tenant_id: ev.tenant_id,
            occurred_at: new Date(ev.occurred_at),
            type: ev.event_type,
            entity_type: ev.aggregate_type,
            entity_id: ev.aggregate_id,
            actor_id: ev.actor_id ?? null,
            actor_role_snapshot: ev.actor_role_snapshot ?? null,
            terminal_id: ev.terminal_id,
            payload_version: ev.payload_version,
            payload: ev.payload as Prisma.InputJsonValue,
          },
        });

        // Columnas QR-específicas que el handler ORDER_CREATED no setea (preserva
        // el comportamiento del create directo): table_id (la GET del QR filtra
        // por él), fulfillment y business_date. Se aplica JUSTO DESPUÉS de
        // ORDER_CREATED y ANTES de los ORDER_ITEM_ADDED, porque la proyección de
        // ITEM_ADDED lee order.fulfillment.table_number para poblar
        // order_item_projections.table_number (que ve el KDS/mozo).
        if (ev.event_type === 'ORDER_CREATED') {
          await tx.orders.update({
            where: { id: orderId },
            data: {
              table_id: table.id,
              fulfillment: fulfillment as Prisma.InputJsonValue,
              business_date: new Date(),
            },
          });
        }
      }
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
