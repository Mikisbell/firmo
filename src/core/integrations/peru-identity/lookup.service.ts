/**
 * Peru Identity Lookup Service
 *
 * Cascading lookup: local DB → Redis cache → external API
 *
 * Provider priority:
 * 1. apisperu.com (primary) — 2,000 free/month DNI+RUC, token required
 * 2. apis.net.pe v1 (fallback) — free DNI only, no token needed
 *
 * A customer that comes back a 2nd time NEVER hits the external API —
 * it resolves from the local customers table instantly.
 *
 * @module core/integrations/peru-identity/lookup
 */

import { PrismaClient } from '@prisma/client';
import { cache } from '@/src/core/cache/redis.service';
import { createRequestLogger } from '@/src/core/observability/logger-pino';
import { randomUUID } from 'crypto';
import {
  ApisPeruDniSchema,
  ApisPeruRucSchema,
  ApisNetPeV1DniSchema,
  type LookupResult,
} from './schemas';

const CACHE_TTL_SECONDS = 86400; // 24 hours
const API_TIMEOUT_MS = 5000;

// Primary: apisperu.com (2,000 free/month, S/30/mo unlimited)
const APISPERU_BASE = 'https://dniruc.apisperu.com/api/v1';

// Fallback: apis.net.pe v1 (free DNI only, ~25/day)
const APIS_NET_PE_V1_BASE = 'https://api.apis.net.pe/v1';

export class IdentityLookupService {
  constructor(private prisma: PrismaClient) {}

  async lookup(
    tenantId: string,
    docType: 'DNI' | 'RUC',
    docNumber: string,
  ): Promise<LookupResult> {
    const log = createRequestLogger(randomUUID(), 'system', { operation: 'identity_lookup' });

    // 1. Local DB lookup (instant — covers returning customers)
    const local = await this.lookupLocal(tenantId, docNumber);
    if (local) {
      log.info({ docType, source: 'local' }, 'Identity found in local DB');
      return local;
    }

    // 2. Redis cache lookup (covers recent external lookups)
    const cacheKey = `identity:${docType}:${docNumber}`;
    const cached = await cache.get<LookupResult>(cacheKey);
    if (cached && cached.found) {
      log.info({ docType, source: 'cache' }, 'Identity found in cache');
      return { ...cached, source: 'cache' };
    }

    // 3. External API lookup (only for NEW customers)
    const token = await this.getApiToken(tenantId);
    const external = docType === 'DNI'
      ? await this.lookupDniExternal(docNumber, token)
      : await this.lookupRucExternal(docNumber, token);

    if (external && external.found) {
      await cache.set(cacheKey, external, CACHE_TTL_SECONDS);
      log.info({ docType, source: 'external' }, 'Identity found via external API');
      return external;
    }

    log.info({ docType }, 'Identity not found in any source');
    return { found: false };
  }

  private async lookupLocal(tenantId: string, docNumber: string): Promise<LookupResult | null> {
    const customer = await this.prisma.customers.findFirst({
      where: { tenant_id: tenantId, doc_number: docNumber },
      select: { id: true, name: true, doc_type: true, doc_number: true },
    });

    if (!customer || !customer.doc_number) return null;

    return {
      found: true,
      source: 'local',
      customer: {
        name: customer.name || '',
        doc_type: customer.doc_type as 'DNI' | 'RUC',
        doc_number: customer.doc_number,
      },
      localCustomerId: customer.id,
    };
  }

  private async getApiToken(tenantId: string): Promise<string | null> {
    const tokenCacheKey = `identity_token:${tenantId}`;
    const cached = await cache.get<string>(tokenCacheKey);
    if (cached) return cached;

    const settings = await this.prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { peru_identity_api_token: true },
    });

    const token = settings?.peru_identity_api_token || null;
    if (token) {
      await cache.set(tokenCacheKey, token, 300); // 5 min cache
    }
    return token;
  }

  // === DNI Lookup ===

  private async lookupDniExternal(docNumber: string, token: string | null): Promise<LookupResult> {
    // Try apisperu.com first (primary, needs token)
    if (token) {
      const result = await this.lookupDniApisperu(docNumber, token);
      if (result.found) return result;
    }

    // Fallback: apis.net.pe v1 (free, no token)
    return this.lookupDniApisNetPe(docNumber);
  }

  private async lookupDniApisperu(docNumber: string, token: string): Promise<LookupResult> {
    const data = await this.fetchWithTimeout(
      `${APISPERU_BASE}/dni/${docNumber}?token=${token}`,
      {},
    );

    if (!data) return { found: false };

    const parsed = ApisPeruDniSchema.safeParse(data);
    if (!parsed.success || !parsed.data.success) return { found: false };

    const { nombres, apellidoPaterno, apellidoMaterno, nombre } = parsed.data;
    const fullName = nombre
      || [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ');

    if (!fullName) return { found: false };

    return {
      found: true,
      source: 'external',
      customer: { name: fullName.trim(), doc_type: 'DNI', doc_number: docNumber },
    };
  }

  private async lookupDniApisNetPe(docNumber: string): Promise<LookupResult> {
    const data = await this.fetchWithTimeout(
      `${APIS_NET_PE_V1_BASE}/dni?numero=${docNumber}`,
      {},
    );

    if (!data) return { found: false };

    const parsed = ApisNetPeV1DniSchema.safeParse(data);
    if (!parsed.success) return { found: false };

    const d = parsed.data;
    const name = d.nombre
      || [d.nombres, d.apellidoPaterno, d.apellidoMaterno].filter(Boolean).join(' ');

    if (!name) return { found: false };

    return {
      found: true,
      source: 'external',
      customer: { name: name.trim(), doc_type: 'DNI', doc_number: docNumber },
    };
  }

  // === RUC Lookup ===

  private async lookupRucExternal(docNumber: string, token: string | null): Promise<LookupResult> {
    if (!token) {
      // RUC requires token (no free fallback available)
      return { found: false };
    }

    const data = await this.fetchWithTimeout(
      `${APISPERU_BASE}/ruc/${docNumber}?token=${token}`,
      {},
    );

    if (!data) return { found: false };

    const parsed = ApisPeruRucSchema.safeParse(data);
    if (!parsed.success || !parsed.data.success || !parsed.data.razonSocial) {
      return { found: false };
    }

    const { razonSocial, estado, condicion, direccion } = parsed.data;

    return {
      found: true,
      source: 'external',
      customer: {
        name: razonSocial,
        doc_type: 'RUC',
        doc_number: docNumber,
        address: direccion,
        estado,
        condicion,
      },
    };
  }

  // === HTTP Helper ===

  private async fetchWithTimeout(
    url: string,
    headers: Record<string, string>,
  ): Promise<unknown | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        headers: { ...headers, 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }
}
