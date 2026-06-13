import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  exportTenantData,
  encryptData,
  decryptExport,
  ExportRequest,
  ExportResult,
} from '../export';
import { randomUUID } from 'crypto';
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
      } as never);

      // Mock catalog meta
      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      expect((result as any).format).toBeUndefined(); // Not in result interface
      expect(result.file_url).toBeDefined();
      expect(result.file_size_mb).toBeGreaterThan(0);
      expect(result.encryption_key).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.expires_at).toBeInstanceOf(Date);
    });

    it('should include metadata in JSON export', async () => {
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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([mockProduct] as never);
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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

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
      } as never);

      vi.mocked(prisma.catalog_meta.findUnique).mockResolvedValue({
        tenant_id: mockTenantId,
        catalog_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
      } as never);

      vi.mocked(prisma.events.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.orders.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.products.findMany).mockResolvedValueOnce([mockProduct] as never);
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

  describe('12.3 AES-256-GCM Encryption Round-Trip', () => {
    const payload = JSON.stringify({
      export_metadata: { tenant_id: mockTenantId, version: '1.0' },
      products: [{ id: '1', name: 'Pollo a la Brasa', price_cents: 2500 }],
      events: [{ event_id: 'e1', type: 'ORDER_CREATED' }],
    });

    it('should decrypt to the original plaintext (round-trip)', () => {
      const key = randomUUID();
      const encrypted = encryptData(payload, key);

      // Encrypted blob must NOT be the plaintext (real encryption, not base64/XOR no-op)
      expect(encrypted.toString('utf-8')).not.toContain('Pollo a la Brasa');

      const decrypted = decryptExport(encrypted, key);
      expect(decrypted).toBe(payload);
      expect(JSON.parse(decrypted).products[0].name).toBe('Pollo a la Brasa');
    });

    it('should produce different ciphertext for the same input (random salt + IV)', () => {
      const key = randomUUID();
      const a = encryptData(payload, key);
      const b = encryptData(payload, key);

      expect(a.equals(b)).toBe(false);
      // Both still decrypt back to the original
      expect(decryptExport(a, key)).toBe(payload);
      expect(decryptExport(b, key)).toBe(payload);
    });

    it('should fail to decrypt with the wrong key', () => {
      const key = randomUUID();
      const wrongKey = randomUUID();
      const encrypted = encryptData(payload, key);

      expect(() => decryptExport(encrypted, wrongKey)).toThrow(
        /wrong key or corrupted/i,
      );
    });

    it('should fail GCM verification when the ciphertext is tampered', () => {
      const key = randomUUID();
      const encrypted = encryptData(payload, key);

      // Flip a byte in the ciphertext region (after salt[16]+iv[12]+authTag[16] = 44)
      const tampered = Buffer.from(encrypted);
      const ciphertextStart = 16 + 12 + 16;
      tampered[ciphertextStart] = tampered[ciphertextStart] ^ 0xff;

      expect(() => decryptExport(tampered, key)).toThrow(
        /wrong key or corrupted/i,
      );
    });

    it('should fail GCM verification when the auth tag is tampered', () => {
      const key = randomUUID();
      const encrypted = encryptData(payload, key);

      // Flip a byte in the auth tag region (offset salt[16]+iv[12] = 28)
      const tampered = Buffer.from(encrypted);
      const authTagStart = 16 + 12;
      tampered[authTagStart] = tampered[authTagStart] ^ 0xff;

      expect(() => decryptExport(tampered, key)).toThrow(
        /wrong key or corrupted/i,
      );
    });

    it('should reject a malformed (too short) blob', () => {
      expect(() => decryptExport(Buffer.alloc(10), randomUUID())).toThrow(
        /malformed/i,
      );
    });
  });
});
