/**
 * SUNAT Provider Configuration
 *
 * Determines which SUNAT integration provider to use:
 * - 'mock': Local mock for development (default)
 * - 'nubefact': Nubefact REST API
 * - 'sunat-direct': Direct SUNAT SOAP via nodefact
 *
 * Also provides per-tenant credential management via database.
 *
 * @module core/integrations/sunat/provider-config
 */

import prisma from '@/src/core/db/prisma';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { decryptCredential, isEncrypted } from './credential-encryption';

export type SunatProvider = 'mock' | 'nubefact' | 'sunat-direct';

export type SunatMode = 'PRODUCTION' | 'BETA' | 'DISABLED';

export interface ProviderConfig {
  provider: SunatProvider;
  nubefact?: {
    token: string;
    url: string;
  };
  sunat?: {
    ruc: string;
    username: string;
    password: string;
  };
}

/**
 * Per-tenant SUNAT credentials and configuration.
 * Credentials are stored encrypted in DB and decrypted at runtime.
 */
export interface TenantSunatCredentials {
  /** Provider type: SUNAT_DIRECT, NUBEFACT, or NONE */
  provider: 'SUNAT_DIRECT' | 'NUBEFACT' | 'NONE';
  /** Mode: PRODUCTION, BETA, or DISABLED */
  mode: SunatMode;
  /** SOL username (e.g., "MODDATOS") - only for SUNAT_DIRECT */
  solUser?: string;
  /** SOL password (decrypted) - only for SUNAT_DIRECT */
  solPassword?: string;
  /** X.509 certificate PEM (decrypted) - only for SUNAT_DIRECT */
  certificatePem?: string;
  /** RSA private key PEM (decrypted) - only for SUNAT_DIRECT */
  privateKeyPem?: string;
  /** Nubefact API token (decrypted) - only for NUBEFACT */
  nubefactToken?: string;
  /** Nubefact API URL - only for NUBEFACT */
  nubefactUrl?: string;
  /** Tenant's RUC number */
  ruc: string;
}

/**
 * Get environment-based provider config (legacy, for backward compat).
 */
export function getSunatProviderConfig(): ProviderConfig {
  const provider = (process.env.SUNAT_PROVIDER ?? 'mock') as SunatProvider;

  const config: ProviderConfig = { provider };

  if (provider === 'nubefact') {
    config.nubefact = {
      token: process.env.NUBEFACT_TOKEN ?? '',
      url: process.env.NUBEFACT_URL ?? 'https://api.nubefact.com/api/v1',
    };
  }

  if (provider === 'sunat-direct') {
    config.sunat = {
      ruc: process.env.SUNAT_RUC ?? '',
      username: process.env.SUNAT_USERNAME ?? '',
      password: process.env.SUNAT_PASSWORD ?? '',
    };
  }

  return config;
}

export function isMockProvider(): boolean {
  return (process.env.SUNAT_PROVIDER ?? 'mock') === 'mock';
}

/**
 * Safely decrypt a credential field.
 * Returns undefined if the field is null/undefined.
 * Returns the value as-is if not encrypted (backward compat).
 * NEVER logs the decrypted value.
 */
function safeDecrypt(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (isEncrypted(value)) {
    return decryptCredential(value);
  }
  // Not encrypted yet (pre-migration data) — return as-is
  return value;
}

/**
 * Get per-tenant SUNAT configuration from database.
 * Reads tenant_settings and decrypts encrypted credential fields
 * (SOL password, certificate PEM, private key PEM, Nubefact token).
 *
 * @param tenantId - Tenant UUID (from JWT, never from client)
 * @returns TenantSunatCredentials or null if tenant not found
 */
export async function getTenantSunatConfig(
  tenantId: string,
): Promise<TenantSunatCredentials | null> {
  try {
    const settings = await (prisma.tenant_settings as any).findFirst({
      where: { tenant_id: tenantId },
    });

    if (!settings) {
      pinoLogger.warn({ tenantId }, 'Tenant settings not found for SUNAT config');
      return null;
    }

    return {
      provider: (settings.sunat_provider ?? 'NONE') as TenantSunatCredentials['provider'],
      mode: (settings.sunat_mode ?? 'DISABLED') as SunatMode,
      solUser: settings.sunat_sol_user ?? undefined,
      solPassword: safeDecrypt(settings.sunat_sol_password),
      certificatePem: safeDecrypt(settings.sunat_certificate_pem),
      privateKeyPem: safeDecrypt(settings.sunat_private_key_pem),
      nubefactToken: safeDecrypt(settings.nubefact_token),
      nubefactUrl: settings.nubefact_url ?? undefined,
      ruc: settings.ruc ?? '',
    };
  } catch (error) {
    pinoLogger.error({ tenantId, error }, 'Failed to load tenant SUNAT config');
    return null;
  }
}
