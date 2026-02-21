/**
 * Bulk Operations Service Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkOperationsService } from '../bulk-operations.service';
import prisma from '@/src/core/db/prisma';
import { cache } from '@/src/core/cache/redis.service';

// Mock dependencies
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    products: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    admin_access_logs: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    catalog_meta: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    invalidatePattern: vi.fn(),
  },
}));

describe('BulkOperationsService', () => {
  let service: BulkOperationsService;
  const tenantId = 'tenant-123';
  const userId = '00000000-0000-4000-a000-000000000456';

  beforeEach(() => {
    service = new BulkOperationsService();
    vi.clearAllMocks();
  });

  describe('bulkUpdate', () => {
    it('should successfully update multiple products', async () => {
      const productIds = ['prod-1', 'prod-2', 'prod-3'];
      const updates = { is_active: true };

      // Mock transaction
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
              { id: 'prod-2', sku: 'SKU-2', version: 1 },
              { id: 'prod-3', sku: 'SKU-3', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 3 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(result.success_count).toBe(3);
      expect(result.failure_count).toBe(0);
      expect(result.failures).toEqual([]);
      expect(cache.invalidatePattern).toHaveBeenCalledWith('products:*');
    });

    it('should handle partial failures gracefully', async () => {
      const productIds = ['prod-1', 'prod-2', 'prod-3'];
      const updates = { is_active: true };

      // Mock transaction to fail
      (prisma.$transaction as any).mockRejectedValue(new Error('Database error'));

      // Mock findMany for error reporting
      (prisma.products.findMany as any).mockResolvedValue([
        { id: 'prod-1', sku: 'SKU-1' },
        { id: 'prod-2', sku: 'SKU-2' },
        { id: 'prod-3', sku: 'SKU-3' },
      ]);

      const result = await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(result.success_count).toBe(0);
      expect(result.failure_count).toBe(3);
      expect(result.failures).toHaveLength(3);
      expect(result.failures[0]).toMatchObject({
        product_id: 'prod-1',
        sku: 'SKU-1',
        error: 'Database error',
      });
    });

    it('should process products in batches of 50', async () => {
      const productIds = Array.from({ length: 120 }, (_, i) => `prod-${i}`);
      const updates = { is_active: true };

      let updateManyCallCount = 0;
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue(
              productIds.map((id, i) => ({
                id,
                sku: `SKU-${i}`,
                version: 1,
              }))
            ),
            updateMany: vi.fn().mockImplementation(() => {
              updateManyCallCount++;
              return { count: updateManyCallCount <= 2 ? 50 : 20 };
            }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.bulkUpdate(productIds, updates, tenantId, userId);

      // Single transaction, but 3 batch updateMany calls inside (50 + 50 + 20)
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(updateManyCallCount).toBe(3);
      expect(result.success_count).toBe(120);
      expect(result.failure_count).toBe(0);
    });

    it('should update version, updated_at, and updated_by', async () => {
      const productIds = ['prod-1'];
      const updates = { category: 'POLLOS' as any };

      let updateData: any;
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
            ]),
            updateMany: vi.fn().mockImplementation((args: any) => {
              updateData = args.data;
              return { count: 1 };
            }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(updateData).toMatchObject({
        category: 'POLLOS',
        version: { increment: 1 },
        updated_by: userId,
      });
      expect(updateData.updated_at).toBeInstanceOf(Date);
    });

    it('should create audit log entry', async () => {
      const productIds = ['prod-1', 'prod-2'];
      const updates = { is_active: false };

      let auditLogData: any;
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
              { id: 'prod-2', sku: 'SKU-2', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockImplementation((args: any) => {
              auditLogData = args.data;
              return {};
            }),
          },
        });
      });

      await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(auditLogData).toMatchObject({
        tenant_id: tenantId,
        employee_id: userId,
        action: 'BULK_UPDATE',
        resource: 'products',
        metadata: {
          product_ids: productIds,
          updates,
          count: 2,
        },
      });
    });

    it('should increment catalog version', async () => {
      const productIds = ['prod-1'];
      const updates = { is_active: true };

      let catalogUpsertArgs: any;
      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockImplementation((args: any) => {
              catalogUpsertArgs = args;
              return {};
            }),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(catalogUpsertArgs).toMatchObject({
        where: { tenant_id: tenantId },
        update: {
          catalog_version: { increment: 1 },
        },
      });
    });

    it('should invalidate cache after successful update', async () => {
      const productIds = ['prod-1'];
      const updates = { is_active: true };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      await service.bulkUpdate(productIds, updates, tenantId, userId);

      expect(cache.invalidatePattern).toHaveBeenCalledWith('products:*');
    });
  });

  describe('bulkDelete', () => {
    it('should soft delete products by setting is_active=false', async () => {
      const productIds = ['prod-1', 'prod-2'];

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
              { id: 'prod-2', sku: 'SKU-2', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      (prisma.admin_access_logs.updateMany as any).mockResolvedValue({ count: 1 });

      const result = await service.bulkDelete(productIds, tenantId, userId);

      expect(result.success_count).toBe(2);
      expect(result.failure_count).toBe(0);
    });

    it('should update audit log action to BULK_DELETE', async () => {
      const productIds = ['prod-1'];

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback({
          products: {
            findMany: vi.fn().mockResolvedValue([
              { id: 'prod-1', sku: 'SKU-1', version: 1 },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          catalog_meta: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          admin_access_logs: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      (prisma.admin_access_logs.updateMany as any).mockResolvedValue({ count: 1 });

      await service.bulkDelete(productIds, tenantId, userId);

      expect(prisma.admin_access_logs.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { action: 'BULK_DELETE' },
        })
      );
    });
  });
});
