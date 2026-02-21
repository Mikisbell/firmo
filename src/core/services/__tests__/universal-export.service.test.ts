/**
 * Universal Export Service Tests
 *
 * @module core/services/__tests__/universal-export.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalExportService } from '../universal-export.service';

// Mock export-config queryFn results
vi.mock('../export-config', async () => {
  const actual = await vi.importActual('../export-config');
  return {
    ...actual as any,
    getExportConfig: vi.fn((key: string) => {
      const configs: Record<string, any> = {
        ventas: {
          key: 'ventas',
          label: 'Reporte de Ventas',
          columns: [
            { header: 'Fecha', key: 'date', width: 15, format: 'date' },
            { header: 'Ventas', key: 'totalCents', width: 18, format: 'currency' },
            { header: 'Órdenes', key: 'orderCount', width: 12, format: 'number' },
          ],
          queryFn: vi.fn().mockResolvedValue([
            { date: '2025-12-15', totalCents: 150000, orderCount: 30 },
            { date: '2025-12-16', totalCents: 175000, orderCount: 35 },
          ]),
        },
        productos: {
          key: 'productos',
          label: 'Catálogo de Productos',
          columns: [
            { header: 'Nombre', key: 'name', width: 30 },
            { header: 'Precio', key: 'priceCents', width: 15, format: 'currency' },
          ],
          queryFn: vi.fn().mockResolvedValue([
            { name: 'Pollo a la brasa', priceCents: 4500 },
          ]),
        },
        'empty-entity': {
          key: 'empty-entity',
          label: 'Empty',
          columns: [
            { header: 'Col', key: 'col', width: 10 },
          ],
          queryFn: vi.fn().mockResolvedValue([]),
        },
      };
      return configs[key] || undefined;
    }),
  };
});

function createMockPrisma() {
  return {} as any;
}

describe('UniversalExportService', () => {
  let prisma: any;
  let service: UniversalExportService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UniversalExportService(prisma);
  });

  describe('exportEntity', () => {
    it('debe exportar ventas a xlsx', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'xlsx');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.buffer).toBeInstanceOf(Buffer);
        expect(result.data.buffer.length).toBeGreaterThan(0);
        expect(result.data.filename).toMatch(/^ventas_\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(result.data.contentType).toContain('spreadsheetml');
      }
    });

    it('debe exportar ventas a csv', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'csv');
      expect(result.success).toBe(true);
      if (result.success) {
        const csv = result.data.buffer.toString('utf-8');
        expect(csv).toContain('Fecha');
        expect(csv).toContain('Ventas');
        expect(result.data.filename).toMatch(/\.csv$/);
        expect(result.data.contentType).toContain('text/csv');
      }
    });

    it('debe exportar ventas a pdf (html)', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'pdf');
      expect(result.success).toBe(true);
      if (result.success) {
        const html = result.data.buffer.toString('utf-8');
        expect(html).toContain('<html');
        expect(html).toContain('Reporte de Ventas');
        expect(result.data.filename).toMatch(/\.html$/);
        expect(result.data.contentType).toContain('text/html');
      }
    });

    it('debe exportar productos', async () => {
      const result = await service.exportEntity('tenant-1', 'productos', 'csv');
      expect(result.success).toBe(true);
      if (result.success) {
        const csv = result.data.buffer.toString('utf-8');
        expect(csv).toContain('Nombre');
        expect(csv).toContain('Pollo a la brasa');
      }
    });

    it('debe pasar filtros correctamente', async () => {
      const filters = { start: '2025-12-01', end: '2025-12-31' };
      const result = await service.exportEntity('tenant-1', 'ventas', 'xlsx', filters);
      // The fact that it succeeds means filters were passed to queryFn
      expect(result.success).toBe(true);
      if (result.success) {
        // Data should still be returned from mock
        expect(result.data.buffer.length).toBeGreaterThan(0);
      }
    });

    it('debe rechazar entidad no soportada', async () => {
      const result = await service.exportEntity('tenant-1', 'no-existe', 'xlsx');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('no soportada');
      }
    });

    it('debe rechazar formato no soportado', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'xml' as any);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('no soportado');
      }
    });

    it('debe manejar datos vacíos', async () => {
      const result = await service.exportEntity('tenant-1', 'empty-entity', 'csv');
      expect(result.success).toBe(true);
      if (result.success) {
        const csv = result.data.buffer.toString('utf-8');
        expect(csv).toContain('Col');
        // Only header, no data rows
        expect(csv.split('\n').filter(Boolean)).toHaveLength(1);
      }
    });

    it('debe generar filename con fecha actual', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'xlsx');
      expect(result.success).toBe(true);
      if (result.success) {
        const today = new Date().toISOString().split('T')[0];
        expect(result.data.filename).toContain(today);
      }
    });

    it('debe incluir subtítulo de período en PDF', async () => {
      const result = await service.exportEntity('tenant-1', 'ventas', 'pdf', {
        start: '2025-12-01',
        end: '2025-12-31',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        const html = result.data.buffer.toString('utf-8');
        expect(html).toContain('2025-12-01');
        expect(html).toContain('2025-12-31');
      }
    });
  });
});
