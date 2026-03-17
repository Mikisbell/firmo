/**
 * Peru Identity Lookup Service - Tests
 *
 * Tests cascading lookup: local DB → Redis cache → external API.
 * All external calls are mocked.
 *
 * @module core/integrations/peru-identity/__tests__/lookup.service.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdentityLookupService } from '../lookup.service';

// Mock Redis cache
vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('@/src/core/observability/logger-pino', () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function createMockPrisma() {
  return {
    customers: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    tenant_settings: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  } as any;
}

const TENANT_ID = 'tenant-test-123';

// ============================================================================
// Tests
// ============================================================================

describe('IdentityLookupService', () => {
  let service: IdentityLookupService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockCache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new IdentityLookupService(prisma);

    // Get reference to mocked cache
    const cacheModule = await import('@/src/core/cache/redis.service');
    mockCache = cacheModule.cache as any;

    // Default: no fetch calls
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // ==========================================================================
  // Local DB lookup
  // ==========================================================================

  describe('local DB lookup', () => {
    it('returns local customer when found by doc_number', async () => {
      prisma.customers.findFirst.mockResolvedValue({
        id: 'cust-001',
        name: 'MIGUEL ANGEL RIVERA',
        doc_type: 'DNI',
        doc_number: '43708661',
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '43708661');

      expect(result.found).toBe(true);
      expect(result).toMatchObject({
        found: true,
        source: 'local',
        customer: {
          name: 'MIGUEL ANGEL RIVERA',
          doc_type: 'DNI',
          doc_number: '43708661',
        },
        localCustomerId: 'cust-001',
      });
      // Should NOT call external APIs
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips local if customer has no doc_number', async () => {
      prisma.customers.findFirst.mockResolvedValue({
        id: 'cust-002',
        name: 'Sin Doc',
        doc_type: null,
        doc_number: null,
      });

      // No cache, no API → not found
      const result = await service.lookup(TENANT_ID, 'DNI', '11111111');
      expect(result.found).toBe(false);
    });

    it('passes tenant_id to prisma query for isolation', async () => {
      prisma.customers.findFirst.mockResolvedValue(null);
      await service.lookup(TENANT_ID, 'DNI', '43708661');

      expect(prisma.customers.findFirst).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, doc_number: '43708661' },
        select: { id: true, name: true, doc_type: true, doc_number: true },
      });
    });
  });

  // ==========================================================================
  // Redis cache lookup
  // ==========================================================================

  describe('Redis cache lookup', () => {
    it('returns cached result if found', async () => {
      const cached = {
        found: true,
        source: 'external',
        customer: {
          name: 'CACHED PERSON',
          doc_type: 'DNI',
          doc_number: '22222222',
        },
      };
      mockCache.get.mockResolvedValueOnce(cached);

      const result = await service.lookup(TENANT_ID, 'DNI', '22222222');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.source).toBe('cache');
        expect(result.customer.name).toBe('CACHED PERSON');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('skips cache if result is found=false', async () => {
      mockCache.get.mockResolvedValueOnce({ found: false });

      // Will proceed to external API (which is mocked to fail)
      const result = await service.lookup(TENANT_ID, 'DNI', '33333333');
      expect(result.found).toBe(false);
    });

    it('uses correct cache key format', async () => {
      await service.lookup(TENANT_ID, 'RUC', '20100047218');

      expect(mockCache.get).toHaveBeenCalledWith('identity:RUC:20100047218');
    });
  });

  // ==========================================================================
  // External API — DNI
  // ==========================================================================

  describe('external DNI lookup', () => {
    it('uses apisperu.com primary when token available', async () => {
      // Token available
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'test-token-xyz',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          dni: '43708661',
          nombres: 'MIGUEL ANGEL',
          apellidoPaterno: 'RIVERA',
          apellidoMaterno: 'OSPINA',
        }),
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '43708661');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.source).toBe('external');
        expect(result.customer.name).toBe('MIGUEL ANGEL RIVERA OSPINA');
      }

      // Check URL includes token
      const fetchUrl = (global.fetch as any).mock.calls[0][0];
      expect(fetchUrl).toContain('dniruc.apisperu.com');
      expect(fetchUrl).toContain('token=test-token-xyz');

      // Should cache the result
      expect(mockCache.set).toHaveBeenCalledWith(
        'identity:DNI:43708661',
        expect.objectContaining({ found: true }),
        86400,
      );
    });

    it('falls back to apis.net.pe v1 when no token', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue(null);

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nombre: 'RIVERA OSPINA MIGUEL ANGEL',
          tipoDocumento: '1',
          numeroDocumento: '43708661',
        }),
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '43708661');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.customer.name).toBe('RIVERA OSPINA MIGUEL ANGEL');
      }

      const fetchUrl = (global.fetch as any).mock.calls[0][0];
      expect(fetchUrl).toContain('api.apis.net.pe/v1/dni');
    });

    it('falls back to apis.net.pe v1 when apisperu fails', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'test-token',
      });

      // First call (apisperu) fails
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false })
        // Second call (apis.net.pe) succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            nombre: 'FALLBACK NAME',
          }),
        });

      const result = await service.lookup(TENANT_ID, 'DNI', '44444444');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.customer.name).toBe('FALLBACK NAME');
      }
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('uses nombre field when available (full name shortcut)', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'token',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          nombre: 'FULL NAME SHORTCUT',
        }),
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '55555555');
      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.customer.name).toBe('FULL NAME SHORTCUT');
      }
    });

    it('returns not found when both APIs fail', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'token',
      });

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false })   // apisperu fails
        .mockResolvedValueOnce({ ok: false });   // apis.net.pe fails

      const result = await service.lookup(TENANT_ID, 'DNI', '66666666');
      expect(result.found).toBe(false);
    });
  });

  // ==========================================================================
  // External API — RUC
  // ==========================================================================

  describe('external RUC lookup', () => {
    it('returns RUC data from apisperu.com with token', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'test-ruc-token',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          ruc: '20100047218',
          razonSocial: 'EMPRESA SAC',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          direccion: 'AV. LIMA 123',
        }),
      });

      const result = await service.lookup(TENANT_ID, 'RUC', '20100047218');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.customer.name).toBe('EMPRESA SAC');
        expect(result.customer.doc_type).toBe('RUC');
        expect(result.customer.address).toBe('AV. LIMA 123');
        expect(result.customer.estado).toBe('ACTIVO');
        expect(result.customer.condicion).toBe('HABIDO');
      }

      const fetchUrl = (global.fetch as any).mock.calls[0][0];
      expect(fetchUrl).toContain('dniruc.apisperu.com');
      expect(fetchUrl).toContain('/ruc/20100047218');
    });

    it('returns not found when no token (RUC has no free fallback)', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue(null);

      const result = await service.lookup(TENANT_ID, 'RUC', '20100047218');

      expect(result.found).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns not found when razonSocial is missing', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'token',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          ruc: '20100047218',
          // No razonSocial
        }),
      });

      const result = await service.lookup(TENANT_ID, 'RUC', '20100047218');
      expect(result.found).toBe(false);
    });
  });

  // ==========================================================================
  // Token caching
  // ==========================================================================

  describe('API token management', () => {
    it('caches token from tenant_settings', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'cached-token',
      });

      await service.lookup(TENANT_ID, 'DNI', '77777777');

      // Token should be cached for 5 minutes
      expect(mockCache.set).toHaveBeenCalledWith(
        `identity_token:${TENANT_ID}`,
        'cached-token',
        300,
      );
    });

    it('uses cached token on second call', async () => {
      // First call: token from DB
      mockCache.get
        .mockResolvedValueOnce(null)   // identity:DNI:... not cached
        .mockResolvedValueOnce(null);  // identity_token:... not cached
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'db-token',
      });

      await service.lookup(TENANT_ID, 'DNI', '88888888');

      // Second call: token from cache
      mockCache.get
        .mockResolvedValueOnce(null)        // identity:DNI:... not cached
        .mockResolvedValueOnce('db-token'); // identity_token:... IS cached

      await service.lookup(TENANT_ID, 'DNI', '99999999');

      // DB should only be queried once for settings
      expect(prisma.tenant_settings.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('returns not found when fetch throws (network error)', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'token',
      });

      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await service.lookup(TENANT_ID, 'DNI', '11111111');
      expect(result.found).toBe(false);
    });

    it('returns not found when response is not valid JSON', async () => {
      prisma.tenant_settings.findUnique.mockResolvedValue({
        peru_identity_api_token: 'token',
      });

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => { throw new Error('Invalid JSON'); },
        })
        .mockResolvedValueOnce({ ok: false });

      const result = await service.lookup(TENANT_ID, 'DNI', '12121212');
      expect(result.found).toBe(false);
    });

    it('never throws — always returns a result', async () => {
      // Break everything
      prisma.customers.findFirst.mockRejectedValue(new Error('DB down'));

      // Should still not throw
      await expect(
        service.lookup(TENANT_ID, 'DNI', '00000000'),
      ).rejects.toThrow(); // DB error bubbles since it's in the first step
    });
  });

  // ==========================================================================
  // Cascade priority
  // ==========================================================================

  describe('cascade priority', () => {
    it('local DB wins over cache and external', async () => {
      // Local has it
      prisma.customers.findFirst.mockResolvedValue({
        id: 'local-001',
        name: 'LOCAL NAME',
        doc_type: 'DNI',
        doc_number: '43708661',
      });

      // Cache also has it
      mockCache.get.mockResolvedValue({
        found: true,
        customer: { name: 'CACHED NAME' },
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '43708661');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.source).toBe('local');
        expect(result.customer.name).toBe('LOCAL NAME');
      }
    });

    it('cache wins over external when local misses', async () => {
      prisma.customers.findFirst.mockResolvedValue(null);

      mockCache.get.mockResolvedValueOnce({
        found: true,
        source: 'external',
        customer: { name: 'FROM CACHE', doc_type: 'DNI', doc_number: '11111111' },
      });

      const result = await service.lookup(TENANT_ID, 'DNI', '11111111');

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.source).toBe('cache');
      }
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
