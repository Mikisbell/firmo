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
 * Cleanup test data by tenant + terminal
 */
export async function cleanupTestData(
  tenantId: string,
  terminalId: string,
): Promise<void> {
  const db = getClient();

  // Delete in dependency order
  await db.payments.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });
  await db.orders.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });
  await db.z_reports.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });
  await db.shifts.deleteMany({
    where: { tenant_id: tenantId, terminal_id: terminalId },
  });
}
