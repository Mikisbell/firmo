/**
 * Unit tests for N+1 query elimination in OrderService
 * 
 * These tests verify that loading orders with payments uses
 * optimized queries instead of N+1 pattern.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../order.service';
import { CacheService } from '@/src/core/cache/redis.service';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock Cache
vi.mock('@/src/core/cache/redis.service', () => ({
  CacheService: vi.fn(),
}));

// Mock logger
vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('OrderService - N+1 Query Elimination', () => {
  let orderService: OrderService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    // Setup mock Prisma
    mockPrisma = {
      orders: {
        findMany: vi.fn(),
      },
      payments: {
        findMany: vi.fn(),
      },
    };

    // Setup mock Cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    orderService = new OrderService(mockPrisma as any, mockCache);
  });

  describe('getOrdersWithPayments', () => {
    it('should load orders and payments in 2 queries (not N+1)', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const mockOrders = [
        {
          id: 'order-1',
          tenant_id: tenantId,
          order_number: 1001,
          order_type: 'DINE_IN',
          order_status: 'OPEN',
          total_cents: 5000,
          items: [{ product_id: 'prod-1', quantity: 2 }],
          created_at: new Date('2024-01-01'),
        },
        {
          id: 'order-2',
          tenant_id: tenantId,
          order_number: 1002,
          order_type: 'TAKEOUT',
          order_status: 'OPEN',
          total_cents: 3000,
          items: [{ product_id: 'prod-2', quantity: 1 }],
          created_at: new Date('2024-01-02'),
        },
        {
          id: 'order-3',
          tenant_id: tenantId,
          order_number: 1003,
          order_type: 'DELIVERY',
          order_status: 'OPEN',
          total_cents: 7500,
          items: [{ product_id: 'prod-3', quantity: 3 }],
          created_at: new Date('2024-01-03'),
        },
      ];

      const mockPayments = [
        {
          id: 'payment-1',
          tenant_id: tenantId,
          order_id: 'order-1',
          check_id: 'check-1',
          amount_cents: 5000,
          payment_method: 'CASH',
          reference: null,
          status: 'COMPLETED',
          processed_at: new Date('2024-01-01'),
          processed_by: 'user-1',
        },
        {
          id: 'payment-2',
          tenant_id: tenantId,
          order_id: 'order-2',
          check_id: 'check-2',
          amount_cents: 3000,
          payment_method: 'CARD',
          reference: 'ref-123',
          status: 'COMPLETED',
          processed_at: new Date('2024-01-02'),
          processed_by: 'user-2',
        },
        {
          id: 'payment-3',
          tenant_id: tenantId,
          order_id: 'order-3',
          check_id: 'check-3',
          amount_cents: 7500,
          payment_method: 'YAPE',
          reference: 'ref-456',
          status: 'COMPLETED',
          processed_at: new Date('2024-01-03'),
          processed_by: 'user-3',
        },
      ];

      mockPrisma.orders.findMany.mockResolvedValue(mockOrders);
      mockPrisma.payments.findMany.mockResolvedValue(mockPayments);

      // Act
      const result = await orderService.getOrdersWithPayments(tenantId);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      // Verify only 2 queries were made (not N+1)
      expect(mockPrisma.orders.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.payments.findMany).toHaveBeenCalledTimes(1);

      // Verify payments query used IN clause with all order IDs
      expect(mockPrisma.payments.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          order_id: { in: ['order-1', 'order-2', 'order-3'] },
        },
      });

      // Verify results are correctly combined
      expect(result.data).toHaveLength(3);
      expect(result.data[0].payments).toHaveLength(1);
      expect(result.data[0].payments[0].id).toBe('payment-1');
      expect(result.data[1].payments).toHaveLength(1);
      expect(result.data[1].payments[0].id).toBe('payment-2');
      expect(result.data[2].payments).toHaveLength(1);
      expect(result.data[2].payments[0].id).toBe('payment-3');
    });

    it('should handle orders with no payments', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const mockOrders = [
        {
          id: 'order-1',
          tenant_id: tenantId,
          order_number: 1001,
          order_type: 'DINE_IN',
          order_status: 'OPEN',
          total_cents: 5000,
          items: [],
          created_at: new Date(),
        },
      ];

      mockPrisma.orders.findMany.mockResolvedValue(mockOrders);
      mockPrisma.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await orderService.getOrdersWithPayments(tenantId);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toHaveLength(1);
      expect(result.data[0].payments).toHaveLength(0);
    });

    it('should handle orders with multiple payments', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const mockOrders = [
        {
          id: 'order-1',
          tenant_id: tenantId,
          order_number: 1001,
          order_type: 'DINE_IN',
          order_status: 'OPEN',
          total_cents: 10000,
          items: [],
          created_at: new Date(),
        },
      ];

      const mockPayments = [
        {
          id: 'payment-1',
          tenant_id: tenantId,
          order_id: 'order-1',
          check_id: 'check-1',
          amount_cents: 5000,
          payment_method: 'CASH',
          reference: null,
          status: 'COMPLETED',
          processed_at: new Date(),
          processed_by: 'user-1',
        },
        {
          id: 'payment-2',
          tenant_id: tenantId,
          order_id: 'order-1',
          check_id: 'check-1',
          amount_cents: 5000,
          payment_method: 'CARD',
          reference: 'ref-123',
          status: 'COMPLETED',
          processed_at: new Date(),
          processed_by: 'user-1',
        },
      ];

      mockPrisma.orders.findMany.mockResolvedValue(mockOrders);
      mockPrisma.payments.findMany.mockResolvedValue(mockPayments);

      // Act
      const result = await orderService.getOrdersWithPayments(tenantId);

      // Assert
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data).toHaveLength(1);
      expect(result.data[0].payments).toHaveLength(2);
      expect(result.data[0].payments[0].amountCents).toBe(5000);
      expect(result.data[0].payments[1].amountCents).toBe(5000);
    });

    it('should respect pagination options', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      mockPrisma.orders.findMany.mockResolvedValue([]);
      mockPrisma.payments.findMany.mockResolvedValue([]);

      // Act
      await orderService.getOrdersWithPayments(tenantId, {
        limit: 10,
        offset: 20,
        status: 'OPEN',
        orderBy: 'order_number',
        orderDirection: 'asc',
      });

      // Assert
      expect(mockPrisma.orders.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          order_status: 'OPEN',
        },
        include: {},
        orderBy: {
          order_number: 'asc',
        },
        take: 10,
        skip: 20,
      });
    });

    it('should use default pagination when not specified', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      mockPrisma.orders.findMany.mockResolvedValue([]);
      mockPrisma.payments.findMany.mockResolvedValue([]);

      // Act
      await orderService.getOrdersWithPayments(tenantId);

      // Assert
      expect(mockPrisma.orders.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
        },
        include: {},
        orderBy: {
          created_at: 'desc',
        },
        take: 50,
        skip: 0,
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const tenantId = 'tenant-123';
      const dbError = new Error('Database connection failed');
      mockPrisma.orders.findMany.mockRejectedValue(dbError);

      // Act
      const result = await orderService.getOrdersWithPayments(tenantId);

      // Assert
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error.code).toBe('ORDERS_LOAD_FAILED');
      expect(result.error.message).toBe('Failed to load orders with payments');
    });

    it('should verify query count remains constant regardless of order count', async () => {
      // Arrange - Test with 1 order
      const tenantId = 'tenant-123';
      mockPrisma.orders.findMany.mockResolvedValue([
        {
          id: 'order-1',
          tenant_id: tenantId,
          order_number: 1001,
          order_type: 'DINE_IN',
          order_status: 'OPEN',
          total_cents: 5000,
          items: [],
          created_at: new Date(),
        },
      ]);
      mockPrisma.payments.findMany.mockResolvedValue([]);

      // Act
      await orderService.getOrdersWithPayments(tenantId);
      const queriesFor1Order = mockPrisma.orders.findMany.mock.calls.length +
                               mockPrisma.payments.findMany.mock.calls.length;

      // Reset mocks
      vi.clearAllMocks();

      // Arrange - Test with 100 orders
      const manyOrders = Array.from({ length: 100 }, (_, i) => ({
        id: `order-${i}`,
        tenant_id: tenantId,
        order_number: 1000 + i,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        total_cents: 5000,
        items: [],
        created_at: new Date(),
      }));
      mockPrisma.orders.findMany.mockResolvedValue(manyOrders);
      mockPrisma.payments.findMany.mockResolvedValue([]);

      // Act
      await orderService.getOrdersWithPayments(tenantId);
      const queriesFor100Orders = mockPrisma.orders.findMany.mock.calls.length +
                                  mockPrisma.payments.findMany.mock.calls.length;

      // Assert - Query count should be the same (2 queries) regardless of order count
      expect(queriesFor1Order).toBe(2);
      expect(queriesFor100Orders).toBe(2);
      expect(queriesFor1Order).toBe(queriesFor100Orders);
    });
  });
});
