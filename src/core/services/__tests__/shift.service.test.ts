/**
 * Shift Service Tests
 *
 * @module core/services/__tests__/shift.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShiftService } from '../shift.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    shifts: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    payments: {
      findMany: vi.fn(),
    },
    orders: {
      count: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: ShiftService;

const TENANT = 'tenant-1';
const TERMINAL = 'term-1';
const SHIFT_ID = 'shift-1';

const mockShift = {
  id: SHIFT_ID,
  tenant_id: TENANT,
  terminal_id: TERMINAL,
  status: 'OPEN',
  opened_at: new Date('2026-02-20T08:00:00Z'),
  closed_at: null,
  opened_by: 'emp-1',
  closed_by: null,
  cash_opening_cents: 20000,
  cash_expected_cents: null,
  cash_counted_cents: null,
  diff_cents: null,
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new ShiftService(mockPrisma as any);
});

// ============================================================================
// getActiveShift
// ============================================================================

describe('getActiveShift', () => {
  it('debe retornar turno activo', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(mockShift);

    const result = await service.getActiveShift(TENANT, TERMINAL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(SHIFT_ID);
      expect(result.data.status).toBe('OPEN');
    }
    expect(mockPrisma.shifts.findFirst).toHaveBeenCalledWith({
      where: { tenant_id: TENANT, terminal_id: TERMINAL, status: 'OPEN' },
      orderBy: { opened_at: 'desc' },
    });
  });

  it('debe retornar null si no hay turno activo', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(null);

    const result = await service.getActiveShift(TENANT, TERMINAL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('debe filtrar por terminal correcto', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(null);

    await service.getActiveShift(TENANT, 'other-term');

    expect(mockPrisma.shifts.findFirst).toHaveBeenCalledWith({
      where: { tenant_id: TENANT, terminal_id: 'other-term', status: 'OPEN' },
      orderBy: { opened_at: 'desc' },
    });
  });
});

// ============================================================================
// getShiftSummary
// ============================================================================

describe('getShiftSummary', () => {
  it('debe retornar resumen con pagos', async () => {
    mockPrisma.shifts.findUnique.mockResolvedValue(mockShift);
    mockPrisma.payments.findMany.mockResolvedValue([
      { id: 'p1', amount_cents: 5000, payment_method: 'CASH', status: 'COMPLETED' },
      { id: 'p2', amount_cents: 3000, payment_method: 'CASH', status: 'COMPLETED' },
      { id: 'p3', amount_cents: 8500, payment_method: 'YAPE', status: 'COMPLETED' },
    ]);
    mockPrisma.orders.count.mockResolvedValue(5);

    const result = await service.getShiftSummary(TENANT, SHIFT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shiftId).toBe(SHIFT_ID);
      expect(result.data.ordersCount).toBe(5);
      expect(result.data.totalSalesCents).toBe(16500);
      expect(result.data.paymentBreakdown.CASH).toEqual({ count: 2, totalCents: 8000 });
      expect(result.data.paymentBreakdown.YAPE).toEqual({ count: 1, totalCents: 8500 });
      expect(result.data.cashOpeningCents).toBe(20000);
    }
  });

  it('debe retornar resumen vacío sin pagos', async () => {
    mockPrisma.shifts.findUnique.mockResolvedValue(mockShift);
    mockPrisma.payments.findMany.mockResolvedValue([]);
    mockPrisma.orders.count.mockResolvedValue(0);

    const result = await service.getShiftSummary(TENANT, SHIFT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalSalesCents).toBe(0);
      expect(result.data.ordersCount).toBe(0);
      expect(result.data.paymentBreakdown).toEqual({});
    }
  });

  it('debe retornar error si turno no existe', async () => {
    mockPrisma.shifts.findUnique.mockResolvedValue(null);

    const result = await service.getShiftSummary(TENANT, 'nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('no encontrado');
    }
  });

  it('debe rechazar turno de otro tenant', async () => {
    mockPrisma.shifts.findUnique.mockResolvedValue({
      ...mockShift,
      tenant_id: 'other-tenant',
    });

    const result = await service.getShiftSummary(TENANT, SHIFT_ID);

    expect(result.success).toBe(false);
  });

  it('debe incluir turno cerrado con datos de cierre', async () => {
    const closedShift = {
      ...mockShift,
      status: 'CLOSED',
      closed_at: new Date('2026-02-20T18:00:00Z'),
      closed_by: 'emp-1',
      cash_expected_cents: 45000,
      cash_counted_cents: 44500,
      diff_cents: -500,
    };
    mockPrisma.shifts.findUnique.mockResolvedValue(closedShift);
    mockPrisma.payments.findMany.mockResolvedValue([]);
    mockPrisma.orders.count.mockResolvedValue(12);

    const result = await service.getShiftSummary(TENANT, SHIFT_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('CLOSED');
      expect(result.data.cashExpectedCents).toBe(45000);
      expect(result.data.cashCountedCents).toBe(44500);
      expect(result.data.diffCents).toBe(-500);
    }
  });
});

// ============================================================================
// getShiftHistory
// ============================================================================

describe('getShiftHistory', () => {
  it('debe retornar historial ordenado', async () => {
    const shifts = [
      { ...mockShift, id: 'shift-3', opened_at: new Date('2026-02-20T08:00:00Z') },
      { ...mockShift, id: 'shift-2', opened_at: new Date('2026-02-19T08:00:00Z') },
      { ...mockShift, id: 'shift-1', opened_at: new Date('2026-02-18T08:00:00Z') },
    ];
    mockPrisma.shifts.findMany.mockResolvedValue(shifts);

    const result = await service.getShiftHistory(TENANT, TERMINAL, 10);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
    expect(mockPrisma.shifts.findMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT, terminal_id: TERMINAL },
      orderBy: { opened_at: 'desc' },
      take: 10,
    });
  });

  it('debe respetar limit', async () => {
    mockPrisma.shifts.findMany.mockResolvedValue([mockShift]);

    await service.getShiftHistory(TENANT, TERMINAL, 5);

    expect(mockPrisma.shifts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('debe filtrar por terminal', async () => {
    mockPrisma.shifts.findMany.mockResolvedValue([]);

    await service.getShiftHistory(TENANT, 'term-other');

    expect(mockPrisma.shifts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT, terminal_id: 'term-other' },
      }),
    );
  });

  it('debe usar limit default de 10', async () => {
    mockPrisma.shifts.findMany.mockResolvedValue([]);

    await service.getShiftHistory(TENANT, TERMINAL);

    expect(mockPrisma.shifts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
