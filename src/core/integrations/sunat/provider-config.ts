/**
 * SUNAT Provider Configuration
 *
 * Determines which SUNAT integration provider to use:
 * - 'mock': Local mock for development (default)
 * - 'nubefact': Nubefact REST API
 * - 'sunat-direct': Direct SUNAT SOAP (placeholder for future)
 *
 * @module core/integrations/sunat/provider-config
 */

export type SunatProvider = 'mock' | 'nubefact' | 'sunat-direct';

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
