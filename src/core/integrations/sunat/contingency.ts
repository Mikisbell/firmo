/**
 * SUNAT Contingency Mode
 *
 * Per SUNAT regulation, when electronic invoicing is unavailable (SUNAT down,
 * internet outage, certificate issues), the business can operate in
 * "contingency mode" using pre-authorized physical documents.
 *
 * Contingency rules:
 * - Issue invoices with contingency flag (for later reconciliation)
 * - All contingency invoices must be sent to SUNAT within 7 calendar days
 * - Uses "offline" series prefix (same series but tracked separately)
 * - Maintains local queue for deferred SUNAT submission
 *
 * @module core/integrations/sunat/contingency
 */

import { pinoLogger } from '@/src/core/observability/logger-pino';
import { sunatClient } from './client';

// ============================================================================
// Types
// ============================================================================

export type ContingencyReason =
  | 'SUNAT_UNREACHABLE'   // SUNAT web service down
  | 'NETWORK_OUTAGE'      // No internet connectivity
  | 'CERTIFICATE_ERROR'   // Certificate expired or invalid
  | 'MANUAL_ACTIVATION';  // Operator-activated contingency

export interface ContingencyState {
  active: boolean;
  reason: ContingencyReason | null;
  activatedAt: Date | null;
  activatedBy: string | null;
  /** Count of invoices issued during this contingency period */
  pendingCount: number;
  /** Auto-deactivation after SUNAT is reachable again */
  lastHealthCheck: Date | null;
  lastHealthResult: boolean;
}

export interface ContingencyInvoice {
  invoiceId: string;
  tenantId: string;
  series: string;
  number: string;
  issuedAt: Date;
  /** Must be reconciled by this date (issued + 7 days) */
  reconcileBy: Date;
  reconciled: boolean;
}

// ============================================================================
// Contingency Manager
// ============================================================================

const RECONCILIATION_WINDOW_DAYS = 7;
const HEALTH_CHECK_INTERVAL_MS = 60_000; // 1 minute

export class ContingencyManager {
  private state: ContingencyState = {
    active: false,
    reason: null,
    activatedAt: null,
    activatedBy: null,
    pendingCount: 0,
    lastHealthCheck: null,
    lastHealthResult: true,
  };

  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pendingInvoices: ContingencyInvoice[] = [];

  /** Get current contingency state */
  getState(): Readonly<ContingencyState> {
    return { ...this.state };
  }

  /** Check if we're in contingency mode */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Activate contingency mode
   */
  activate(reason: ContingencyReason, activatedBy: string): void {
    if (this.state.active) {
      pinoLogger.warn({ existingReason: this.state.reason, newReason: reason }, 'Contingency already active');
      return;
    }

    this.state = {
      active: true,
      reason,
      activatedAt: new Date(),
      activatedBy,
      pendingCount: 0,
      lastHealthCheck: null,
      lastHealthResult: false,
    };

    pinoLogger.info({ reason, activatedBy }, 'SUNAT contingency mode ACTIVATED');

    // Start health check polling to auto-deactivate when SUNAT is back
    this.startHealthChecks();
  }

  /**
   * Deactivate contingency mode (manual or auto when SUNAT is reachable)
   */
  deactivate(): void {
    if (!this.state.active) return;

    pinoLogger.info({
      reason: this.state.reason,
      duration: Date.now() - (this.state.activatedAt?.getTime() || 0),
      pendingCount: this.state.pendingCount,
    }, 'SUNAT contingency mode DEACTIVATED');

    this.state.active = false;
    this.stopHealthChecks();
  }

  /**
   * Register an invoice issued during contingency
   * Returns the reconciliation deadline
   */
  registerContingencyInvoice(invoice: {
    invoiceId: string;
    tenantId: string;
    series: string;
    number: string;
  }): Date {
    const issuedAt = new Date();
    const reconcileBy = new Date(issuedAt.getTime() + RECONCILIATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    this.pendingInvoices.push({
      ...invoice,
      issuedAt,
      reconcileBy,
      reconciled: false,
    });

    this.state.pendingCount++;

    pinoLogger.info({
      invoiceId: invoice.invoiceId,
      reconcileBy: reconcileBy.toISOString(),
      pendingCount: this.state.pendingCount,
    }, 'Contingency invoice registered');

    return reconcileBy;
  }

  /**
   * Mark a contingency invoice as reconciled (sent to SUNAT successfully)
   */
  markReconciled(invoiceId: string): void {
    const invoice = this.pendingInvoices.find(i => i.invoiceId === invoiceId);
    if (invoice && !invoice.reconciled) {
      invoice.reconciled = true;
      this.state.pendingCount = Math.max(0, this.state.pendingCount - 1);
    }
  }

  /**
   * Get invoices that are approaching their reconciliation deadline
   * Returns invoices that must be sent within the next N hours
   */
  getUrgentReconciliations(hoursThreshold: number = 24): ContingencyInvoice[] {
    const cutoff = new Date(Date.now() + hoursThreshold * 60 * 60 * 1000);
    return this.pendingInvoices.filter(
      i => !i.reconciled && i.reconcileBy <= cutoff
    );
  }

  /**
   * Get overdue invoices (past reconciliation deadline)
   */
  getOverdueInvoices(): ContingencyInvoice[] {
    const now = new Date();
    return this.pendingInvoices.filter(
      i => !i.reconciled && i.reconcileBy < now
    );
  }

  /**
   * Get all pending (non-reconciled) invoices
   */
  getPendingInvoices(): ContingencyInvoice[] {
    return this.pendingInvoices.filter(i => !i.reconciled);
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  private startHealthChecks(): void {
    if (this.healthCheckTimer) return;

    this.healthCheckTimer = setInterval(async () => {
      try {
        const isReachable = await this.checkSunatHealth();
        this.state.lastHealthCheck = new Date();
        this.state.lastHealthResult = isReachable;

        if (isReachable && this.state.active) {
          pinoLogger.info('SUNAT is reachable again, auto-deactivating contingency mode');
          this.deactivate();
        }
      } catch (err) {
        pinoLogger.error({ error: err }, 'Health check failed');
      }
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private async checkSunatHealth(): Promise<boolean> {
    try {
      // Try a lightweight SUNAT query
      const result = await sunatClient.queryInvoiceStatus('03', 'B001', '00000001');
      return result.success;
    } catch {
      return false;
    }
  }

  /** Clean up resources */
  destroy(): void {
    this.stopHealthChecks();
  }
}

/** Singleton contingency manager */
export const contingencyManager = new ContingencyManager();
