/**
 * Dashboard Service Tests
 *
 * @module core/services/__tests__/dashboard.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../dashboard.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    orders: {
      findMany: vi.fn(),
    },
    payments: {
      findMany: vi.fn(),
    },
    events: {
      findMany: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: DashboardService;

const TENANT = 'tenant-1';
const TODAY = new Date('2026-02-20T12:00:00Z');

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new DashboardService(mockPrisma as any);
});

// ============================================================================
// getDailyKPIs
// ============================================================================

describe('getDailyKPIs', () => {
  it('debe calcular KPIs con órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValue([
      {
        total_cents: 5000,
        items: [
          { product_id: 'p1', name: 'Pollo a la Brasa', qty: 1, unit_price_cents: 3500 },
          { product_id: 'p2', name: 'Papas', qty: 2, unit_price_cents: 750 },
        ],
        created_at: new Date('2026-02-20T12:00:00Z'),
      },
      {
        total_cents: 8500,
        items: [
          { product_id: 'p1', name: 'Pollo a la Brasa', qty: 2, unit_price_cents: 3500 },
        ],
        created_at: new Date('2026-02-20T14:00:00Z'),
      },
    ]);
    mockPrisma.payments.findMany.mockResolvedValue([
      { amount_cents: 5000, payment_method: 'CASH' },
      { amount_cents: 8500, payment_method: 'YAPE' },
    ]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ordersCount).toBe(2);
      expect(result.data.grossSalesCents).toBe(13500);
      expect(result.data.avgTicketCents).toBe(6750);
      expect(result.data.topProducts).toHaveLength(2);
      expect(result.data.topProducts[0].name).toBe('Pollo a la Brasa');
      expect(result.data.topProducts[0].qty).toBe(3);
      expect(result.data.paymentBreakdown.CASH).toEqual({ count: 1, totalCents: 5000 });
      expect(result.data.paymentBreakdown.YAPE).toEqual({ count: 1, totalCents: 8500 });
    }
  });

  it('debe retornar KPIs vacíos para día sin órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValue([]);
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ordersCount).toBe(0);
      expect(result.data.grossSalesCents).toBe(0);
      expect(result.data.avgTicketCents).toBe(0);
      expect(result.data.topProducts).toHaveLength(0);
      expect(result.data.paymentBreakdown).toEqual({});
    }
  });

  it('debe calcular avgTicket correctamente', async () => {
    mockPrisma.orders.findMany.mockResolvedValue([
      { total_cents: 3000, items: [], created_at: TODAY },
      { total_cents: 5000, items: [], created_at: TODAY },
      { total_cents: 7000, items: [], created_at: TODAY },
    ]);
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avgTicketCents).toBe(5000); // 15000 / 3
    }
  });

  it('debe ordenar top products por revenue', async () => {
    mockPrisma.orders.findMany.mockResolvedValue([
      {
        total_cents: 10000,
        items: [
          { product_id: 'p1', name: 'Barato', qty: 10, unit_price_cents: 100 },
          { product_id: 'p2', name: 'Caro', qty: 1, unit_price_cents: 9000 },
        ],
        created_at: TODAY,
      },
    ]);
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topProducts[0].name).toBe('Caro');
      expect(result.data.topProducts[0].revenueCents).toBe(9000);
    }
  });

  it('debe calcular distribución por hora', async () => {
    const dateA = new Date('2026-02-20T10:30:00Z');
    const dateB = new Date('2026-02-20T10:45:00Z');
    const dateC = new Date('2026-02-20T15:00:00Z');
    const hourA = dateA.getHours(); // depends on local TZ
    const hourC = dateC.getHours();

    mockPrisma.orders.findMany.mockResolvedValue([
      { total_cents: 3000, items: [], created_at: dateA },
      { total_cents: 5000, items: [], created_at: dateB },
      { total_cents: 4000, items: [], created_at: dateC },
    ]);
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hourlySales[hourA]).toBe(8000);
      expect(result.data.hourlySales[hourC]).toBe(4000);
      expect(result.data.hourlySales.length).toBe(24);
    }
  });

  it('debe manejar breakdown múltiples métodos', async () => {
    mockPrisma.orders.findMany.mockResolvedValue([]);
    mockPrisma.payments.findMany.mockResolvedValue([
      { amount_cents: 5000, payment_method: 'CASH' },
      { amount_cents: 3000, payment_method: 'CASH' },
      { amount_cents: 8500, payment_method: 'YAPE' },
      { amount_cents: 12000, payment_method: 'CARD' },
    ]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentBreakdown.CASH).toEqual({ count: 2, totalCents: 8000 });
      expect(result.data.paymentBreakdown.YAPE).toEqual({ count: 1, totalCents: 8500 });
      expect(result.data.paymentBreakdown.CARD).toEqual({ count: 1, totalCents: 12000 });
    }
  });

  it('debe limitar top products a 5', async () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      product_id: `p${i}`, name: `Product ${i}`, qty: 1, unit_price_cents: (8 - i) * 1000,
    }));
    mockPrisma.orders.findMany.mockResolvedValue([
      { total_cents: 36000, items, created_at: TODAY },
    ]);
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.getDailyKPIs(TENANT, TODAY);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topProducts).toHaveLength(5);
    }
  });
});

// ============================================================================
// getRecentActivity
// ============================================================================

describe('getRecentActivity', () => {
  it('debe formatear eventos como actividad', async () => {
    mockPrisma.events.findMany.mockResolvedValue([
      {
        id: 'e1', type: 'ORDER_CREATED',
        payload: { order_number: 42, order_type: 'DINE_IN' },
        occurred_at: new Date('2026-02-20T12:00:00Z'),
      },
      {
        id: 'e2', type: 'SHIFT_OPENED',
        payload: { cash_opening_cents: 20000 },
        occurred_at: new Date('2026-02-20T08:00:00Z'),
      },
      {
        id: 'e3', type: 'CHECK_MARKED_PAID',
        payload: { order_id: 'abcdef12-3456-7890-abcd-ef1234567890' },
        occurred_at: new Date('2026-02-20T12:30:00Z'),
      },
    ]);

    const result = await service.getRecentActivity(TENANT, 5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].message).toContain('#42');
      expect(result.data[1].message).toContain('Turno abierto');
      expect(result.data[1].message).toContain('200.00');
      expect(result.data[2].message).toContain('Pago confirmado');
    }
  });

  it('debe retornar vacío sin eventos', async () => {
    mockPrisma.events.findMany.mockResolvedValue([]);

    const result = await service.getRecentActivity(TENANT, 5);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('debe respetar limit', async () => {
    mockPrisma.events.findMany.mockResolvedValue([]);

    await service.getRecentActivity(TENANT, 3);

    expect(mockPrisma.events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });

  it('debe filtrar por tenant', async () => {
    mockPrisma.events.findMany.mockResolvedValue([]);

    await service.getRecentActivity('other-tenant');

    expect(mockPrisma.events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'other-tenant' }),
      }),
    );
  });

  it('debe formatear INVOICE_ISSUED', async () => {
    mockPrisma.events.findMany.mockResolvedValue([
      {
        id: 'e1', type: 'INVOICE_ISSUED',
        payload: { invoice_type: 'BOLETA', total_cents: 5000 },
        occurred_at: new Date('2026-02-20T13:00:00Z'),
      },
    ]);

    const result = await service.getRecentActivity(TENANT);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].message).toContain('BOLETA');
      expect(result.data[0].message).toContain('50.00');
    }
  });
});
