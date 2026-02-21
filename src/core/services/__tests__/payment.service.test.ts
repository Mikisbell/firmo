/**
 * Payment Service Tests
 *
 * @module core/services/__tests__/payment.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentService } from '../payment.service';

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('@/src/core/cache/redis.service', () => ({
  CacheService: class {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (_prisma: any, fn: any) => fn(_prisma)),
}));

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    events: {
      create: vi.fn().mockResolvedValue({}),
    },
    payments: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: PaymentService;

const TENANT = 'tenant-1';
const ORDER = 'order-1';
const CHECK = 'check-1';
const ACTOR = 'actor-1';
const TERMINAL = 'term-1';
const SHIFT = 'shift-1';

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new PaymentService(mockPrisma as any);
});

// ============================================================================
// processPayment
// ============================================================================

describe('processPayment', () => {
  const baseInput = {
    orderId: ORDER,
    checkId: CHECK,
    amountCents: 5000,
    method: 'CASH' as const,
    tenantId: TENANT,
    actorId: ACTOR,
    terminalId: TERMINAL,
    shiftId: SHIFT,
  };

  it('debe procesar pago exitosamente', async () => {
    const result = await service.processPayment(baseInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderId).toBe(ORDER);
      expect(result.data.checkId).toBe(CHECK);
      expect(result.data.amountCents).toBe(5000);
      expect(result.data.method).toBe('CASH');
      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.paymentId).toBeDefined();
    }
  });

  it('debe rechazar monto <= 0', async () => {
    const result = await service.processPayment({ ...baseInput, amountCents: 0 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('greater than 0');
    }
  });

  it('debe rechazar monto negativo', async () => {
    const result = await service.processPayment({ ...baseInput, amountCents: -100 });

    expect(result.success).toBe(false);
  });

  it('debe crear evento CHECK_PAYMENT_ADDED', async () => {
    await service.processPayment(baseInput);

    expect(mockPrisma.events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'CHECK_PAYMENT_ADDED',
        entity_type: 'ORDER',
        entity_id: ORDER,
        tenant_id: TENANT,
        terminal_id: TERMINAL,
        shift_id: SHIFT,
      }),
    });
  });

  it('debe procesar pago CARD', async () => {
    const result = await service.processPayment({
      ...baseInput,
      method: 'CARD' as any,
      reference: 'VISA-1234',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('CARD');
      expect(result.data.reference).toBe('VISA-1234');
    }
  });

  it('debe procesar pago YAPE', async () => {
    const result = await service.processPayment({
      ...baseInput,
      method: 'YAPE' as any,
      reference: 'YPE-9876',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('YAPE');
    }
  });

  it('debe procesar pago PLIN', async () => {
    const result = await service.processPayment({
      ...baseInput,
      method: 'PLIN' as any,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.method).toBe('PLIN');
    }
  });

  it('debe manejar error de BD', async () => {
    mockPrisma.events.create.mockRejectedValueOnce(new Error('DB down'));

    const result = await service.processPayment(baseInput);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Failed to process payment');
    }
  });
});

// ============================================================================
// voidPayment
// ============================================================================

describe('voidPayment', () => {
  it('debe anular pago exitosamente', async () => {
    const result = await service.voidPayment({
      paymentId: 'pay-1',
      reason: 'Cliente canceló',
      tenantId: TENANT,
      actorId: ACTOR,
      terminalId: TERMINAL,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentId).toBe('pay-1');
      expect(result.data.reason).toBe('Cliente canceló');
    }
  });

  it('debe crear evento PAYMENT_VOIDED', async () => {
    await service.voidPayment({
      paymentId: 'pay-1',
      reason: 'Error de cajero',
      tenantId: TENANT,
      actorId: ACTOR,
      terminalId: TERMINAL,
    });

    expect(mockPrisma.events.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'PAYMENT_VOIDED',
        entity_type: 'PAYMENT',
        entity_id: 'pay-1',
      }),
    });
  });
});

// ============================================================================
// getPaymentsByShift
// ============================================================================

describe('getPaymentsByShift', () => {
  it('debe retornar pagos del turno', async () => {
    const payments = [
      { id: 'p1', amount_cents: 5000, payment_method: 'CASH' },
      { id: 'p2', amount_cents: 3000, payment_method: 'YAPE' },
    ];
    mockPrisma.payments.findMany.mockResolvedValue(payments);

    const result = await service.getPaymentsByShift(TENANT, SHIFT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    expect(mockPrisma.payments.findMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT, shift_id: SHIFT },
      orderBy: { processed_at: 'asc' },
    });
  });

  it('debe retornar array vacío sin pagos', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getPaymentsByShift(TENANT, SHIFT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});

// ============================================================================
// getPaymentsByOrder
// ============================================================================

describe('getPaymentsByOrder', () => {
  it('debe retornar pagos de la orden', async () => {
    const payments = [
      { id: 'p1', amount_cents: 5000, payment_method: 'CASH' },
    ];
    mockPrisma.payments.findMany.mockResolvedValue(payments);

    const result = await service.getPaymentsByOrder(TENANT, ORDER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
    expect(mockPrisma.payments.findMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT, order_id: ORDER },
      orderBy: { processed_at: 'asc' },
    });
  });
});

// ============================================================================
// getPaymentSummary
// ============================================================================

describe('getPaymentSummary', () => {
  it('debe calcular breakdown por método', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([
      { id: 'p1', amount_cents: 5000, payment_method: 'CASH', status: 'COMPLETED' },
      { id: 'p2', amount_cents: 3000, payment_method: 'CASH', status: 'COMPLETED' },
      { id: 'p3', amount_cents: 8500, payment_method: 'YAPE', status: 'COMPLETED' },
      { id: 'p4', amount_cents: 12000, payment_method: 'CARD', status: 'COMPLETED' },
    ]);

    const result = await service.getPaymentSummary(TENANT, SHIFT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalPayments).toBe(4);
      expect(result.data.totalCents).toBe(28500);
      expect(result.data.breakdown.CASH).toEqual({ count: 2, totalCents: 8000 });
      expect(result.data.breakdown.YAPE).toEqual({ count: 1, totalCents: 8500 });
      expect(result.data.breakdown.CARD).toEqual({ count: 1, totalCents: 12000 });
    }
  });

  it('debe retornar summary vacío sin pagos', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getPaymentSummary(TENANT, SHIFT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalPayments).toBe(0);
      expect(result.data.totalCents).toBe(0);
      expect(result.data.breakdown).toEqual({});
    }
  });

  it('debe aislar por tenant', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([]);

    await service.getPaymentSummary('other-tenant', SHIFT);

    expect(mockPrisma.payments.findMany).toHaveBeenCalledWith({
      where: { tenant_id: 'other-tenant', shift_id: SHIFT, status: 'COMPLETED' },
    });
  });
});
