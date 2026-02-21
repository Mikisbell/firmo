/**
 * Product Availability Service (Auto-86) Unit Tests
 *
 * Tests para marcar/desmarcar productos como no disponibles,
 * emisión de eventos, y auto-check de ingredientes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductAvailabilityService } from '../product-availability.service';
import type { EventBus } from '@/src/core/infra/event-bus';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/src/core/infra/event-bus', () => ({
  eventBus: { publish: vi.fn(), subscribe: vi.fn() },
}));

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const PRODUCT_ID = '22222222-3333-4444-5555-666666666666';
const USER_ID = '99999999-8888-7777-6666-555555555555';

const PRODUCT_ROW = {
  id: PRODUCT_ID,
  tenant_id: TENANT_ID,
  name: 'Pollo a la Brasa',
  sku: 'POLLO-001',
  category: 'POLLOS',
  station: 'PARRILLA',
  is_active: true,
  is_available: true,
};

// ============================================================================
// Tests
// ============================================================================

describe('ProductAvailabilityService', () => {
  let service: ProductAvailabilityService;
  const mockPrisma: any = {
    products: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    recipes: {
      findFirst: vi.fn(),
    },
    inventory: {
      findFirst: vi.fn(),
    },
  };
  const mockBus: EventBus = {
    publish: vi.fn(),
    subscribe: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductAvailabilityService(mockPrisma, mockBus);
  });

  // ==========================================================================
  // Mark Unavailable
  // ==========================================================================

  describe('markUnavailable', () => {
    it('debe marcar producto como no disponible y emitir evento', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.products.update.mockResolvedValue({ ...PRODUCT_ROW, is_available: false });

      const result = await service.markUnavailable(TENANT_ID, PRODUCT_ID, 'MANUAL', USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(false);
      }

      expect(mockPrisma.products.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { is_available: false },
      });

      expect(mockBus.publish).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          event_type: 'PRODUCT_MARKED_UNAVAILABLE',
          aggregate_type: 'CATALOG',
          payload: expect.objectContaining({
            product_id: PRODUCT_ID,
            reason: 'MANUAL',
          }),
        }),
      );
    });

    it('debe fallar si el producto no existe', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(null);

      const result = await service.markUnavailable(TENANT_ID, 'no-existe', 'MANUAL');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('debe soportar razón LOW_STOCK', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.products.update.mockResolvedValue({});

      const result = await service.markUnavailable(TENANT_ID, PRODUCT_ID, 'LOW_STOCK');

      expect(result.success).toBe(true);
      expect(mockBus.publish).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          payload: expect.objectContaining({ reason: 'LOW_STOCK' }),
        }),
      );
    });
  });

  // ==========================================================================
  // Mark Available
  // ==========================================================================

  describe('markAvailable', () => {
    it('debe marcar producto como disponible y emitir evento', async () => {
      mockPrisma.products.findFirst.mockResolvedValue({ ...PRODUCT_ROW, is_available: false });
      mockPrisma.products.update.mockResolvedValue({ ...PRODUCT_ROW, is_available: true });

      const result = await service.markAvailable(TENANT_ID, PRODUCT_ID, USER_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(true);
      }

      expect(mockBus.publish).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          event_type: 'PRODUCT_MARKED_AVAILABLE',
          aggregate_type: 'CATALOG',
        }),
      );
    });

    it('debe fallar si el producto no existe', async () => {
      mockPrisma.products.findFirst.mockResolvedValue(null);

      const result = await service.markAvailable(TENANT_ID, 'no-existe');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ==========================================================================
  // Get Unavailable Products
  // ==========================================================================

  describe('getUnavailableProducts', () => {
    it('debe retornar lista de productos no disponibles', async () => {
      mockPrisma.products.findMany.mockResolvedValue([
        { id: PRODUCT_ID, name: 'Pollo a la Brasa', sku: 'POLLO-001', category: 'POLLOS', station: 'PARRILLA', is_available: false },
      ]);

      const result = await service.getUnavailableProducts(TENANT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].is_available).toBe(false);
      }
    });

    it('debe retornar lista vacía si todos están disponibles', async () => {
      mockPrisma.products.findMany.mockResolvedValue([]);

      const result = await service.getUnavailableProducts(TENANT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ==========================================================================
  // Auto Check Availability
  // ==========================================================================

  describe('autoCheckAvailability', () => {
    it('debe retornar disponible si no hay receta', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue(null);

      const result = await service.autoCheckAvailability(TENANT_ID, PRODUCT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(true);
      }
    });

    it('debe auto-86 si ingrediente requerido está agotado', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue({
        ingredients: [
          { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD' },
        ],
      });
      mockPrisma.inventory.findFirst.mockResolvedValue({ stock: 0, min_stock: 5 });
      mockPrisma.products.findFirst.mockResolvedValue(PRODUCT_ROW);
      mockPrisma.products.update.mockResolvedValue({});

      const result = await service.autoCheckAvailability(TENANT_ID, PRODUCT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(false);
        expect(result.data.reason).toContain('POLLO-ENTERO');
      }

      // Debe haber emitido evento Auto-86
      expect(mockBus.publish).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({
          event_type: 'PRODUCT_MARKED_UNAVAILABLE',
          payload: expect.objectContaining({ reason: 'INGREDIENT_OUT' }),
        }),
      );
    });

    it('debe ignorar ingredientes opcionales', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue({
        ingredients: [
          { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD', is_optional: false },
          { inventory_code: 'AJI-EXTRA', quantity: 0.1, unit: 'LITROS', is_optional: true },
        ],
      });
      // Pollo tiene stock, ají no (pero es opcional)
      mockPrisma.inventory.findFirst.mockResolvedValue({ stock: 10, min_stock: 5 });

      const result = await service.autoCheckAvailability(TENANT_ID, PRODUCT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(true);
      }
    });

    it('debe retornar disponible si todos los ingredientes tienen stock', async () => {
      mockPrisma.recipes.findFirst.mockResolvedValue({
        ingredients: [
          { inventory_code: 'POLLO-ENTERO', quantity: 1, unit: 'UNIDAD' },
          { inventory_code: 'ADEREZO', quantity: 0.067, unit: 'LITROS' },
        ],
      });
      mockPrisma.inventory.findFirst.mockResolvedValue({ stock: 50, min_stock: 5 });

      const result = await service.autoCheckAvailability(TENANT_ID, PRODUCT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_available).toBe(true);
      }
    });
  });
});
