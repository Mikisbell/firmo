/**
 * Waiter Ranking Service Tests
 *
 * Tests for waiter performance metrics aggregation, sorting, and edge cases.
 *
 * @module core/services/__tests__/waiter-ranking.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WaiterRankingService } from '../waiter-ranking.service';

// ============================================================================
// Mock Prisma
// ============================================================================

const mockPrisma = {
  orders: {
    findMany: vi.fn(),
  },
  employees: {
    findMany: vi.fn(),
  },
} as any;

const service = new WaiterRankingService(mockPrisma);

const TENANT_ID = 'tenant-001';
const PERIOD = {
  start: new Date('2026-02-01'),
  end: new Date('2026-02-28'),
};

// ============================================================================
// Helpers
// ============================================================================

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    waiter_id: 'waiter-1',
    total_cents: 5000,
    order_type: 'DINE_IN',
    checks: [],
    created_at: new Date('2026-02-10T12:00:00Z'),
    updated_at: new Date('2026-02-10T12:30:00Z'),
    ...overrides,
  };
}

function makeEmployee(id: string, name: string, role = 'mozo') {
  return { id, name, role };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// getRankings
// ============================================================================

describe('WaiterRankingService - getRankings', () => {
  it('debe calcular ranking para un mozo con múltiples órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 3000 }),
      makeOrder({ waiter_id: 'w-1', total_cents: 5000 }),
      makeOrder({ waiter_id: 'w-1', total_cents: 2000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan Pérez'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings).toHaveLength(1);
      const r = result.data.rankings[0];
      expect(r.employeeName).toBe('Juan Pérez');
      expect(r.totalOrders).toBe(3);
      expect(r.totalSalesCents).toBe(10000);
      expect(r.averageTicketCents).toBe(3333); // round(10000/3)
    }
  });

  it('debe rankear múltiples mozos por ventas', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 3000 }),
      makeOrder({ waiter_id: 'w-2', total_cents: 8000 }),
      makeOrder({ waiter_id: 'w-3', total_cents: 5000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
      makeEmployee('w-3', 'Carlos'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD, 'sales');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings).toHaveLength(3);
      expect(result.data.rankings[0].employeeName).toBe('María'); // 8000
      expect(result.data.rankings[1].employeeName).toBe('Carlos'); // 5000
      expect(result.data.rankings[2].employeeName).toBe('Juan'); // 3000
    }
  });

  it('debe sortear por órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 1000 }),
      makeOrder({ waiter_id: 'w-1', total_cents: 1000 }),
      makeOrder({ waiter_id: 'w-1', total_cents: 1000 }),
      makeOrder({ waiter_id: 'w-2', total_cents: 9000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD, 'orders');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].employeeName).toBe('Juan'); // 3 orders
      expect(result.data.rankings[1].employeeName).toBe('María'); // 1 order
    }
  });

  it('debe sortear por propinas', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', checks: [{ payment: { tip_cents: 200 } }] }),
      makeOrder({ waiter_id: 'w-2', checks: [{ payment: { tip_cents: 500 } }] }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD, 'tips');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].employeeName).toBe('María'); // 500 tips
      expect(result.data.rankings[0].totalTipsCents).toBe(500);
      expect(result.data.rankings[1].totalTipsCents).toBe(200);
    }
  });

  it('debe sortear por ticket promedio', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 2000 }),
      makeOrder({ waiter_id: 'w-1', total_cents: 2000 }),
      makeOrder({ waiter_id: 'w-2', total_cents: 10000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD, 'avg_ticket');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].employeeName).toBe('María'); // 10000 avg
      expect(result.data.rankings[0].averageTicketCents).toBe(10000);
      expect(result.data.rankings[1].averageTicketCents).toBe(2000);
    }
  });

  it('debe sortear por tiempo promedio (menor es mejor)', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({
        waiter_id: 'w-1',
        created_at: new Date('2026-02-10T12:00:00Z'),
        updated_at: new Date('2026-02-10T13:00:00Z'), // 60 min
      }),
      makeOrder({
        waiter_id: 'w-2',
        created_at: new Date('2026-02-10T12:00:00Z'),
        updated_at: new Date('2026-02-10T12:15:00Z'), // 15 min
      }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Lento'),
      makeEmployee('w-2', 'Rápido'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD, 'avg_time');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].employeeName).toBe('Rápido'); // 15 min
      expect(result.data.rankings[1].employeeName).toBe('Lento'); // 60 min
    }
  });

  it('debe retornar ranking vacío sin órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings).toHaveLength(0);
      expect(result.data.summary.totalWaiters).toBe(0);
      expect(result.data.summary.totalOrdersAll).toBe(0);
      expect(result.data.summary.bestPerformerId).toBeNull();
    }
  });

  it('debe rechazar período inválido (start > end)', async () => {
    const result = await service.getRankings(TENANT_ID, {
      start: new Date('2026-03-01'),
      end: new Date('2026-02-01'),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('fecha');
    }
  });

  it('debe extraer propinas de formato payments array', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({
        waiter_id: 'w-1',
        checks: [{
          payments: [
            { method: 'CASH', amount_cents: 3000, tip_cents: 300 },
            { method: 'YAPE', amount_cents: 2000, tip_cents: 200 },
          ],
        }],
      }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].totalTipsCents).toBe(500); // 300 + 200
    }
  });

  it('debe manejar checks sin propinas', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', checks: [{ payment: { amount_cents: 5000 } }] }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].totalTipsCents).toBe(0);
    }
  });

  it('debe manejar checks null/invalid', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', checks: null }),
      makeOrder({ waiter_id: 'w-1', checks: 'invalid' }),
      makeOrder({ waiter_id: 'w-1', checks: {} }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].totalTipsCents).toBe(0);
      expect(result.data.rankings[0].totalOrders).toBe(3);
    }
  });

  it('debe contar órdenes por tipo correctamente', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', order_type: 'DINE_IN' }),
      makeOrder({ waiter_id: 'w-1', order_type: 'DINE_IN' }),
      makeOrder({ waiter_id: 'w-1', order_type: 'TAKEOUT' }),
      makeOrder({ waiter_id: 'w-1', order_type: 'DELIVERY' }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].ordersByType).toEqual({
        DINE_IN: 2,
        TAKEOUT: 1,
        DELIVERY: 1,
      });
    }
  });

  it('debe calcular summary correctamente', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 3000 }),
      makeOrder({ waiter_id: 'w-2', total_cents: 7000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary.totalWaiters).toBe(2);
      expect(result.data.summary.totalOrdersAll).toBe(2);
      expect(result.data.summary.totalSalesAllCents).toBe(10000);
      expect(result.data.summary.averageTicketAllCents).toBe(5000);
      expect(result.data.summary.bestPerformerId).toBe('w-2'); // María, sorted by sales
    }
  });

  it('debe calcular tiempo servicio promedio', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({
        waiter_id: 'w-1',
        created_at: new Date('2026-02-10T12:00:00Z'),
        updated_at: new Date('2026-02-10T12:20:00Z'), // 20 min
      }),
      makeOrder({
        waiter_id: 'w-1',
        created_at: new Date('2026-02-10T13:00:00Z'),
        updated_at: new Date('2026-02-10T13:40:00Z'), // 40 min
      }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].averageServiceMinutes).toBe(30); // (20+40)/2
    }
  });

  it('debe manejar empleado no encontrado (nombre "Desconocido")', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-ghost' }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([]); // No employees found

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankings[0].employeeName).toBe('Desconocido');
    }
  });

  it('debe incluir período en resultado', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([]);

    const result = await service.getRankings(TENANT_ID, PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period.start).toBe(PERIOD.start.toISOString());
      expect(result.data.period.end).toBe(PERIOD.end.toISOString());
    }
  });
});

// ============================================================================
// getWaiterDetail
// ============================================================================

describe('WaiterRankingService - getWaiterDetail', () => {
  it('debe retornar métricas de un mozo específico', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1', total_cents: 3000 }),
      makeOrder({ waiter_id: 'w-2', total_cents: 7000 }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
      makeEmployee('w-2', 'María'),
    ]);

    const result = await service.getWaiterDetail(TENANT_ID, 'w-1', PERIOD);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.employeeId).toBe('w-1');
      expect(result.data.employeeName).toBe('Juan');
      expect(result.data.totalSalesCents).toBe(3000);
    }
  });

  it('debe retornar error si mozo no tiene órdenes', async () => {
    mockPrisma.orders.findMany.mockResolvedValueOnce([
      makeOrder({ waiter_id: 'w-1' }),
    ]);
    mockPrisma.employees.findMany.mockResolvedValueOnce([
      makeEmployee('w-1', 'Juan'),
    ]);

    const result = await service.getWaiterDetail(TENANT_ID, 'w-999', PERIOD);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('w-999');
    }
  });
});
