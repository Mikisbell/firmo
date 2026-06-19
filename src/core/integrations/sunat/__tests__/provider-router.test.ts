/**
 * InvoiceProviderRouter Unit Tests
 *
 * Tests provider resolution logic:
 * - SUNAT_DIRECT -> SunatDirectAdapterImpl
 * - NUBEFACT -> NubefactAdapterWrapper
 * - NONE/DISABLED -> error
 * - Missing credentials -> error
 * - Caching: same tenant -> same adapter instance
 *
 * @module core/integrations/sunat/__tests__/provider-router.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TenantSunatCredentials } from '../provider-config';

// ============================================================================
// Mocks
// ============================================================================

const mockGetTenantSunatConfig = vi.fn<(tenantId: string) => Promise<TenantSunatCredentials | null>>();

vi.mock('../provider-config', () => ({
  getTenantSunatConfig: (...args: any[]) => mockGetTenantSunatConfig(args[0]),
  DEFAULT_EMISOR_GEO: { ubigeo: '150101', departamento: 'LIMA', provincia: 'LIMA', distrito: 'LIMA' },
}));

vi.mock('nodefact', () => ({
  generateXML: vi.fn().mockReturnValue('<Invoice>mock</Invoice>'),
  signXml: vi.fn().mockResolvedValue({ success: true, signedXml: '<signed/>' }),
  createSunatClient: vi.fn().mockReturnValue({
    sendBill: vi.fn(),
    sendSummary: vi.fn(),
    getStatus: vi.fn(),
  }),
  generatePdf: vi.fn().mockResolvedValue({ success: true, buffer: Buffer.from('pdf') }),
  SunatEndpoints: {
    BETA_FACTURA: 'https://beta.sunat.gob.pe',
    PRODUCCION_FACTURA: 'https://prod.sunat.gob.pe',
  },
  TipoDocumento: { FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07', NOTA_DEBITO: '08', RESUMEN_DIARIO: 'RC', COMUNICACION_BAJA: 'RA' },
  TipoIGV: { GRAVADO_OPERACION_ONEROSA: '10' },
  TipoMoneda: { PEN: 'PEN' },
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { InvoiceProviderRouter } from '../provider-router';
import { SunatDirectAdapterImpl } from '../sunat-direct-adapter';
import { NubefactAdapterWrapper } from '../nubefact-adapter-wrapper';

// ============================================================================
// Test data
// ============================================================================

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeSunatDirectConfig(): TenantSunatCredentials {
  return {
    provider: 'SUNAT_DIRECT',
    mode: 'BETA',
    solUser: 'MODDATOS',
    solPassword: 'MODDATOS',
    certificatePem: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
    privateKeyPem: '-----BEGIN RSA PRIVATE KEY-----\nMIIB...\n-----END RSA PRIVATE KEY-----',
    ruc: '20123456789',
  };
}

function makeNubefactConfig(): TenantSunatCredentials {
  return {
    provider: 'NUBEFACT',
    mode: 'PRODUCTION',
    nubefactToken: 'test-nubefact-token-abc123',
    nubefactUrl: 'https://api.nubefact.com/api/v1',
    ruc: '20123456789',
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('InvoiceProviderRouter', () => {
  let router: InvoiceProviderRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new InvoiceProviderRouter();
  });

  describe('getProvider', () => {
    it('should resolve SUNAT_DIRECT to SunatDirectAdapterImpl', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeSunatDirectConfig());

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(SunatDirectAdapterImpl);
      }
    });

    it('should resolve NUBEFACT to NubefactAdapterWrapper', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeNubefactConfig());

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeInstanceOf(NubefactAdapterWrapper);
      }
    });

    it('should return error for NONE provider', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'NONE',
        mode: 'DISABLED',
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_DISABLED');
      }
    });

    it('should return error for DISABLED mode', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'SUNAT_DIRECT',
        mode: 'DISABLED',
        solUser: 'MODDATOS',
        solPassword: 'MODDATOS',
        certificatePem: 'cert',
        privateKeyPem: 'key',
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_DISABLED');
      }
    });

    it('should return error when tenant not found', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(null);

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_CONFIG_NOT_FOUND');
      }
    });

    it('should return error when SOL credentials missing for SUNAT_DIRECT', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'SUNAT_DIRECT',
        mode: 'BETA',
        // Missing solUser and solPassword
        certificatePem: 'cert',
        privateKeyPem: 'key',
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_MISSING_SOL_CREDENTIALS');
      }
    });

    it('should return error when certificate missing for SUNAT_DIRECT', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'SUNAT_DIRECT',
        mode: 'BETA',
        solUser: 'MODDATOS',
        solPassword: 'MODDATOS',
        // Missing certificatePem and privateKeyPem
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_MISSING_CERTIFICATE');
      }
    });

    it('should return error when RUC missing for SUNAT_DIRECT', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'SUNAT_DIRECT',
        mode: 'BETA',
        solUser: 'MODDATOS',
        solPassword: 'MODDATOS',
        certificatePem: 'cert',
        privateKeyPem: 'key',
        ruc: '',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_MISSING_RUC');
      }
    });

    it('should return error when Nubefact token missing', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'NUBEFACT',
        mode: 'PRODUCTION',
        nubefactUrl: 'https://api.nubefact.com/api/v1',
        // Missing nubefactToken
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_MISSING_NUBEFACT_TOKEN');
      }
    });

    it('should return error when Nubefact URL missing', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'NUBEFACT',
        mode: 'PRODUCTION',
        nubefactToken: 'token-123',
        // Missing nubefactUrl
        ruc: '20123456789',
      });

      const result = await router.getProvider(TENANT_ID);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_MISSING_NUBEFACT_URL');
      }
    });

    it('should cache adapter per-tenant (same instance on second call)', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeSunatDirectConfig());

      const result1 = await router.getProvider(TENANT_ID);
      const result2 = await router.getProvider(TENANT_ID);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      if (result1.success && result2.success) {
        expect(result1.data).toBe(result2.data); // Same reference
      }

      // getTenantSunatConfig should only be called once (cached second time)
      expect(mockGetTenantSunatConfig).toHaveBeenCalledTimes(1);
    });

    it('should load fresh config after clearCache', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeSunatDirectConfig());

      await router.getProvider(TENANT_ID);
      router.clearCache(TENANT_ID);
      await router.getProvider(TENANT_ID);

      expect(mockGetTenantSunatConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('isEnabled', () => {
    it('should return true for SUNAT_DIRECT + BETA', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeSunatDirectConfig());
      expect(await router.isEnabled(TENANT_ID)).toBe(true);
    });

    it('should return true for NUBEFACT + PRODUCTION', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(makeNubefactConfig());
      expect(await router.isEnabled(TENANT_ID)).toBe(true);
    });

    it('should return false for DISABLED mode', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'SUNAT_DIRECT',
        mode: 'DISABLED',
        ruc: '20123456789',
      });
      expect(await router.isEnabled(TENANT_ID)).toBe(false);
    });

    it('should return false for NONE provider', async () => {
      mockGetTenantSunatConfig.mockResolvedValue({
        provider: 'NONE',
        mode: 'BETA',
        ruc: '20123456789',
      });
      expect(await router.isEnabled(TENANT_ID)).toBe(false);
    });

    it('should return false when tenant not found', async () => {
      mockGetTenantSunatConfig.mockResolvedValue(null);
      expect(await router.isEnabled(TENANT_ID)).toBe(false);
    });
  });
});
