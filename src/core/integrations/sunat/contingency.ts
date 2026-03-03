/**
 * SUNAT Contingency Mode — Persistent (Prisma-backed)
 *
 * Per SUNAT regulation, when electronic invoicing is unavailable (SUNAT down,
 * internet outage, certificate issues), the business can operate in
 * "contingency mode" using pre-authorized physical documents.
 *
 * Contingency rules:
 * - Issue invoices with contingency flag (for later reconciliation)
 * - All contingency invoices must be sent to SUNAT within 7 calendar days
 * - Uses "offline" series prefix (same series but tracked separately)
 * - Maintains DB-persisted queue for deferred SUNAT submission
 *
 * Refactored from in-memory singleton to Prisma-backed persistence (Phase 4).
 * Health checks are passive — the queue worker auto-deactivates contingency
 * on successful SUNAT response.
 *
 * @module core/integrations/sunat/contingency
 */

import type { PrismaClient } from '@prisma/client';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Types
// ============================================================================

export type ContingencyReason =
  | 'SUNAT_UNREACHABLE'   // SUNAT web service down
  | 'NETWORK_OUTAGE'      // No internet connectivity
  | 'CERTIFICATE_ERROR'   // Certificate expired or invalid
  | 'MANUAL_ACTIVATION';  // Operator-activated contingency

export interface ContingencyState {
  id: string;
  tenantId: string;
  active: boolean;
  reason: string;
  activatedAt: Date;
  activatedBy: string | null;
  deactivatedAt: Date | null;
  pendingCount: number;
  autoActivated: boolean;
  failureCount: number;
  createdAt: Date;
}

export interface ContingencyInvoice {
  id: string;
  contingencyId: string;
  invoiceId: string;
  tenantId: string;
  series: string;
  number: string;
  issuedAt: Date;
  /** Must be reconciled by this date (issued + 7 days) */
  reconcileBy: Date;
  reconciledAt: Date | null;
}

// ============================================================================
// Constants
// ============================================================================

const RECONCILIATION_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// Contingency Manager — Prisma Persistent
// ============================================================================

export class ContingencyManager {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get the active contingency state for a tenant.
   * Returns null if no active contingency exists.
   */
  async getState(tenantId: string): Promise<ContingencyState | null> {
    const record = await (this.prisma as any).sunat_contingency.findFirst({
      where: { tenant_id: tenantId, active: true },
    });

    if (!record) return null;

    return this.mapRecordToState(record);
  }

  /**
   * Check if contingency mode is active for a tenant
   */
  async isActive(tenantId: string): Promise<boolean> {
    const state = await this.getState(tenantId);
    return state !== null && state.active;
  }

  /**
   * Activate contingency mode for a tenant.
   * If already active, logs a warning and returns the existing state.
   */
  async activate(
    tenantId: string,
    reason: ContingencyReason,
    activatedBy?: string,
    autoActivated = false,
  ): Promise<ContingencyState> {
    // Check if already active
    const existing = await this.getState(tenantId);
    if (existing) {
      pinoLogger.warn(
        { tenantId, existingReason: existing.reason, newReason: reason },
        'Contingency already active',
      );
      return existing;
    }

    const now = new Date();

    const record = await (this.prisma as any).sunat_contingency.create({
      data: {
        tenant_id: tenantId,
        active: true,
        reason,
        activated_at: now,
        activated_by: activatedBy ?? null,
        pending_count: 0,
        auto_activated: autoActivated,
        failure_count: 0,
      },
    });

    pinoLogger.info(
      { tenantId, reason, activatedBy, autoActivated },
      'SUNAT contingency mode ACTIVATED',
    );

    return this.mapRecordToState(record);
  }

  /**
   * Deactivate contingency mode for a tenant.
   * Fails if there are overdue invoices that have not been reconciled.
   */
  async deactivate(
    tenantId: string,
    options?: { force?: boolean },
  ): Promise<boolean> {
    const state = await this.getState(tenantId);
    if (!state) return false;

    // Check for overdue invoices unless forced
    if (!options?.force) {
      const overdue = await this.getOverdueInvoices(tenantId);
      if (overdue.length > 0) {
        pinoLogger.warn(
          { tenantId, overdueCount: overdue.length },
          'Cannot deactivate contingency: overdue invoices exist',
        );
        return false;
      }
    }

    const now = new Date();

    await (this.prisma as any).sunat_contingency.update({
      where: { id: state.id },
      data: {
        active: false,
        deactivated_at: now,
      },
    });

    pinoLogger.info(
      {
        tenantId,
        reason: state.reason,
        duration: now.getTime() - state.activatedAt.getTime(),
        pendingCount: state.pendingCount,
      },
      'SUNAT contingency mode DEACTIVATED',
    );

    return true;
  }

  /**
   * Register an invoice issued during contingency.
   * Creates a record in sunat_contingency_invoices and increments pending_count.
   * Returns the reconciliation deadline.
   */
  async registerContingencyInvoice(params: {
    tenantId: string;
    invoiceId: string;
    series: string;
    number: string;
    issuedAt?: Date;
  }): Promise<ContingencyInvoice> {
    const state = await this.getState(params.tenantId);
    if (!state) {
      throw new Error(
        `No active contingency for tenant ${params.tenantId}`,
      );
    }

    const issuedAt = params.issuedAt ?? new Date();
    const reconcileBy = new Date(
      issuedAt.getTime() + RECONCILIATION_WINDOW_DAYS * MS_PER_DAY,
    );

    // Create invoice record + increment pending_count in a transaction
    const [invoiceRecord] = await this.prisma.$transaction([
      (this.prisma as any).sunat_contingency_invoices.create({
        data: {
          contingency_id: state.id,
          invoice_id: params.invoiceId,
          tenant_id: params.tenantId,
          series: params.series,
          number: params.number,
          issued_at: issuedAt,
          reconcile_by: reconcileBy,
        },
      }),
      (this.prisma as any).sunat_contingency.update({
        where: { id: state.id },
        data: { pending_count: { increment: 1 } },
      }),
    ]);

    pinoLogger.info(
      {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        reconcileBy: reconcileBy.toISOString(),
        pendingCount: state.pendingCount + 1,
      },
      'Contingency invoice registered',
    );

    return this.mapInvoiceRecord(invoiceRecord);
  }

  /**
   * Mark a contingency invoice as reconciled (sent to SUNAT successfully).
   * Updates reconciled_at and decrements pending_count.
   */
  async markReconciled(tenantId: string, invoiceId: string): Promise<boolean> {
    const invoice = await (
      this.prisma as any
    ).sunat_contingency_invoices.findFirst({
      where: {
        tenant_id: tenantId,
        invoice_id: invoiceId,
        reconciled_at: null,
      },
    });

    if (!invoice) return false;

    const now = new Date();

    await this.prisma.$transaction([
      (this.prisma as any).sunat_contingency_invoices.update({
        where: { id: invoice.id },
        data: { reconciled_at: now },
      }),
      (this.prisma as any).sunat_contingency.update({
        where: { id: invoice.contingency_id },
        data: { pending_count: { decrement: 1 } },
      }),
    ]);

    pinoLogger.info(
      { tenantId, invoiceId, contingencyId: invoice.contingency_id },
      'Contingency invoice reconciled',
    );

    return true;
  }

  /**
   * Get all pending (non-reconciled) contingency invoices for a tenant
   */
  async getPendingInvoices(tenantId: string): Promise<ContingencyInvoice[]> {
    const records = await (
      this.prisma as any
    ).sunat_contingency_invoices.findMany({
      where: {
        tenant_id: tenantId,
        reconciled_at: null,
      },
      orderBy: { issued_at: 'asc' },
    });

    return records.map((r: any) => this.mapInvoiceRecord(r));
  }

  /**
   * Get invoices approaching their reconciliation deadline.
   * Returns invoices that must be sent within the next N hours.
   */
  async getUrgentReconciliations(
    tenantId: string,
    hoursThreshold = 24,
  ): Promise<ContingencyInvoice[]> {
    const cutoff = new Date(
      Date.now() + hoursThreshold * 60 * 60 * 1000,
    );

    const records = await (
      this.prisma as any
    ).sunat_contingency_invoices.findMany({
      where: {
        tenant_id: tenantId,
        reconciled_at: null,
        reconcile_by: { lte: cutoff },
      },
      orderBy: { reconcile_by: 'asc' },
    });

    return records.map((r: any) => this.mapInvoiceRecord(r));
  }

  /**
   * Get overdue invoices (past reconciliation deadline and not reconciled)
   */
  async getOverdueInvoices(tenantId: string): Promise<ContingencyInvoice[]> {
    const now = new Date();

    const records = await (
      this.prisma as any
    ).sunat_contingency_invoices.findMany({
      where: {
        tenant_id: tenantId,
        reconciled_at: null,
        reconcile_by: { lt: now },
      },
      orderBy: { reconcile_by: 'asc' },
    });

    return records.map((r: any) => this.mapInvoiceRecord(r));
  }

  /**
   * Increment failure count on the active contingency (used by queue worker)
   */
  async incrementFailureCount(tenantId: string): Promise<void> {
    const state = await this.getState(tenantId);
    if (!state) return;

    await (this.prisma as any).sunat_contingency.update({
      where: { id: state.id },
      data: { failure_count: { increment: 1 } },
    });
  }

  // ========================================================================
  // Private Mappers
  // ========================================================================

  private mapRecordToState(record: any): ContingencyState {
    return {
      id: record.id,
      tenantId: record.tenant_id,
      active: record.active,
      reason: record.reason,
      activatedAt: new Date(record.activated_at),
      activatedBy: record.activated_by,
      deactivatedAt: record.deactivated_at
        ? new Date(record.deactivated_at)
        : null,
      pendingCount: record.pending_count,
      autoActivated: record.auto_activated,
      failureCount: record.failure_count,
      createdAt: new Date(record.created_at),
    };
  }

  private mapInvoiceRecord(record: any): ContingencyInvoice {
    return {
      id: record.id,
      contingencyId: record.contingency_id,
      invoiceId: record.invoice_id,
      tenantId: record.tenant_id,
      series: record.series,
      number: record.number,
      issuedAt: new Date(record.issued_at),
      reconcileBy: new Date(record.reconcile_by),
      reconciledAt: record.reconciled_at
        ? new Date(record.reconciled_at)
        : null,
    };
  }
}
