/**
 * Purchases Service Tests
 *
 * @module core/services/__tests__/purchases.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchasesService } from '../purchases.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    purchase_orders: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: PurchasesService;

const TENANT = 'tenant-1';
const LOCATION = 'loc-1';
const SUPPLIER = 'sup-1';
const USER = 'user-1';

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new PurchasesService(mockPrisma as any);
});

// ============================================================================
// createPurchaseOrder
// ============================================================================

describe('createPurchaseOrder', () => {
  const baseInput = {
    tenantId: TENANT,
    locationId: LOCATION,
    supplierId: SUPPLIER,
    items: [
      { inventoryCode: 'POLLO-001', quantityOrdered: 10, unit: 'kg', unitCostCents: 1800 },
      { inventoryCode: 'PAPA-001', quantityOrdered: 20, unit: 'kg', unitCostCents: 300 },
    ],
    createdBy: USER,
  };

  it('debe crear orden de compra correctamente', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue(null); // No previous orders
    const subtotal = 10 * 1800 + 20 * 300; // 18000 + 6000 = 24000
    const tax = Math.round(subtotal * 0.18); // 4320
    const total = subtotal + tax; // 28320

    mockPrisma.purchase_orders.create.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      location_id: LOCATION,
      supplier_id: SUPPLIER,
      order_number: 1,
      status: 'DRAFT',
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      expected_delivery_date: null,
      notes: null,
      created_by: USER,
      created_at: new Date(),
      updated_at: new Date(),
      suppliers: { name: 'Proveedor Pollo SAC' },
      purchase_order_items: [
        {
          id: 'item-1',
          inventory_code: 'POLLO-001',
          quantity_ordered: 10,
          unit: 'kg',
          unit_cost_cents: 1800,
          total_cents: 18000,
        },
        {
          id: 'item-2',
          inventory_code: 'PAPA-001',
          quantity_ordered: 20,
          unit: 'kg',
          unit_cost_cents: 300,
          total_cents: 6000,
        },
      ],
    });

    const result = await service.createPurchaseOrder(baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('DRAFT');
      expect(result.data.subtotalCents).toBe(24000);
      expect(result.data.taxCents).toBe(4320);
      expect(result.data.totalCents).toBe(28320);
      expect(result.data.items).toHaveLength(2);
      expect(result.data.supplierName).toBe('Proveedor Pollo SAC');
    }
  });

  it('debe calcular IGV 18% correctamente', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue(null);
    mockPrisma.purchase_orders.create.mockResolvedValue({
      id: 'po-2',
      tenant_id: TENANT,
      location_id: LOCATION,
      supplier_id: SUPPLIER,
      order_number: 1,
      status: 'DRAFT',
      subtotal_cents: 10000,
      tax_cents: 1800,
      total_cents: 11800,
      expected_delivery_date: null,
      notes: null,
      created_by: USER,
      created_at: new Date(),
      updated_at: new Date(),
      suppliers: { name: 'Test' },
      purchase_order_items: [
        { id: 'i1', inventory_code: 'X', quantity_ordered: 10, unit: 'u', unit_cost_cents: 1000, total_cents: 10000 },
      ],
    });

    const result = await service.createPurchaseOrder({
      ...baseInput,
      items: [{ inventoryCode: 'X', quantityOrdered: 10, unit: 'u', unitCostCents: 1000 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.taxCents).toBe(1800);
    }
  });

  it('debe rechazar sin ítems', async () => {
    const result = await service.createPurchaseOrder({ ...baseInput, items: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('al menos un ítem');
    }
  });

  it('debe rechazar cantidad 0', async () => {
    const result = await service.createPurchaseOrder({
      ...baseInput,
      items: [{ inventoryCode: 'X', quantityOrdered: 0, unit: 'u', unitCostCents: 100 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('mayor a 0');
    }
  });

  it('debe rechazar costo unitario negativo', async () => {
    const result = await service.createPurchaseOrder({
      ...baseInput,
      items: [{ inventoryCode: 'X', quantityOrdered: 1, unit: 'u', unitCostCents: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it('debe incrementar número de orden', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({ order_number: 5 });
    mockPrisma.purchase_orders.create.mockResolvedValue({
      id: 'po-3',
      tenant_id: TENANT,
      location_id: LOCATION,
      supplier_id: SUPPLIER,
      order_number: 6,
      status: 'DRAFT',
      subtotal_cents: 1000,
      tax_cents: 180,
      total_cents: 1180,
      expected_delivery_date: null,
      notes: null,
      created_by: USER,
      created_at: new Date(),
      updated_at: new Date(),
      suppliers: null,
      purchase_order_items: [
        { id: 'i1', inventory_code: 'X', quantity_ordered: 1, unit: 'u', unit_cost_cents: 1000, total_cents: 1000 },
      ],
    });

    const result = await service.createPurchaseOrder({
      ...baseInput,
      items: [{ inventoryCode: 'X', quantityOrdered: 1, unit: 'u', unitCostCents: 1000 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orderNumber).toBe(6);
    }
  });
});

// ============================================================================
// updatePOStatus
// ============================================================================

describe('updatePOStatus', () => {
  it('debe pasar de DRAFT a CONFIRMED', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'DRAFT',
    });
    mockPrisma.purchase_orders.update.mockResolvedValue({});

    const result = await service.updatePOStatus(TENANT, 'po-1', 'CONFIRMED');
    expect(result.success).toBe(true);
  });

  it('debe pasar de CONFIRMED a RECEIVED', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'CONFIRMED',
    });
    mockPrisma.purchase_orders.update.mockResolvedValue({});

    const result = await service.updatePOStatus(TENANT, 'po-1', 'RECEIVED');
    expect(result.success).toBe(true);
  });

  it('debe permitir cancelar desde DRAFT', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'DRAFT',
    });
    mockPrisma.purchase_orders.update.mockResolvedValue({});

    const result = await service.updatePOStatus(TENANT, 'po-1', 'CANCELLED');
    expect(result.success).toBe(true);
  });

  it('debe rechazar transición inválida DRAFT → RECEIVED', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'DRAFT',
    });

    const result = await service.updatePOStatus(TENANT, 'po-1', 'RECEIVED');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('No se puede cambiar');
    }
  });

  it('debe rechazar transición desde RECEIVED', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'RECEIVED',
    });

    const result = await service.updatePOStatus(TENANT, 'po-1', 'DRAFT');
    expect(result.success).toBe(false);
  });

  it('debe rechazar transición desde CANCELLED', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue({
      id: 'po-1',
      tenant_id: TENANT,
      status: 'CANCELLED',
    });

    const result = await service.updatePOStatus(TENANT, 'po-1', 'CONFIRMED');
    expect(result.success).toBe(false);
  });

  it('debe retornar error si no existe', async () => {
    mockPrisma.purchase_orders.findFirst.mockResolvedValue(null);
    const result = await service.updatePOStatus(TENANT, 'po-999', 'CONFIRMED');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// getPurchaseOrders
// ============================================================================

describe('getPurchaseOrders', () => {
  it('debe retornar lista de órdenes', async () => {
    mockPrisma.purchase_orders.findMany.mockResolvedValue([
      {
        id: 'po-1',
        tenant_id: TENANT,
        location_id: LOCATION,
        supplier_id: SUPPLIER,
        order_number: 1,
        status: 'DRAFT',
        subtotal_cents: 10000,
        tax_cents: 1800,
        total_cents: 11800,
        expected_delivery_date: null,
        notes: null,
        created_by: USER,
        created_at: new Date(),
        updated_at: new Date(),
        suppliers: { name: 'Test Supplier' },
        purchase_order_items: [],
      },
    ]);

    const result = await service.getPurchaseOrders(TENANT, LOCATION);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].supplierName).toBe('Test Supplier');
    }
  });

  it('debe filtrar por status', async () => {
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    await service.getPurchaseOrders(TENANT, LOCATION, { status: 'CONFIRMED' });
    expect(mockPrisma.purchase_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
  });

  it('debe filtrar por proveedor', async () => {
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    await service.getPurchaseOrders(TENANT, LOCATION, { supplierId: 'sup-2' });
    expect(mockPrisma.purchase_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ supplier_id: 'sup-2' }),
      }),
    );
  });
});

// ============================================================================
// getPurchaseSummary
// ============================================================================

describe('getPurchaseSummary', () => {
  it('debe calcular resumen correctamente', async () => {
    mockPrisma.purchase_orders.findMany.mockResolvedValue([
      { supplier_id: 'sup-1', total_cents: 10000, status: 'RECEIVED', suppliers: { name: 'Pollo SAC' } },
      { supplier_id: 'sup-1', total_cents: 5000, status: 'CONFIRMED', suppliers: { name: 'Pollo SAC' } },
      { supplier_id: 'sup-2', total_cents: 8000, status: 'RECEIVED', suppliers: { name: 'Papa EIRL' } },
    ]);

    const period = { start: new Date('2026-02-01'), end: new Date('2026-02-28') };
    const result = await service.getPurchaseSummary(TENANT, LOCATION, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalOrders).toBe(3);
      expect(result.data.totalSpentCents).toBe(23000);
      expect(result.data.bySupplier).toHaveLength(2);
      expect(result.data.bySupplier[0].supplierName).toBe('Pollo SAC');
      expect(result.data.bySupplier[0].totalCents).toBe(15000);
    }
  });

  it('debe retornar vacío si no hay órdenes', async () => {
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);

    const period = { start: new Date('2026-02-01'), end: new Date('2026-02-28') };
    const result = await service.getPurchaseSummary(TENANT, LOCATION, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalOrders).toBe(0);
      expect(result.data.totalSpentCents).toBe(0);
    }
  });
});
