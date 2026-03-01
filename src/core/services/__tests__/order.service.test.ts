/**
 * Unit Tests - OrderService
 * 
 * Tests for the Order Service business logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderService } from '../order.service';
import { PrismaClient } from '@prisma/client';
// import { CacheService } from '@/core/cache/redis.service';

// Mock Prisma
const mockPrisma = {
  orders: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  events: {
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn((cb) => cb(mockPrisma)),
} as unknown as PrismaClient;

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  delete: vi.fn(),
  deletePattern: vi.fn(),
} as unknown as any; // CacheService;

describe('OrderService', () => {
  let service: OrderService;

  beforeEach(() => {
    service = new OrderService(mockPrisma, mockCache);
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create order with valid input', async () => {
      const input = {
        tenantId: 'tenant-123',
        orderType: 'DINE_IN' as const,
        items: [
          {
            productId: 'prod-1',
            sku: 'SKU001',
            name: 'Test Product',
            quantity: 2,
            unitPriceCents: 500,
            station: 'PARRILLA',
          },
        ],
        tableNumber: '12',
        guestCount: 4,
        createdBy: 'user-123',
        terminalId: 'terminal-1',
      };

      (mockPrisma.$queryRaw as any).mockResolvedValue([{ max_num: 100 }]);
      (mockPrisma.orders.create as any).mockResolvedValue({
        id: 'order-123',
        order_number: 101,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        total_cents: 1000,
        items: [],
        created_at: new Date(),
      });

      const result = await service.createOrder(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderNumber).toBe(101);
        expect(result.data.totalCents).toBe(1000);
      }
    });

    it('should fail with empty items', async () => {
      const input = {
        tenantId: 'tenant-123',
        orderType: 'DINE_IN' as const,
        items: [],
        createdBy: 'user-123',
        terminalId: 'terminal-1',
      };

      const result = await service.createOrder(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should fail without table number for dine-in', async () => {
      const input = {
        tenantId: 'tenant-123',
        orderType: 'DINE_IN' as const,
        items: [{ productId: '1', sku: 'SKU', name: 'Test', quantity: 1, unitPriceCents: 100, station: 'PARRILLA' }],
        createdBy: 'user-123',
        terminalId: 'terminal-1',
      };

      const result = await service.createOrder(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect((result.error as any).field).toBe('tableNumber');
      }
    });
  });

  describe('getOrder', () => {
    it('should return cached order if available', async () => {
      const cachedOrder = {
        id: 'order-123',
        orderNumber: 101,
        orderType: 'DINE_IN',
        status: 'OPEN',
        totalCents: 1000,
        items: [],
        createdAt: new Date(),
      };

      mockCache.get.mockResolvedValue(cachedOrder);

      const result = await service.getOrder('tenant-123', 'order-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(cachedOrder);
      }
      expect(mockPrisma.orders.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const dbOrder = {
        id: 'order-123',
        order_number: 101,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        total_cents: 1000,
        items: [],
        created_at: new Date(),
      };

      mockCache.get.mockResolvedValue(null);
      (mockPrisma.orders.findFirst as any).mockResolvedValue(dbOrder);

      const result = await service.getOrder('tenant-123', 'order-123');

      expect(result.success).toBe(true);
      expect(mockPrisma.orders.findFirst).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return NotFoundError for non-existent order', async () => {
      mockCache.get.mockResolvedValue(null);
      (mockPrisma.orders.findFirst as any).mockResolvedValue(null);

      const result = await service.getOrder('tenant-123', 'non-existent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid transition', async () => {
      (mockPrisma.orders.findFirst as any).mockResolvedValue({
        id: 'order-123',
        order_number: 101,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        total_cents: 1000,
        items: [],
        created_at: new Date(),
      });

      (mockPrisma.orders.update as any).mockResolvedValue({
        id: 'order-123',
        order_number: 101,
        order_type: 'DINE_IN',
        order_status: 'IN_PROGRESS',
        total_cents: 1000,
        items: [],
        created_at: new Date(),
      });

      const result = await service.updateStatus(
        'tenant-123',
        'order-123',
        'IN_PROGRESS',
        'user-123'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('IN_PROGRESS');
      }
    });

    it('should fail with invalid status transition', async () => {
      (mockPrisma.orders.findFirst as any).mockResolvedValue({
        id: 'order-123',
        order_number: 101,
        order_type: 'DINE_IN',
        order_status: 'CONFIRMED',
        total_cents: 1000,
        items: [],
        created_at: new Date(),
      });

      const result = await service.updateStatus(
        'tenant-123',
        'order-123',
        'OPEN',
        'user-123'
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});

