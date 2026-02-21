/**
 * Reconciliation Service Tests
 *
 * @module core/services/__tests__/reconciliation.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconciliationService } from '../reconciliation.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    payments: { findMany: vi.fn() },
    payment_settlements: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: ReconciliationService;

const TENANT = 'tenant-1';
const period = { start: new Date('2026-02-01'), end: new Date('2026-02-07') };

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new ReconciliationService(mockPrisma as any);
});

// ============================================================================
// generateSettlementPeriod
// ============================================================================

describe('generateSettlementPeriod', () => {
  it('debe generar liquidaciones por método de pago', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([
      { payment_method: 'CASH', amount_cents: 50000 },
      { payment_method: 'CASH', amount_cents: 30000 },
      { payment_method: 'YAPE', amount_cents: 25000 },
      { payment_method: 'CARD', amount_cents: 40000 },
    ]);
    mockPrisma.payment_settlements.findUnique.mockResolvedValue(null);
    mockPrisma.payment_settlements.create.mockImplementation(({ data }: any) => ({
      ...data,
      created_at: new Date(),
    }));

    const result = await service.generateSettlementPeriod(TENANT, period.start, period.end);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
      const cash = result.data.find((s) => s.paymentMethod === 'CASH');
      expect(cash?.expectedCents).toBe(80000);
      const yape = result.data.find((s) => s.paymentMethod === 'YAPE');
      expect(yape?.expectedCents).toBe(25000);
    }
  });

  it('debe retornar vacío si no hay pagos', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([]);

    const result = await service.generateSettlementPeriod(TENANT, period.start, period.end);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });

  it('debe rechazar período inválido', async () => {
    const result = await service.generateSettlementPeriod(
      TENANT,
      new Date('2026-03-01'),
      new Date('2026-02-01'),
    );
    expect(result.success).toBe(false);
  });

  it('debe reusar liquidación existente', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([
      { payment_method: 'CASH', amount_cents: 50000 },
    ]);
    mockPrisma.payment_settlements.findUnique.mockResolvedValue({
      id: 'existing-1',
      tenant_id: TENANT,
      period_start: period.start,
      period_end: period.end,
      payment_method: 'CASH',
      expected_cents: 50000,
      received_cents: 50000,
      difference_cents: 0,
      status: 'MATCHED',
      notes: null,
      reconciled_by: 'admin-1',
      reconciled_at: new Date(),
      created_at: new Date(),
    });

    const result = await service.generateSettlementPeriod(TENANT, period.start, period.end);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].status).toBe('MATCHED');
    }
    expect(mockPrisma.payment_settlements.create).not.toHaveBeenCalled();
  });

  it('debe crear liquidaciones con status PENDING', async () => {
    mockPrisma.payments.findMany.mockResolvedValue([
      { payment_method: 'CARD', amount_cents: 10000 },
    ]);
    mockPrisma.payment_settlements.findUnique.mockResolvedValue(null);
    mockPrisma.payment_settlements.create.mockImplementation(({ data }: any) => ({
      ...data,
      received_cents: null,
      difference_cents: null,
      notes: null,
      reconciled_by: null,
      reconciled_at: null,
      created_at: new Date(),
    }));

    const result = await service.generateSettlementPeriod(TENANT, period.start, period.end);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].status).toBe('PENDING');
      expect(result.data[0].receivedCents).toBeNull();
    }
  });
});

// ============================================================================
// recordActualReceived
// ============================================================================

describe('recordActualReceived', () => {
  it('debe registrar monto exacto como MATCHED', async () => {
    mockPrisma.payment_settlements.findFirst.mockResolvedValue({
      id: 's-1',
      tenant_id: TENANT,
      expected_cents: 50000,
    });
    mockPrisma.payment_settlements.update.mockImplementation(({ data }: any) => ({
      id: 's-1',
      tenant_id: TENANT,
      period_start: period.start,
      period_end: period.end,
      payment_method: 'CASH',
      expected_cents: 50000,
      ...data,
      created_at: new Date(),
    }));

    const result = await service.recordActualReceived(TENANT, 's-1', 50000, 'admin-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('MATCHED');
      expect(result.data.differenceCents).toBe(0);
    }
  });

  it('debe detectar discrepancia cuando monto difiere', async () => {
    mockPrisma.payment_settlements.findFirst.mockResolvedValue({
      id: 's-1',
      tenant_id: TENANT,
      expected_cents: 50000,
    });
    mockPrisma.payment_settlements.update.mockImplementation(({ data }: any) => ({
      id: 's-1',
      tenant_id: TENANT,
      period_start: period.start,
      period_end: period.end,
      payment_method: 'CASH',
      expected_cents: 50000,
      ...data,
      created_at: new Date(),
    }));

    const result = await service.recordActualReceived(TENANT, 's-1', 48000, 'admin-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('DISCREPANCY');
      expect(result.data.differenceCents).toBe(2000); // expected - received
    }
  });

  it('debe detectar discrepancia negativa (más de lo esperado)', async () => {
    mockPrisma.payment_settlements.findFirst.mockResolvedValue({
      id: 's-1',
      tenant_id: TENANT,
      expected_cents: 50000,
    });
    mockPrisma.payment_settlements.update.mockImplementation(({ data }: any) => ({
      id: 's-1',
      tenant_id: TENANT,
      period_start: period.start,
      period_end: period.end,
      payment_method: 'CASH',
      expected_cents: 50000,
      ...data,
      created_at: new Date(),
    }));

    const result = await service.recordActualReceived(TENANT, 's-1', 52000, 'admin-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.differenceCents).toBe(-2000);
    }
  });

  it('debe rechazar monto negativo', async () => {
    const result = await service.recordActualReceived(TENANT, 's-1', -100, 'admin-1');
    expect(result.success).toBe(false);
  });

  it('debe retornar error si no existe', async () => {
    mockPrisma.payment_settlements.findFirst.mockResolvedValue(null);
    const result = await service.recordActualReceived(TENANT, 's-999', 50000, 'admin-1');
    expect(result.success).toBe(false);
  });

  it('debe guardar notas', async () => {
    mockPrisma.payment_settlements.findFirst.mockResolvedValue({
      id: 's-1',
      tenant_id: TENANT,
      expected_cents: 50000,
    });
    mockPrisma.payment_settlements.update.mockImplementation(({ data }: any) => ({
      id: 's-1',
      tenant_id: TENANT,
      period_start: period.start,
      period_end: period.end,
      payment_method: 'CASH',
      expected_cents: 50000,
      ...data,
      created_at: new Date(),
    }));

    const result = await service.recordActualReceived(TENANT, 's-1', 48000, 'admin-1', 'Faltante de S/ 20');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe('Faltante de S/ 20');
    }
  });
});

// ============================================================================
// getSettlements
// ============================================================================

describe('getSettlements', () => {
  it('debe retornar lista de liquidaciones', async () => {
    mockPrisma.payment_settlements.findMany.mockResolvedValue([
      {
        id: 's-1',
        tenant_id: TENANT,
        period_start: period.start,
        period_end: period.end,
        payment_method: 'CASH',
        expected_cents: 50000,
        received_cents: 50000,
        difference_cents: 0,
        status: 'MATCHED',
        notes: null,
        reconciled_by: 'admin-1',
        reconciled_at: new Date(),
        created_at: new Date(),
      },
    ]);

    const result = await service.getSettlements(TENANT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].paymentMethod).toBe('CASH');
    }
  });

  it('debe filtrar por status', async () => {
    mockPrisma.payment_settlements.findMany.mockResolvedValue([]);
    await service.getSettlements(TENANT, { status: 'DISCREPANCY' });
    expect(mockPrisma.payment_settlements.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'DISCREPANCY' }),
      }),
    );
  });

  it('debe filtrar por método', async () => {
    mockPrisma.payment_settlements.findMany.mockResolvedValue([]);
    await service.getSettlements(TENANT, { paymentMethod: 'YAPE' });
    expect(mockPrisma.payment_settlements.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ payment_method: 'YAPE' }),
      }),
    );
  });
});

// ============================================================================
// getDiscrepancyReport
// ============================================================================

describe('getDiscrepancyReport', () => {
  it('debe generar reporte de discrepancias', async () => {
    mockPrisma.payment_settlements.findMany.mockResolvedValue([
      {
        id: 's-1', tenant_id: TENANT, period_start: period.start, period_end: period.end,
        payment_method: 'CASH', expected_cents: 80000, received_cents: 80000,
        difference_cents: 0, status: 'MATCHED', notes: null,
        reconciled_by: 'admin-1', reconciled_at: new Date(), created_at: new Date(),
      },
      {
        id: 's-2', tenant_id: TENANT, period_start: period.start, period_end: period.end,
        payment_method: 'YAPE', expected_cents: 25000, received_cents: 23000,
        difference_cents: 2000, status: 'DISCREPANCY', notes: 'Faltante',
        reconciled_by: 'admin-1', reconciled_at: new Date(), created_at: new Date(),
      },
      {
        id: 's-3', tenant_id: TENANT, period_start: period.start, period_end: period.end,
        payment_method: 'CARD', expected_cents: 40000, received_cents: null,
        difference_cents: null, status: 'PENDING', notes: null,
        reconciled_by: null, reconciled_at: null, created_at: new Date(),
      },
    ]);

    const result = await service.getDiscrepancyReport(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalExpectedCents).toBe(145000);
      expect(result.data.totalReceivedCents).toBe(103000);
      expect(result.data.byMethod).toHaveLength(3);
      expect(result.data.matchedCount).toBe(1);
      expect(result.data.discrepancyCount).toBe(1);
      expect(result.data.pendingCount).toBe(1);
    }
  });

  it('debe retornar reporte vacío sin datos', async () => {
    mockPrisma.payment_settlements.findMany.mockResolvedValue([]);

    const result = await service.getDiscrepancyReport(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalExpectedCents).toBe(0);
      expect(result.data.byMethod).toHaveLength(0);
    }
  });
});
