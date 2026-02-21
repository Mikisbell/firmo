/**
 * Petty Cash Service Tests
 *
 * @module core/services/__tests__/petty-cash.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PettyCashService } from '../petty-cash.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    petty_cash_balance: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    petty_cash_transactions: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: PettyCashService;

const TENANT = 'tenant-1';
const LOCATION = 'loc-1';
const SHIFT = 'shift-1';
const USER = 'user-1';

const mockBalance = {
  id: 'bal-1',
  tenant_id: TENANT,
  location_id: LOCATION,
  current_balance: 30000, // S/ 300.00
  max_balance: 50000,
  min_balance: 10000,
  approval_threshold: 5000,
  last_reconciled_at: new Date('2026-02-01'),
  last_reconciled_by: null,
  updated_at: new Date(),
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new PettyCashService(mockPrisma as any);
});

// ============================================================================
// getBalance
// ============================================================================

describe('getBalance', () => {
  it('debe retornar saldo correctamente', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);

    const result = await service.getBalance(TENANT, LOCATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currentBalance).toBe(30000);
      expect(result.data.maxBalance).toBe(50000);
      expect(result.data.minBalance).toBe(10000);
      expect(result.data.approvalThreshold).toBe(5000);
    }
  });

  it('debe retornar error si no existe', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(null);

    const result = await service.getBalance(TENANT, LOCATION);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// recordTransaction
// ============================================================================

describe('recordTransaction', () => {
  const baseInput = {
    tenantId: TENANT,
    locationId: LOCATION,
    shiftId: SHIFT,
    type: 'EXPENSE' as const,
    amount: 3000,
    category: 'SUPPLIES' as const,
    description: 'Compra de servilletas',
    createdBy: USER,
  };

  it('debe registrar egreso correctamente', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    const txResult = {
      id: 'tx-1',
      tenant_id: TENANT,
      location_id: LOCATION,
      shift_id: SHIFT,
      type: 'EXPENSE',
      amount: 3000,
      category: 'SUPPLIES',
      description: 'Compra de servilletas',
      requires_approval: false,
      approved_by: null,
      approved_at: null,
      receipt_photo_url: null,
      receipt_number: null,
      supplier_name: null,
      created_by: USER,
      created_at: new Date(),
    };
    mockPrisma.$transaction.mockResolvedValue([txResult, {}]);

    const result = await service.recordTransaction(baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(3000);
      expect(result.data.type).toBe('EXPENSE');
      expect(result.data.requiresApproval).toBe(false);
    }
  });

  it('debe requerir aprobación si supera threshold', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    const txResult = {
      id: 'tx-2',
      tenant_id: TENANT,
      location_id: LOCATION,
      shift_id: SHIFT,
      type: 'EXPENSE',
      amount: 8000,
      category: 'MAINTENANCE',
      description: 'Reparación estufa',
      requires_approval: true,
      approved_by: null,
      approved_at: null,
      receipt_photo_url: null,
      receipt_number: null,
      supplier_name: null,
      created_by: USER,
      created_at: new Date(),
    };
    mockPrisma.$transaction.mockResolvedValue([txResult, {}]);

    const result = await service.recordTransaction({
      ...baseInput,
      amount: 8000,
      category: 'MAINTENANCE',
      description: 'Reparación estufa',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiresApproval).toBe(true);
    }
  });

  it('debe registrar ingreso correctamente', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    const txResult = {
      id: 'tx-3',
      tenant_id: TENANT,
      location_id: LOCATION,
      shift_id: SHIFT,
      type: 'INCOME',
      amount: 10000,
      category: 'OTHER',
      description: 'Reposición caja',
      requires_approval: true,
      approved_by: null,
      approved_at: null,
      receipt_photo_url: null,
      receipt_number: null,
      supplier_name: null,
      created_by: USER,
      created_at: new Date(),
    };
    mockPrisma.$transaction.mockResolvedValue([txResult, {}]);

    const result = await service.recordTransaction({
      ...baseInput,
      type: 'INCOME',
      amount: 10000,
      category: 'OTHER',
      description: 'Reposición caja',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('INCOME');
    }
  });

  it('debe rechazar monto 0', async () => {
    const result = await service.recordTransaction({ ...baseInput, amount: 0 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('mayor a 0');
    }
  });

  it('debe rechazar monto negativo', async () => {
    const result = await service.recordTransaction({ ...baseInput, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('debe rechazar descripción vacía', async () => {
    const result = await service.recordTransaction({ ...baseInput, description: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('descripción');
    }
  });

  it('debe rechazar egreso que baje de min_balance', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    // balance = 30000, min = 10000, so max expense = 20000
    const result = await service.recordTransaction({ ...baseInput, amount: 25000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('saldo mínimo');
    }
  });

  it('debe rechazar ingreso que suba de max_balance', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    // balance = 30000, max = 50000, so max income = 20000
    const result = await service.recordTransaction({
      ...baseInput,
      type: 'INCOME',
      amount: 25000,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('saldo máximo');
    }
  });

  it('debe retornar error si balance no existe', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(null);
    const result = await service.recordTransaction(baseInput);
    expect(result.success).toBe(false);
  });

  it('debe incluir datos de recibo si se proporcionan', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    const txResult = {
      id: 'tx-4',
      tenant_id: TENANT,
      location_id: LOCATION,
      shift_id: SHIFT,
      type: 'EXPENSE',
      amount: 2000,
      category: 'SUPPLIES',
      description: 'Jabón',
      requires_approval: false,
      approved_by: null,
      approved_at: null,
      receipt_photo_url: 'https://example.com/receipt.jpg',
      receipt_number: 'R-001',
      supplier_name: 'Limpieza SAC',
      created_by: USER,
      created_at: new Date(),
    };
    mockPrisma.$transaction.mockResolvedValue([txResult, {}]);

    const result = await service.recordTransaction({
      ...baseInput,
      amount: 2000,
      description: 'Jabón',
      receiptPhotoUrl: 'https://example.com/receipt.jpg',
      receiptNumber: 'R-001',
      supplierName: 'Limpieza SAC',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.receiptPhotoUrl).toBe('https://example.com/receipt.jpg');
      expect(result.data.receiptNumber).toBe('R-001');
      expect(result.data.supplierName).toBe('Limpieza SAC');
    }
  });
});

// ============================================================================
// approveTransaction
// ============================================================================

describe('approveTransaction', () => {
  it('debe aprobar transacción pendiente', async () => {
    mockPrisma.petty_cash_transactions.findFirst.mockResolvedValue({
      id: 'tx-1',
      tenant_id: TENANT,
      requires_approval: true,
      approved_by: null,
    });
    mockPrisma.petty_cash_transactions.update.mockResolvedValue({});

    const result = await service.approveTransaction(TENANT, 'tx-1', 'admin-1');
    expect(result.success).toBe(true);
    expect(mockPrisma.petty_cash_transactions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx-1' },
        data: expect.objectContaining({ approved_by: 'admin-1' }),
      }),
    );
  });

  it('debe rechazar si no existe', async () => {
    mockPrisma.petty_cash_transactions.findFirst.mockResolvedValue(null);
    const result = await service.approveTransaction(TENANT, 'tx-999', 'admin-1');
    expect(result.success).toBe(false);
  });

  it('debe rechazar si no requiere aprobación', async () => {
    mockPrisma.petty_cash_transactions.findFirst.mockResolvedValue({
      id: 'tx-1',
      tenant_id: TENANT,
      requires_approval: false,
      approved_by: null,
    });
    const result = await service.approveTransaction(TENANT, 'tx-1', 'admin-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('no requiere aprobación');
    }
  });

  it('debe rechazar si ya fue aprobada', async () => {
    mockPrisma.petty_cash_transactions.findFirst.mockResolvedValue({
      id: 'tx-1',
      tenant_id: TENANT,
      requires_approval: true,
      approved_by: 'admin-2',
    });
    const result = await service.approveTransaction(TENANT, 'tx-1', 'admin-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('ya fue aprobada');
    }
  });
});

// ============================================================================
// reconcile
// ============================================================================

describe('reconcile', () => {
  it('debe reconciliar correctamente', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    mockPrisma.petty_cash_balance.update.mockResolvedValue({});

    const result = await service.reconcile(TENANT, LOCATION, 28000, 'admin-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previousBalance).toBe(30000);
      expect(result.data.countedAmount).toBe(28000);
      expect(result.data.difference).toBe(-2000);
      expect(result.data.reconciledBy).toBe('admin-1');
    }
  });

  it('debe detectar diferencia positiva (sobrante)', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    mockPrisma.petty_cash_balance.update.mockResolvedValue({});

    const result = await service.reconcile(TENANT, LOCATION, 32000, 'admin-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.difference).toBe(2000);
    }
  });

  it('debe rechazar monto negativo', async () => {
    const result = await service.reconcile(TENANT, LOCATION, -100, 'admin-1');
    expect(result.success).toBe(false);
  });

  it('debe retornar error si balance no existe', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(null);
    const result = await service.reconcile(TENANT, LOCATION, 30000, 'admin-1');
    expect(result.success).toBe(false);
  });

  it('debe actualizar balance al monto contado', async () => {
    mockPrisma.petty_cash_balance.findUnique.mockResolvedValue(mockBalance);
    mockPrisma.petty_cash_balance.update.mockResolvedValue({});

    await service.reconcile(TENANT, LOCATION, 25000, 'admin-1');
    expect(mockPrisma.petty_cash_balance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ current_balance: 25000 }),
      }),
    );
  });
});

// ============================================================================
// getTransactions
// ============================================================================

describe('getTransactions', () => {
  it('debe retornar transacciones', async () => {
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        tenant_id: TENANT,
        location_id: LOCATION,
        shift_id: SHIFT,
        type: 'EXPENSE',
        amount: 1500,
        category: 'FOOD',
        description: 'Compra pan',
        requires_approval: false,
        approved_by: null,
        approved_at: null,
        receipt_photo_url: null,
        receipt_number: null,
        supplier_name: null,
        created_by: USER,
        created_at: new Date('2026-02-10'),
      },
    ]);

    const result = await service.getTransactions(TENANT, LOCATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].category).toBe('FOOD');
    }
  });

  it('debe filtrar por tipo', async () => {
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    await service.getTransactions(TENANT, LOCATION, { type: 'INCOME' });
    expect(mockPrisma.petty_cash_transactions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'INCOME' }),
      }),
    );
  });

  it('debe filtrar por categoría', async () => {
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    await service.getTransactions(TENANT, LOCATION, { category: 'CLEANING' });
    expect(mockPrisma.petty_cash_transactions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'CLEANING' }),
      }),
    );
  });

  it('debe filtrar por rango de fechas', async () => {
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    const start = new Date('2026-02-01');
    const end = new Date('2026-02-28');
    await service.getTransactions(TENANT, LOCATION, { startDate: start, endDate: end });
    expect(mockPrisma.petty_cash_transactions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: { gte: start, lte: end },
        }),
      }),
    );
  });

  it('debe retornar lista vacía si no hay datos', async () => {
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    const result = await service.getTransactions(TENANT, LOCATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});
