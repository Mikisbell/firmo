/**
 * Mesa Service Tests
 *
 * Tests for table occupy/release, merge/split, status, guest count, occupancy history.
 *
 * @module core/services/__tests__/mesa.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MesaService } from '../mesa.service';

// ============================================================================
// Mock helpers
// ============================================================================

function makeTable(overrides: Record<string, unknown> = {}) {
  return {
    id: 'table-1',
    tenant_id: 'tenant-1',
    location_id: 'loc-1',
    number: '1',
    display_name: 'Mesa 1',
    capacity: 4,
    status: 'AVAILABLE',
    current_order_id: null,
    occupied_since: null,
    is_merged: false,
    merged_table_ids: [],
    parent_table_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    tables: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
    },
    orders: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
  } as any;
}

// ============================================================================
// Tests
// ============================================================================

describe('MesaService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: MesaService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MesaService(prisma);
  });

  // ========================================================================
  // occupyTable
  // ========================================================================

  describe('occupyTable', () => {
    it('debe ocupar mesa disponible', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable());
      const result = await service.occupyTable('tenant-1', 'table-1', 3);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('OCCUPIED');
        expect(result.data.guestCount).toBe(3);
        expect(result.data.occupiedSince).toBeTruthy();
      }
      expect(prisma.tables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'table-1' },
          data: expect.objectContaining({ status: 'OCCUPIED' }),
        }),
      );
    });

    it('debe ocupar mesa con orderId', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable());
      const result = await service.occupyTable('tenant-1', 'table-1', 2, 'order-123');

      expect(result.success).toBe(true);
      expect(prisma.tables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ current_order_id: 'order-123' }),
        }),
      );
    });

    it('debe rechazar si mesa no existe', async () => {
      prisma.tables.findFirst.mockResolvedValue(null);
      const result = await service.occupyTable('tenant-1', 'no-exist', 2);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no encontrada');
    });

    it('debe rechazar si mesa ya está ocupada', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable({ status: 'OCCUPIED' }));
      const result = await service.occupyTable('tenant-1', 'table-1', 2);

      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no disponible');
    });

    it('debe rechazar guestCount inválido (0)', async () => {
      const result = await service.occupyTable('tenant-1', 'table-1', 0);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('entero positivo');
    });

    it('debe rechazar guestCount inválido (negativo)', async () => {
      const result = await service.occupyTable('tenant-1', 'table-1', -1);
      expect(result.success).toBe(false);
    });

    it('debe rechazar guestCount decimal', async () => {
      const result = await service.occupyTable('tenant-1', 'table-1', 2.5);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // releaseTable
  // ========================================================================

  describe('releaseTable', () => {
    it('debe liberar mesa ocupada y calcular tiempo', async () => {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      prisma.tables.findFirst.mockResolvedValue(
        makeTable({ status: 'OCCUPIED', occupied_since: thirtyMinAgo }),
      );

      const result = await service.releaseTable('tenant-1', 'table-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stayMinutes).toBeGreaterThanOrEqual(29);
        expect(result.data.stayMinutes).toBeLessThanOrEqual(31);
      }
      expect(prisma.tables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'AVAILABLE',
            occupied_since: null,
            current_order_id: null,
          }),
        }),
      );
    });

    it('debe rechazar si mesa no existe', async () => {
      prisma.tables.findFirst.mockResolvedValue(null);
      const result = await service.releaseTable('tenant-1', 'no-exist');
      expect(result.success).toBe(false);
    });

    it('debe rechazar si mesa no está ocupada', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable({ status: 'AVAILABLE' }));
      const result = await service.releaseTable('tenant-1', 'table-1');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no está ocupada');
    });
  });

  // ========================================================================
  // mergeTables
  // ========================================================================

  describe('mergeTables', () => {
    it('debe unir 2 mesas', async () => {
      const table1 = makeTable({ id: 'table-1', capacity: 4 });
      const table2 = makeTable({ id: 'table-2', capacity: 4 });
      prisma.tables.findMany.mockResolvedValue([table1, table2]);

      const result = await service.mergeTables('tenant-1', 'table-1', ['table-2']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalCapacity).toBe(8);
        expect(result.data.childTableIds).toEqual(['table-2']);
      }
    });

    it('debe unir 3+ mesas', async () => {
      const tables = [
        makeTable({ id: 't-1', capacity: 4 }),
        makeTable({ id: 't-2', capacity: 4 }),
        makeTable({ id: 't-3', capacity: 6 }),
      ];
      prisma.tables.findMany.mockResolvedValue(tables);

      const result = await service.mergeTables('tenant-1', 't-1', ['t-2', 't-3']);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalCapacity).toBe(14);
      }
    });

    it('debe rechazar sin mesas secundarias', async () => {
      const result = await service.mergeTables('tenant-1', 'table-1', []);
      expect(result.success).toBe(false);
    });

    it('debe rechazar si mesa no encontrada', async () => {
      prisma.tables.findMany.mockResolvedValue([makeTable({ id: 'table-1' })]);
      const result = await service.mergeTables('tenant-1', 'table-1', ['no-exist']);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no encontradas');
    });

    it('debe rechazar mesas de diferente ubicación', async () => {
      const tables = [
        makeTable({ id: 't-1', location_id: 'loc-A' }),
        makeTable({ id: 't-2', location_id: 'loc-B' }),
      ];
      prisma.tables.findMany.mockResolvedValue(tables);

      const result = await service.mergeTables('tenant-1', 't-1', ['t-2']);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('misma ubicación');
    });

    it('debe rechazar mesas con órdenes activas', async () => {
      const tables = [
        makeTable({ id: 't-1', current_order_id: 'order-1' }),
        makeTable({ id: 't-2' }),
      ];
      prisma.tables.findMany.mockResolvedValue(tables);

      const result = await service.mergeTables('tenant-1', 't-1', ['t-2']);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('órdenes activas');
    });

    it('debe rechazar si mesa ya es child de otra', async () => {
      const tables = [
        makeTable({ id: 't-1' }),
        makeTable({ id: 't-2', parent_table_id: 'other-parent' }),
      ];
      prisma.tables.findMany.mockResolvedValue(tables);

      const result = await service.mergeTables('tenant-1', 't-1', ['t-2']);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('ya están unidas');
    });
  });

  // ========================================================================
  // splitTables
  // ========================================================================

  describe('splitTables', () => {
    it('debe separar mesas unidas', async () => {
      prisma.tables.findFirst.mockResolvedValue(
        makeTable({
          id: 'parent',
          is_merged: true,
          merged_table_ids: ['child-1', 'child-2'],
          capacity: 12,
        }),
      );
      prisma.tables.findMany.mockResolvedValue([
        makeTable({ id: 'child-1', capacity: 4, parent_table_id: 'parent' }),
        makeTable({ id: 'child-2', capacity: 4, parent_table_id: 'parent' }),
      ]);

      const result = await service.splitTables('tenant-1', 'parent');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restoredTableIds).toEqual(['child-1', 'child-2']);
      }
      expect(prisma.tables.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_merged: false,
            merged_table_ids: [],
            status: 'AVAILABLE',
          }),
        }),
      );
    });

    it('debe rechazar si mesa no existe', async () => {
      prisma.tables.findFirst.mockResolvedValue(null);
      const result = await service.splitTables('tenant-1', 'no-exist');
      expect(result.success).toBe(false);
    });

    it('debe rechazar si mesa no está unida', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable({ is_merged: false }));
      const result = await service.splitTables('tenant-1', 'table-1');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('no está unida');
    });

    it('debe rechazar si tiene orden activa', async () => {
      prisma.tables.findFirst.mockResolvedValue(
        makeTable({ is_merged: true, merged_table_ids: ['c-1'], current_order_id: 'order-1' }),
      );
      const result = await service.splitTables('tenant-1', 'table-1');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('orden activa');
    });
  });

  // ========================================================================
  // getTableStatus
  // ========================================================================

  describe('getTableStatus', () => {
    it('debe retornar resumen correcto', async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
      prisma.tables.findMany.mockResolvedValue([
        makeTable({ id: 't-1', status: 'AVAILABLE' }),
        makeTable({ id: 't-2', status: 'OCCUPIED', occupied_since: tenMinAgo }),
        makeTable({ id: 't-3', status: 'OCCUPIED', occupied_since: twentyMinAgo }),
        makeTable({ id: 't-4', status: 'AVAILABLE', is_merged: true, merged_table_ids: ['t-5'] }),
      ]);

      const result = await service.getTableStatus('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.total).toBe(4);
        expect(result.data.available).toBe(2);
        expect(result.data.occupied).toBe(2);
        expect(result.data.merged).toBe(1);
        expect(result.data.averageStayMinutes).toBeGreaterThanOrEqual(14);
        expect(result.data.averageStayMinutes).toBeLessThanOrEqual(16);
        expect(result.data.tables).toHaveLength(4);
      }
    });

    it('debe retornar averageStayMinutes null si no hay ocupadas', async () => {
      prisma.tables.findMany.mockResolvedValue([
        makeTable({ status: 'AVAILABLE' }),
      ]);

      const result = await service.getTableStatus('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.averageStayMinutes).toBeNull();
      }
    });

    it('debe calcular stayMinutes por mesa', async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      prisma.tables.findMany.mockResolvedValue([
        makeTable({ status: 'OCCUPIED', occupied_since: fiveMinAgo }),
      ]);

      const result = await service.getTableStatus('tenant-1');
      expect(result.success).toBe(true);
      if (result.success) {
        const table = result.data.tables[0];
        expect(table.stayMinutes).toBeGreaterThanOrEqual(4);
        expect(table.stayMinutes).toBeLessThanOrEqual(6);
      }
    });
  });

  // ========================================================================
  // updateGuestCount
  // ========================================================================

  describe('updateGuestCount', () => {
    it('debe actualizar guest count', async () => {
      prisma.tables.findFirst.mockResolvedValue(
        makeTable({ status: 'OCCUPIED', current_order_id: 'order-1' }),
      );
      prisma.orders.findFirst.mockResolvedValue({ id: 'order-1' });

      const result = await service.updateGuestCount('tenant-1', 'table-1', 5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.guestCount).toBe(5);
      }
    });

    it('debe rechazar guestCount inválido', async () => {
      const result = await service.updateGuestCount('tenant-1', 'table-1', 0);
      expect(result.success).toBe(false);
    });

    it('debe rechazar mesa no ocupada', async () => {
      prisma.tables.findFirst.mockResolvedValue(makeTable({ status: 'AVAILABLE' }));
      const result = await service.updateGuestCount('tenant-1', 'table-1', 3);
      expect(result.success).toBe(false);
    });

    it('debe rechazar mesa sin orden', async () => {
      prisma.tables.findFirst.mockResolvedValue(
        makeTable({ status: 'OCCUPIED', current_order_id: null }),
      );
      const result = await service.updateGuestCount('tenant-1', 'table-1', 3);
      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // getOccupancyHistory
  // ========================================================================

  describe('getOccupancyHistory', () => {
    it('debe calcular métricas de historial', async () => {
      const baseDate = new Date('2025-12-15T14:00:00Z');
      const orders = [
        {
          id: 'o-1',
          created_at: new Date('2025-12-15T12:00:00Z'),
          updated_at: new Date('2025-12-15T13:30:00Z'),
          table_id: 't-1',
        },
        {
          id: 'o-2',
          created_at: new Date('2025-12-15T14:00:00Z'),
          updated_at: new Date('2025-12-15T15:00:00Z'),
          table_id: 't-2',
        },
      ];
      prisma.orders.findMany.mockResolvedValue(orders);
      prisma.tables.count.mockResolvedValue(5);

      const result = await service.getOccupancyHistory(
        'tenant-1', 'loc-1', '2025-12-15', '2025-12-15',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalSessions).toBe(2);
        expect(result.data.averageStayMinutes).toBe(75); // (90+60)/2
        expect(result.data.peakHour).toBeTypeOf('number');
      }
    });

    it('debe retornar vacío si no hay órdenes', async () => {
      prisma.orders.findMany.mockResolvedValue([]);
      prisma.tables.count.mockResolvedValue(5);

      const result = await service.getOccupancyHistory(
        'tenant-1', undefined, '2025-12-01', '2025-12-31',
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalSessions).toBe(0);
        expect(result.data.peakHour).toBeNull();
      }
    });
  });
});
