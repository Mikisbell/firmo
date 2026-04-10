/**
 * E2E Database Seeding Helper
 *
 * Seeds test data directly into PostgreSQL via PrismaClient.
 * This runs in Node.js (Playwright's test process), NOT in the browser.
 *
 * NOTE: Uses its own PrismaClient instance (not the app singleton)
 * because E2E tests run in a separate Node.js process from the Next.js server.
 */
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

let prisma: PrismaClient | null = null;

function getClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectDB(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Seed a terminal_number_ranges record so ORDER_CREATED validation passes
 */
export async function seedTerminalRange(
  tenantId: string,
  terminalId: string,
  rangeStart = 1,
  rangeEnd = 99999,
): Promise<void> {
  const db = getClient();
  await db.terminal_number_ranges.upsert({
    where: {
      tenant_id_terminal_id: { tenant_id: tenantId, terminal_id: terminalId },
    },
    create: {
      tenant_id: tenantId,
      terminal_id: terminalId,
      range_start: rangeStart,
      range_end: rangeEnd,
      current_number: rangeStart,
    },
    update: {},
  });
}

/**
 * Seed a shift record directly
 */
export async function seedShift(params: {
  shiftId: string;
  tenantId: string;
  terminalId: string;
  cashOpeningCents: number;
  actorId: string;
  status?: 'OPEN' | 'CLOSED';
  cashCountedCents?: number;
  cashExpectedCents?: number;
  diffCents?: number;
}): Promise<void> {
  const db = getClient();
  // Use a time window so orders created after seeding fall within the shift range
  const openedAt = new Date(Date.now() - 3600_000); // 1 hour ago
  const closedAt = new Date(Date.now() + 3600_000); // 1 hour from now

  await db.shifts.upsert({
    where: { id: params.shiftId },
    create: {
      id: params.shiftId,
      tenant_id: params.tenantId,
      terminal_id: params.terminalId,
      status: params.status || 'OPEN',
      opened_at: openedAt,
      opened_by: params.actorId,
      cash_opening_cents: params.cashOpeningCents,
      cash_expected_cents: params.cashExpectedCents ?? params.cashOpeningCents,
      ...(params.status === 'CLOSED' ? {
        closed_at: closedAt,
        closed_by: params.actorId,
        cash_counted_cents: params.cashCountedCents ?? 0,
        diff_cents: params.diffCents ?? 0,
      } : {}),
    },
    update: {},
  });
}

/**
 * Seed an order record directly
 */
export async function seedOrder(params: {
  orderId: string;
  tenantId: string;
  terminalId: string;
  orderNumber: number;
  shiftId?: string;
  items: Array<{ line_id: string; name: string; unit_price_cents: number; qty: number }>;
  checks: Array<{
    check_id: string;
    lines: Array<{ line_id: string; qty: number }>;
    total_cents: number;
  }>;
}): Promise<void> {
  const db = getClient();
  const totalCents = params.items.reduce((s, i) => s + i.unit_price_cents * i.qty, 0);

  await db.orders.upsert({
    where: { id: params.orderId },
    create: {
      id: params.orderId,
      tenant_id: params.tenantId,
      order_number: params.orderNumber,
      order_type: 'DINE_IN',
      order_status: 'OPEN',
      fulfillment_status: 'COOKING',
      handoff_status: 'WAITING',
      stations_active: [],
      unpaid_checks_count: 0,
      subtotal_cents: totalCents,
      discount_cents: 0,
      total_cents: totalCents,
      items: params.items as any,
      checks: params.checks as any,
      terminal_id: params.terminalId,
      shift_id: params.shiftId ?? null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    update: {},
  });
}

/**
 * Seed a payment record directly
 */
export async function seedPayment(params: {
  paymentId: string;
  tenantId: string;
  orderId: string;
  checkId: string;
  shiftId: string;
  terminalId: string;
  amountCents: number;
  method: string;
  actorId: string;
}): Promise<void> {
  const db = getClient();

  await db.payments.upsert({
    where: { id: params.paymentId },
    create: {
      id: params.paymentId,
      tenant_id: params.tenantId,
      order_id: params.orderId,
      check_id: params.checkId,
      amount_cents: params.amountCents,
      payment_method: params.method,
      status: 'COMPLETED',
      processed_at: new Date(),
      processed_by: params.actorId,
      shift_id: params.shiftId,
      terminal_id: params.terminalId,
    },
    update: {},
  });
}

/**
 * Generate a valid JWT auth token for E2E tests.
 * Uses the same JWT_SECRET and format as the real auth service.
 */
export async function generateTestJWT(params: {
  employeeId: string;
  tenantId: string;
  role: string;
  name?: string;
}): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set in environment');

  const key = new TextEncoder().encode(secret);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  return new SignJWT({
    sub: params.employeeId,
    tid: params.tenantId,
    role: params.role,
    name: params.name || 'E2E Test User',
    sid: `e2e-session-${Date.now()}`,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('park-pos')
    .setAudience('park-pos-client')
    .setExpirationTime(expiresAt)
    .sign(key);
}

/**
 * Creates an order through the event ingestion pipeline.
 *
 * Unlike seedOrder() which writes directly to PostgreSQL (bypassing Dexie),
 * this function sends ORDER_CREATED events through /api/events/ingest,
 * which triggers the full pipeline:
 *
 *   Event → Ingest API → PostgreSQL events → SSE stream → Dexie projections → UI
 *
 * This ensures the order appears in the POS UI because Dexie projections
 * are populated via the SSE stream that listens to ingested events.
 *
 * @param params - Order creation parameters
 * @param baseURL - API base URL (default: http://localhost:3000)
 */
export async function createOrderViaEvents(
  params: {
    tenantId: string;
    terminalId: string;
    orderNumber: number;
    shiftId?: string;
    items: Array<{
      line_id: string;
      name: string;
      unit_price_cents: number;
      qty: number;
      station?: string;
    }>;
    checks: Array<{
      check_id: string;
      lines: Array<{ line_id: string; qty: number }>;
      total_cents: number;
    }>;
  },
  baseURL: string = 'http://localhost:3000',
): Promise<{ orderId: string; accepted: boolean; error?: string }> {
  const { v4: uuidv4 } = await import('uuid');

  const orderId = uuidv4();
  const occurredAt = new Date().toISOString();

  // Build ORDER_CREATED event
  const orderCreatedEvent = {
    event_id: uuidv4(),
    event_type: 'ORDER_CREATED',
    tenant_id: params.tenantId,
    terminal_id: params.terminalId,
    occurred_at: occurredAt,
    aggregate_type: 'ORDER' as const,
    aggregate_id: orderId,
    schema_version: 1,
    terminal_sequence: 0,
    correlation_id: uuidv4(),
    payload: {
      order_id: orderId,
      order_number: params.orderNumber,
      order_type: 'DINE_IN',
      items: params.items.map(item => ({
        line_id: item.line_id,
        name: item.name,
        qty: item.qty,
        unit_price_cents: item.unit_price_cents,
        station: item.station || 'COCINA',
        status: 'PENDING',
      })),
      checks: params.checks,
      total_cents: params.items.reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0),
      subtotal_cents: params.items.reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0),
      discount_cents: 0,
    },
  };

  // Send to ingest API
  const response = await fetch(`${baseURL}/api/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=',
    },
    body: JSON.stringify({
      tenant_id: params.tenantId,
      terminal_id: params.terminalId,
      events: [orderCreatedEvent],
      from_terminal_sequence: 0,
      to_terminal_sequence: 1,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return {
      orderId,
      accepted: false,
      error: result.error?.message || `HTTP ${response.status}`,
    };
  }

  return {
    orderId,
    accepted: true,
  };
}

/**
 * Cleanup test data by tenant + terminal
 *
 * Strategy: Delete ALL tables that reference orders or shifts,
 * in correct dependency order. Uses raw SQL for child tables
 * because Prisma doesn't expose them all as queryable relations.
 *
 * Full dependency graph (from schema.prisma):
 *   delivery_orders  -> orders
 *   invoices         -> orders
 *   order_item_projections -> orders
 *   tips             -> orders
 *   payments         -> shifts
 *   z_reports        -> shifts
 *   orders           -> shifts
 *   shifts           -> (parent)
 */
export async function cleanupTestData(
  tenantId: string,
  terminalId: string,
): Promise<void> {
  const db = getClient();

  // LEVEL 1: Grandchildren (reference orders)
  const childTablesOfOrders = [
    'delivery_orders',
    'invoices',
    'order_item_projections',
    'tips',
  ];

  for (const table of childTablesOfOrders) {
    await db.$executeRawUnsafe(
      `DELETE FROM ${table} WHERE order_id IN (SELECT id FROM orders WHERE tenant_id = $1::uuid AND terminal_id = $2)`,
      tenantId, terminalId,
    );
  }

  // LEVEL 2: orders (children deleted above)
  await db.orders.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });

  // LEVEL 3: Direct children of shifts
  await db.payments.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });

  await db.z_reports.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });

  // LEVEL 4: shifts (parent)
  await db.shifts.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });
}
