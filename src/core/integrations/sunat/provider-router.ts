/**
 * Invoice Provider Router
 *
 * Routes SUNAT electronic invoicing requests to the correct adapter
 * based on per-tenant configuration. Supports:
 * - SUNAT_DIRECT: Direct SUNAT SOAP via nodefact (zero cost)
 * - NUBEFACT: Nubefact REST API (paid)
 *
 * Caches adapter instances per-tenant to avoid repeated credential loading.
 *
 * @module core/integrations/sunat/provider-router
 */

import { Result, ok, err, DomainError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { getTenantSunatConfig, DEFAULT_EMISOR_GEO } from './provider-config';
import type { TenantSunatCredentials, SunatMode } from './provider-config';
import { SunatDirectAdapterImpl } from './sunat-direct-adapter';
import type { SunatDocumentResult, CreditNoteData, VoidData, DailySummaryData, TicketStatusResult } from './sunat-direct-adapter';
import type { InvoiceData } from './client';
import { NubefactAdapterWrapper } from './nubefact-adapter-wrapper';

// ============================================================================
// InvoiceProvider Interface
// ============================================================================

/**
 * Unified interface for all SUNAT invoice providers.
 * Both SunatDirectAdapter and NubefactAdapterWrapper implement this.
 */
export interface InvoiceProvider {
  sendInvoice(data: InvoiceData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendCreditNote(data: CreditNoteData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendVoidCommunication(data: VoidData): Promise<Result<SunatDocumentResult, DomainError>>;
  sendDailySummary(data: DailySummaryData): Promise<Result<SunatDocumentResult, DomainError>>;
  queryTicketStatus(ticketNumber: string): Promise<Result<TicketStatusResult, DomainError>>;
  testConnection(): Promise<Result<{ message: string }, DomainError>>;
}

// ============================================================================
// InvoiceProviderRouter
// ============================================================================

export class InvoiceProviderRouter {
  private adapterCache: Map<string, InvoiceProvider> = new Map();
  private logger;

  constructor() {
    this.logger = pinoLogger.child
      ? pinoLogger.child({ module: 'invoice-provider-router' })
      : pinoLogger;
  }

  /**
   * Get the invoice provider for a tenant.
   * Resolves adapter based on tenant's sunat_provider setting.
   * Caches adapter per-tenant to avoid repeated credential loading.
   */
  async getProvider(tenantId: string): Promise<Result<InvoiceProvider, DomainError>> {
    // Check cache first
    const cached = this.adapterCache.get(tenantId);
    if (cached) {
      return ok(cached);
    }

    // Load tenant config from DB
    const config = await getTenantSunatConfig(tenantId);

    if (!config) {
      return err(new DomainError(
        'Configuracion SUNAT no encontrada para el tenant',
        'SUNAT_CONFIG_NOT_FOUND',
        { tenantId },
      ));
    }

    // Check mode
    if (config.mode === 'DISABLED') {
      return err(new DomainError(
        'Facturacion electronica deshabilitada para este tenant',
        'SUNAT_DISABLED',
        { tenantId },
      ));
    }

    // Resolve provider
    switch (config.provider) {
      case 'SUNAT_DIRECT':
        return this.resolveSunatDirect(tenantId, config);

      case 'NUBEFACT':
        return this.resolveNubefact(tenantId, config);

      case 'NONE':
        return err(new DomainError(
          'Proveedor SUNAT no configurado para este tenant',
          'SUNAT_PROVIDER_NOT_CONFIGURED',
          { tenantId },
        ));

      default:
        return err(new DomainError(
          `Proveedor SUNAT desconocido: ${config.provider}`,
          'SUNAT_UNKNOWN_PROVIDER',
          { tenantId, provider: config.provider },
        ));
    }
  }

  /**
   * Check if SUNAT electronic invoicing is enabled for a tenant.
   */
  async isEnabled(tenantId: string): Promise<boolean> {
    const config = await getTenantSunatConfig(tenantId);
    if (!config) return false;
    return config.mode !== 'DISABLED' && config.provider !== 'NONE';
  }

  /**
   * Clear the adapter cache for a specific tenant (e.g., when config changes).
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.adapterCache.delete(tenantId);
    } else {
      this.adapterCache.clear();
    }
  }

  // ============================================================================
  // Private: Provider Resolution
  // ============================================================================

  private resolveSunatDirect(
    tenantId: string,
    config: TenantSunatCredentials,
  ): Result<InvoiceProvider, DomainError> {
    // Validate required credentials
    if (!config.solUser || !config.solPassword) {
      return err(new DomainError(
        'Credenciales SOL no configuradas (usuario y contraseña requeridos)',
        'SUNAT_MISSING_SOL_CREDENTIALS',
        { tenantId },
      ));
    }

    if (!config.certificatePem || !config.privateKeyPem) {
      return err(new DomainError(
        'Certificado digital y clave privada no configurados',
        'SUNAT_MISSING_CERTIFICATE',
        { tenantId },
      ));
    }

    if (!config.ruc) {
      return err(new DomainError(
        'RUC del tenant no configurado',
        'SUNAT_MISSING_RUC',
        { tenantId },
      ));
    }

    const adapter = new SunatDirectAdapterImpl({
      ruc: config.ruc,
      solUser: config.solUser,
      solPassword: config.solPassword,
      certificatePem: config.certificatePem,
      privateKeyPem: config.privateKeyPem,
      mode: config.mode as 'PRODUCTION' | 'BETA',
      emisor: config.emisor ?? {
        ruc: config.ruc,
        razonSocial: '',
        direccion: '',
        ...DEFAULT_EMISOR_GEO,
      },
    });

    this.adapterCache.set(tenantId, adapter);

    this.logger.info(
      { tenantId, provider: 'SUNAT_DIRECT', mode: config.mode },
      'SUNAT Direct adapter resolved',
    );

    return ok(adapter);
  }

  private resolveNubefact(
    tenantId: string,
    config: TenantSunatCredentials,
  ): Result<InvoiceProvider, DomainError> {
    // Validate required credentials
    if (!config.nubefactToken) {
      return err(new DomainError(
        'Token de Nubefact no configurado',
        'SUNAT_MISSING_NUBEFACT_TOKEN',
        { tenantId },
      ));
    }

    if (!config.nubefactUrl) {
      return err(new DomainError(
        'URL de API Nubefact no configurada',
        'SUNAT_MISSING_NUBEFACT_URL',
        { tenantId },
      ));
    }

    const adapter = new NubefactAdapterWrapper(
      config.nubefactToken,
      config.nubefactUrl,
    );

    this.adapterCache.set(tenantId, adapter);

    this.logger.info(
      { tenantId, provider: 'NUBEFACT' },
      'Nubefact adapter resolved',
    );

    return ok(adapter);
  }
}
