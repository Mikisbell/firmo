/**
 * Table QR Service - Tests
 *
 * @module core/tables/__tests__/table-qr.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableQrService } from '../table-qr.service';

// Mock prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenants: {
      findFirst: vi.fn(),
    },
    tenant_settings: {
      findUnique: vi.fn(),
    },
    tables: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    products: {
      findMany: vi.fn(),
    },
  },
}));

// Mock QR generator
vi.mock('@/src/core/payments/qr-generator.service', () => ({
  qrGeneratorService: {
    generateGenericQR: vi.fn().mockResolvedValue({
      success: true,
      data: 'data:image/png;base64,TESTQR',
    }),
  },
}));

import prisma from '@/src/core/db/prisma';
import { qrGeneratorService } from '@/src/core/payments/qr-generator.service';

describe('TableQrService', () => {
  const service = new TableQrService(prisma as any);
  const BASE_URL = 'https://mirestaurante.park.pe';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // generateTableQRUrl
  // ========================================================================

  describe('generateTableQRUrl', () => {
    it('debe generar URL con formato correcto', () => {
      const url = service.generateTableQRUrl('mi-polleria', 'table-uuid-123', BASE_URL);
      expect(url).toBe('https://mirestaurante.park.pe/menu/mi-polleria/table-uuid-123');
    });

    it('debe manejar slugs con caracteres especiales', () => {
      const url = service.generateTableQRUrl('el-pollo-de-oro', 'tbl-1', 'https://app.com');
      expect(url).toBe('https://app.com/menu/el-pollo-de-oro/tbl-1');
    });
  });

  // ========================================================================
  // generateTableQRDataUrl
  // ========================================================================

  describe('generateTableQRDataUrl', () => {
    it('debe generar QR data URL válido', async () => {
      const result = await service.generateTableQRDataUrl('mi-polleria', 'table-1', BASE_URL);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.qrDataUrl).toContain('data:image/png;base64,');
        expect(result.data.menuUrl).toBe(`${BASE_URL}/menu/mi-polleria/table-1`);
      }
    });

    it('debe retornar error si slug vacío', async () => {
      const result = await service.generateTableQRDataUrl('', 'table-1', BASE_URL);
      expect(result.success).toBe(false);
    });

    it('debe retornar error si tableId vacío', async () => {
      const result = await service.generateTableQRDataUrl('slug', '', BASE_URL);
      expect(result.success).toBe(false);
    });

    it('debe retornar error si baseUrl vacío', async () => {
      const result = await service.generateTableQRDataUrl('slug', 'table-1', '');
      expect(result.success).toBe(false);
    });

    it('debe usar error correction level H', async () => {
      await service.generateTableQRDataUrl('slug', 'table-1', BASE_URL);

      expect(qrGeneratorService.generateGenericQR).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ errorCorrectionLevel: 'H' }),
      );
    });
  });

  // ========================================================================
  // generateAllTableQRs
  // ========================================================================

  describe('generateAllTableQRs', () => {
    it('debe generar QR para todas las mesas activas', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        slug: 'mi-polleria',
        name: 'Mi Pollería',
      } as any);

      vi.mocked(prisma.tables.findMany).mockResolvedValueOnce([
        { id: 'tbl-1', number: '1', display_name: null },
        { id: 'tbl-2', number: '2', display_name: 'VIP' },
      ] as any);

      const result = await service.generateAllTableQRs('tenant-1', 'loc-1', BASE_URL);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].tableNumber).toBe('1');
        expect(result.data[0].displayName).toBe('Mesa 1');
        expect(result.data[1].displayName).toBe('VIP');
        expect(result.data[0].qrDataUrl).toContain('data:image/png;base64,');
        expect(result.data[0].menuUrl).toContain('/menu/mi-polleria/tbl-1');
      }
    });

    it('debe retornar error si tenant sin slug', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        slug: null,
        name: 'Test',
      } as any);

      const result = await service.generateAllTableQRs('tenant-1', 'loc-1', BASE_URL);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('slug');
      }
    });

    it('debe retornar array vacío si no hay mesas', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        slug: 'test',
        name: 'Test',
      } as any);
      vi.mocked(prisma.tables.findMany).mockResolvedValueOnce([]);

      const result = await service.generateAllTableQRs('tenant-1', 'loc-1', BASE_URL);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('debe filtrar por location_id y solo mesas activas', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        slug: 'test',
        name: 'Test',
      } as any);
      vi.mocked(prisma.tables.findMany).mockResolvedValueOnce([]);

      await service.generateAllTableQRs('tenant-1', 'loc-42', BASE_URL);

      expect(prisma.tables.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: 'tenant-1',
            location_id: 'loc-42',
            is_active: true,
          },
        }),
      );
    });
  });

  // ========================================================================
  // resolveTableMenu
  // ========================================================================

  describe('resolveTableMenu', () => {
    it('debe resolver menú con productos agrupados por categoría', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'Pollería El Dorado',
      } as any);

      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        logo_url: 'https://logo.png',
        address_text: 'Av. Principal 123',
      } as any);

      vi.mocked(prisma.tables.findFirst).mockResolvedValueOnce({
        id: 'tbl-1',
        number: '5',
        display_name: 'Terraza 5',
      } as any);

      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([
        { id: 'p1', name: 'Pollo a la Brasa', price_cents: 3500, category: 'Pollos', images: [] },
        { id: 'p2', name: '1/4 Pollo', price_cents: 1800, category: 'Pollos', images: [] },
        { id: 'p3', name: 'Inca Kola 1L', price_cents: 800, category: 'Bebidas', images: [] },
      ] as any);

      const result = await service.resolveTableMenu('el-dorado', 'tbl-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenant.name).toBe('Pollería El Dorado');
        expect(result.data.tenant.logoUrl).toBe('https://logo.png');
        expect(result.data.tenant.address).toBe('Av. Principal 123');

        expect(result.data.table.number).toBe('5');
        expect(result.data.table.displayName).toBe('Terraza 5');

        expect(result.data.categories).toHaveLength(2);
        const pollos = result.data.categories.find((c) => c.name === 'Pollos');
        expect(pollos?.products).toHaveLength(2);
        const bebidas = result.data.categories.find((c) => c.name === 'Bebidas');
        expect(bebidas?.products).toHaveLength(1);
      }
    });

    it('debe retornar error si tenant no existe', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce(null);

      const result = await service.resolveTableMenu('no-existe', 'tbl-1');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('no-existe');
      }
    });

    it('debe retornar error si mesa no existe', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'Test',
      } as any);
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.tables.findFirst).mockResolvedValueOnce(null);

      const result = await service.resolveTableMenu('test', 'tbl-inexistente');

      expect(result.success).toBe(false);
    });

    it('debe solo incluir productos activos y disponibles', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'Test',
      } as any);
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.tables.findFirst).mockResolvedValueOnce({
        id: 'tbl-1', number: '1', display_name: null,
      } as any);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);

      await service.resolveTableMenu('test', 'tbl-1');

      expect(prisma.products.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
            is_available: true,
          }),
        }),
      );
    });

    it('debe agrupar productos sin categoría bajo "Otros"', async () => {
      vi.mocked(prisma.tenants.findFirst).mockResolvedValueOnce({
        id: 'tenant-1',
        name: 'Test',
      } as any);
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce(null);
      vi.mocked(prisma.tables.findFirst).mockResolvedValueOnce({
        id: 'tbl-1', number: '1', display_name: null,
      } as any);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([
        { id: 'p1', name: 'Producto sin cat', price_cents: 1000, category: null, images: [] },
      ] as any);

      const result = await service.resolveTableMenu('test', 'tbl-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.categories[0].name).toBe('Otros');
        expect(result.data.categories[0].products).toHaveLength(1);
      }
    });
  });
});
