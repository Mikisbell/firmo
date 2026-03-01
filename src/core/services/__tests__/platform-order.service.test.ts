/**
 * Platform Order Service Tests
 *
 * @module core/services/__tests__/platform-order.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformOrderService } from '../platform-order.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    platform_configs: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    platform_orders: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: PlatformOrderService;

const TENANT = 'tenant-1';

const mockConfig = {
  id: 'cfg-1',
  tenant_id: TENANT,
  platform: 'PEDIDOSYA',
  is_active: true,
  api_key: 'test-key',
  store_id: 'store-1',
  webhook_secret: 'secret',
  commission_rate: 0.27,
  markup_rate: 0.20,
  auto_accept: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const validPYPayload = {
  id: 'PY-12345',
  customer: { name: 'Juan', phone: '+51987654321' },
  address: { description: 'Av. Lima 123' },
  details: [
    { name: 'Pollo', quantity: 1, unitPrice: 30.00 },
  ],
  totalAmount: 30.00,
};

function makeMockOrder(overrides: any = {}) {
  return {
    id: 'order-1',
    tenant_id: TENANT,
    platform: 'PEDIDOSYA',
    platform_order_id: 'PY-12345',
    order_id: null,
    status: 'RECEIVED',
    raw_payload: validPYPayload,
    customer_name: 'Juan',
    customer_phone: '+51987654321',
    delivery_address: 'Av. Lima 123',
    platform_total_cents: 3000,
    restaurant_total_cents: 2190,
    commission_cents: 810,
    items: [{ name: 'Pollo', quantity: 1, unitPriceCents: 3000 }],
    notes: null,
    estimated_pickup: null,
    accepted_at: null,
    rejected_at: null,
    rejection_reason: null,
    created_at: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma = createMockPrisma();
  service = new PlatformOrderService(mockPrisma as any);
  // Mock global fetch for adapter calls
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
});

// ============================================================================
// handleIncomingOrder
// ============================================================================

describe('handleIncomingOrder', () => {
  it('debe procesar pedido nuevo correctamente', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null); // no dedup
    mockPrisma.platform_orders.create.mockImplementation(({ data }: any) => ({
      ...data,
      created_at: new Date(),
    }));

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', validPYPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe('PEDIDOSYA');
      expect(result.data.platformOrderId).toBe('PY-12345');
      expect(result.data.customerName).toBe('Juan');
      expect(result.data.platformTotalCents).toBe(3000);
      expect(result.data.commissionCents).toBe(810); // 3000 * 0.27
      expect(result.data.restaurantTotalCents).toBe(2190);
      expect(result.data.status).toBe('RECEIVED');
    }
  });

  it('debe deduplicar pedido existente', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    const existing = makeMockOrder();
    mockPrisma.platform_orders.findFirst.mockResolvedValue(existing);

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', validPYPayload);
    expect(result.success).toBe(true);
    expect(mockPrisma.platform_orders.create).not.toHaveBeenCalled();
  });

  it('debe rechazar plataforma no configurada', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(null);

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', validPYPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('no configurada o inactiva');
    }
  });

  it('debe auto-aceptar si configurado', async () => {
    const autoConfig = { ...mockConfig, auto_accept: true };
    mockPrisma.platform_configs.findFirst
      .mockResolvedValueOnce(autoConfig) // handleIncomingOrder call
      .mockResolvedValueOnce(autoConfig); // acceptOrder call
    mockPrisma.platform_orders.findFirst
      .mockResolvedValueOnce(null) // dedup check
      .mockResolvedValueOnce(makeMockOrder()); // acceptOrder lookup
    mockPrisma.platform_orders.create.mockImplementation(({ data }: any) => ({
      ...data,
      created_at: new Date(),
    }));
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
      status: 'ACCEPTED',
    }));

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', validPYPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACCEPTED');
    }
  });

  it('debe calcular comisión con tasa de config', async () => {
    const customConfig = { ...mockConfig, commission_rate: 0.30 };
    mockPrisma.platform_configs.findFirst.mockResolvedValue(customConfig);
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);
    mockPrisma.platform_orders.create.mockImplementation(({ data }: any) => ({
      ...data,
      created_at: new Date(),
    }));

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', validPYPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.commissionCents).toBe(900); // 3000 * 0.30
      expect(result.data.restaurantTotalCents).toBe(2100);
    }
  });

  it('debe manejar error de parseo', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);

    const result = await service.handleIncomingOrder(TENANT, 'PEDIDOSYA', null);
    expect(result.success).toBe(false);
  });

  it('debe procesar LlamaFood payload', async () => {
    const lfConfig = { ...mockConfig, platform: 'LLAMAFOOD', commission_rate: 0.22 };
    mockPrisma.platform_configs.findFirst.mockResolvedValue(lfConfig);
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);
    mockPrisma.platform_orders.create.mockImplementation(({ data }: any) => ({
      ...data,
      created_at: new Date(),
    }));

    const lfPayload = {
      pedido_id: 'LF-001',
      cliente: { nombre: 'María' },
      productos: [{ producto: 'Pollo', cantidad: 1, precio_unitario: 5500 }],
      total_centavos: 5500,
    };

    const result = await service.handleIncomingOrder(TENANT, 'LLAMAFOOD', lfPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.platform).toBe('LLAMAFOOD');
      expect(result.data.platformTotalCents).toBe(5500);
      expect(result.data.commissionCents).toBe(1210); // 5500 * 0.22
    }
  });
});

// ============================================================================
// acceptOrder
// ============================================================================

describe('acceptOrder', () => {
  it('debe aceptar pedido RECEIVED', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
      status: 'ACCEPTED',
    }));
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);

    const result = await service.acceptOrder(TENANT, 'order-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACCEPTED');
      expect(result.data.orderId).toBeTruthy(); // UUID generated
      expect(result.data.acceptedAt).toBeTruthy();
    }
  });

  it('debe rechazar si orden no existe', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);

    const result = await service.acceptOrder(TENANT, 'nonexistent');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('no encontrada');
    }
  });

  it('debe rechazar si status no es RECEIVED', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(
      makeMockOrder({ status: 'ACCEPTED' }),
    );

    const result = await service.acceptOrder(TENANT, 'order-1');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('No se puede aceptar');
    }
  });

  it('debe notificar plataforma (best-effort)', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
    }));
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);

    await service.acceptOrder(TENANT, 'order-1');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('no debe fallar si notificación a plataforma falla', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
      status: 'ACCEPTED',
    }));
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    global.fetch = vi.fn().mockRejectedValue(new Error('Network'));

    const result = await service.acceptOrder(TENANT, 'order-1');
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// rejectOrder
// ============================================================================

describe('rejectOrder', () => {
  it('debe rechazar pedido con razón', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
      status: 'REJECTED',
    }));
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);

    const result = await service.rejectOrder(TENANT, 'order-1', 'Sin stock');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('REJECTED');
      expect(result.data.rejectionReason).toBe('Sin stock');
    }
  });

  it('debe requerir razón', async () => {
    const result = await service.rejectOrder(TENANT, 'order-1', '');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('razón de rechazo');
    }
  });

  it('debe rechazar si orden no existe', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);

    const result = await service.rejectOrder(TENANT, 'none', 'reason');
    expect(result.success).toBe(false);
  });

  it('debe rechazar si status no es RECEIVED', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(
      makeMockOrder({ status: 'REJECTED' }),
    );

    const result = await service.rejectOrder(TENANT, 'order-1', 'reason');
    expect(result.success).toBe(false);
  });

  it('debe registrar rejected_at', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());
    mockPrisma.platform_orders.update.mockImplementation(({ data }: any) => ({
      ...makeMockOrder(),
      ...data,
      status: 'REJECTED',
    }));
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);

    const result = await service.rejectOrder(TENANT, 'order-1', 'reason');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rejectedAt).toBeTruthy();
    }
  });
});

// ============================================================================
// getOrders
// ============================================================================

describe('getOrders', () => {
  it('debe retornar lista de pedidos', async () => {
    mockPrisma.platform_orders.findMany.mockResolvedValue([
      makeMockOrder(),
      makeMockOrder({ id: 'order-2', platform_order_id: 'PY-999' }),
    ]);

    const result = await service.getOrders(TENANT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('debe filtrar por plataforma', async () => {
    mockPrisma.platform_orders.findMany.mockResolvedValue([]);

    await service.getOrders(TENANT, { platform: 'PEDIDOSYA' });
    expect(mockPrisma.platform_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platform: 'PEDIDOSYA' }),
      }),
    );
  });

  it('debe filtrar por status', async () => {
    mockPrisma.platform_orders.findMany.mockResolvedValue([]);

    await service.getOrders(TENANT, { status: 'RECEIVED' });
    expect(mockPrisma.platform_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'RECEIVED' }),
      }),
    );
  });

  it('debe respetar limit', async () => {
    mockPrisma.platform_orders.findMany.mockResolvedValue([]);

    await service.getOrders(TENANT, { limit: 10 });
    expect(mockPrisma.platform_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('debe usar limit default de 50', async () => {
    mockPrisma.platform_orders.findMany.mockResolvedValue([]);

    await service.getOrders(TENANT);
    expect(mockPrisma.platform_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});

// ============================================================================
// getOrder
// ============================================================================

describe('getOrder', () => {
  it('debe retornar pedido por id', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(makeMockOrder());

    const result = await service.getOrder(TENANT, 'order-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('order-1');
    }
  });

  it('debe retornar error si no existe', async () => {
    mockPrisma.platform_orders.findFirst.mockResolvedValue(null);

    const result = await service.getOrder(TENANT, 'none');
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// getConfig
// ============================================================================

describe('getConfig', () => {
  it('debe retornar configs del tenant', async () => {
    mockPrisma.platform_configs.findMany.mockResolvedValue([mockConfig]);

    const result = await service.getConfig(TENANT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].platform).toBe('PEDIDOSYA');
      expect(result.data[0].apiKey).toBe('***'); // Masked
    }
  });

  it('debe filtrar por plataforma', async () => {
    mockPrisma.platform_configs.findMany.mockResolvedValue([]);

    await service.getConfig(TENANT, 'LLAMAFOOD');
    expect(mockPrisma.platform_configs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ platform: 'LLAMAFOOD' }),
      }),
    );
  });

  it('debe ocultar API key', async () => {
    mockPrisma.platform_configs.findMany.mockResolvedValue([mockConfig]);

    const result = await service.getConfig(TENANT);
    if (result.success) {
      expect(result.data[0].apiKey).toBe('***');
    }
  });

  it('debe mostrar null si no hay API key', async () => {
    mockPrisma.platform_configs.findMany.mockResolvedValue([
      { ...mockConfig, api_key: null },
    ]);

    const result = await service.getConfig(TENANT);
    if (result.success) {
      expect(result.data[0].apiKey).toBeNull();
    }
  });
});

// ============================================================================
// updateConfig
// ============================================================================

describe('updateConfig', () => {
  it('debe actualizar config existente', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    mockPrisma.platform_configs.update.mockImplementation(({ data }: any) => ({
      ...mockConfig,
      ...data,
    }));

    const result = await service.updateConfig(TENANT, 'PEDIDOSYA', {
      autoAccept: true,
      commissionRate: 0.25,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoAccept).toBe(true);
    }
  });

  it('debe crear config nueva si no existe', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(null);
    mockPrisma.platform_configs.create.mockImplementation(({ data }: any) => ({
      ...data,
    }));

    const result = await service.updateConfig(TENANT, 'LLAMAFOOD', {
      isActive: true,
      apiKey: 'new-key',
      storeId: 'store-2',
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.platform_configs.create).toHaveBeenCalled();
  });

  it('debe actualizar solo campos proporcionados', async () => {
    mockPrisma.platform_configs.findFirst.mockResolvedValue(mockConfig);
    mockPrisma.platform_configs.update.mockImplementation(({ data }: any) => ({
      ...mockConfig,
      ...data,
    }));

    await service.updateConfig(TENANT, 'PEDIDOSYA', { isActive: false });

    const updateCall = mockPrisma.platform_configs.update.mock.calls[0][0];
    expect(updateCall.data.is_active).toBe(false);
    expect(updateCall.data.api_key).toBeUndefined();
    expect(updateCall.data.store_id).toBeUndefined();
  });
});
