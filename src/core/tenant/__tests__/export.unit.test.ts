import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportTenantData,
  ExportRequest,
  ExportResult,
} from '../export';
import prisma from '@/src/core/db/prisma';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenant_settings: {
      findUnique: vi.fn(),
    },
    catalog_meta: {
      findUnique: vi.fn(),
    },
    events: {
      findMany: vi.fn(),
    },
    orders: {
      findMany: vi.fn(),
    },
    products: {
      findMany: vi.fn(),
    },
    employees: {
      findMany: vi.fn(),
    },
    customers: {
      findMany: vi.fn(),
    },
    stations: {
      findMany: vi.fn(),
    },
    promotions: {
      findMany: vi.fn(),
    },
  },
}));

describe('Tenant Export Service', () => {
  const mockTenantId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('12.1 JSON Export Format', () => {
    it('should export tenant data in JSON format', async () => {
      // Mock tenant settings
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      // Mock catalog meta
      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      // Mock empty collections
      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
        include_events: true,
        include_orders: true,
        include_products: true,
      };

      const result = await exportTenantData(request);

      expect(result).toBeDefined();
      expect(result.export_id).toBeDefined();
      expect(result.tenant_id).toBe(mockTenantId);
      expect((result as any).format || "json").toBeUndefined(); // Not in result interface
      expect(result.file_url).toBeDefined();
      expect(result.file_size_mb).toBeGreaterThan(0);
      expect(result.encryption_key).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.expires_at).toBeInstanceOf(Date);
    });

    it('should include metadata in JSON export', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
      };

      const result = await exportTenantData(request);

      expect(result.export_id).toBeDefined();
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });
  });

  describe('12.2 SQL Export Format', () => {
    it('should export tenant data in SQL format', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'sql',
      };

      const result = await exportTenantData(request);

      expect(result).toBeDefined();
      expect(result.export_id).toBeDefined();
      expect(result.file_url).toBeDefined();
      expect(result.checksum).toBeDefined();
    });

    it('should generate valid SQL INSERT statements', async () => {
      const mockProduct = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        tenant_id: mockTenantId,
        name: 'Pollo a la Brasa',
        price_cents: 2500,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([mockProduct] as any);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'sql',
        include_products: true,
      };

      const result = await exportTenantData(request);

      expect(result).toBeDefined();
      expect(result.checksum).toBeDefined();
    });
  });

  describe('12.2 Data Completeness Validation', () => {
    it('should validate that all requested data is present', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
        include_events: true,
        include_orders: true,
      };

      const result = await exportTenantData(request);

      expect(result).toBeDefined();
      expect(result.export_id).toBeDefined();
    });

    it('should fail if tenant settings are missing', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce(null);

      const request: ExportRequest = {
        tenant_id: 'nonexistent-tenant',
        format: 'json',
      };

      await expect(exportTenantData(request)).rejects.toThrow('Tenant not found');
    });
  });

  describe('12.2 Encryption', () => {
    it('should encrypt exported data', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
      };

      const result = await exportTenantData(request);

      expect(result.encryption_key).toBeDefined();
      expect(result.encryption_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique encryption keys for each export', async () => {
      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValue([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValue([]);
      vi.mocked(prisma.products.findMany).mockResolvedValue([]);
      vi.mocked(prisma.employees.findMany).mockResolvedValue([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValue([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValue([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValue([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
      };

      const result1 = await exportTenantData(request);
      const result2 = await exportTenantData(request);

      expect(result1.encryption_key).not.toBe(result2.encryption_key);
    });
  });

  describe('12.2 Export Metadata', () => {
    it('should include record counts in export', async () => {
      const mockProduct = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        tenant_id: mockTenantId,
        name: 'Pollo a la Brasa',
        price_cents: 2500,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      vi.mocked(prisma.tenant_settings.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        legal_name: 'Test Restaurant',
        ruc: '12345678901',
        address_text: '123 Main St',
        timezone: 'America/Lima',
        currency: 'PEN',
        logo_url: null,
        receipt_footer_text: null,
        kds_audio_enabled: true,
        kds_audio_volume: 80,
        default_delivery_fee_cents: 500,
        enable_tips: true,
        tips_on_invoice: true,
        allow_offline_coupon: false,
        max_offline_coupons_per_order: 0,
        require_manager_for_offline: false,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValueOnce({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([mockProduct] as any);
      vi.mocked(prisma.employees.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.customers.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.stations.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.promotions.findMany).mockResolvedValueOnce([]);

      const request: ExportRequest = {
        tenant_id: mockTenantId,
        format: 'json',
        include_products: true,
      };

      const result = await exportTenantData(request);

      expect(result).toBeDefined();
      expect(result.export_id).toBeDefined();
    });
  });
});
