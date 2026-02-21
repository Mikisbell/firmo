/**
 * Reconciliation Service
 *
 * Generates payment settlement periods, records actual received amounts,
 * and detects discrepancies between expected and actual payments.
 * All amounts in centavos (integer).
 *
 * @module core/services/reconciliation.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, ValidationError, NotFoundError } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface Settlement {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  paymentMethod: string;
  expectedCents: number;
  receivedCents: number | null;
  differenceCents: number | null;
  status: SettlementStatus;
  notes: string | null;
  reconciledBy: string | null;
  reconciledAt: string | null;
  createdAt: string;
}

export type SettlementStatus = 'PENDING' | 'MATCHED' | 'DISCREPANCY';

export interface SettlementFilters {
  status?: SettlementStatus;
  paymentMethod?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DiscrepancyReport {
  period: { start: string; end: string };
  totalExpectedCents: number;
  totalReceivedCents: number;
  totalDifferenceCents: number;
  byMethod: {
    method: string;
    expectedCents: number;
    receivedCents: number;
    differenceCents: number;
    status: SettlementStatus;
  }[];
  pendingCount: number;
  matchedCount: number;
  discrepancyCount: number;
}

// ============================================================================
// Service
// ============================================================================

export class ReconciliationService {
  constructor(private prisma: PrismaClient) {}

  async generateSettlementPeriod(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<Result<Settlement[], DomainError>> {
    if (start > end) {
      return err(new ValidationError('La fecha de inicio debe ser anterior a la fecha de fin'));
    }

    // Aggregate payments by method for the period
    const payments = await (this.prisma as any).payments.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      select: { payment_method: true, amount_cents: true },
    });

    const byMethod = new Map<string, number>();
    for (const p of payments) {
      byMethod.set(
        p.payment_method,
        (byMethod.get(p.payment_method) ?? 0) + p.amount_cents,
      );
    }

    if (byMethod.size === 0) {
      return ok([]);
    }

    const settlements: Settlement[] = [];
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    for (const [method, expectedCents] of byMethod) {
      // Check if settlement already exists for this period+method
      const existing = await (this.prisma as any).payment_settlements.findUnique({
        where: {
          tenant_id_period_start_period_end_payment_method: {
            tenant_id: tenantId,
            period_start: start,
            period_end: end,
            payment_method: method,
          },
        },
      });

      if (existing) {
        settlements.push(this.mapSettlement(existing));
        continue;
      }

      const id = crypto.randomUUID();
      const created = await (this.prisma as any).payment_settlements.create({
        data: {
          id,
          tenant_id: tenantId,
          period_start: start,
          period_end: end,
          payment_method: method,
          expected_cents: expectedCents,
          status: 'PENDING',
        },
      });

      settlements.push(this.mapSettlement(created));
    }

    return ok(settlements);
  }

  async recordActualReceived(
    tenantId: string,
    settlementId: string,
    receivedCents: number,
    reconciledBy: string,
    notes?: string,
  ): Promise<Result<Settlement, DomainError>> {
    if (receivedCents < 0) {
      return err(new ValidationError('El monto recibido no puede ser negativo', 'receivedCents'));
    }

    const settlement = await (this.prisma as any).payment_settlements.findFirst({
      where: { id: settlementId, tenant_id: tenantId },
    });

    if (!settlement) {
      return err(new NotFoundError('payment_settlement', settlementId));
    }

    const differenceCents = settlement.expected_cents - receivedCents;
    const status: SettlementStatus = differenceCents === 0 ? 'MATCHED' : 'DISCREPANCY';

    const updated = await (this.prisma as any).payment_settlements.update({
      where: { id: settlementId },
      data: {
        received_cents: receivedCents,
        difference_cents: differenceCents,
        status,
        notes: notes ?? null,
        reconciled_by: reconciledBy,
        reconciled_at: new Date(),
      },
    });

    return ok(this.mapSettlement(updated));
  }

  async getSettlements(
    tenantId: string,
    filters?: SettlementFilters,
  ): Promise<Result<Settlement[], DomainError>> {
    const where: any = { tenant_id: tenantId };

    if (filters?.status) where.status = filters.status;
    if (filters?.paymentMethod) where.payment_method = filters.paymentMethod;
    if (filters?.startDate || filters?.endDate) {
      where.period_start = {};
      if (filters.startDate) where.period_start.gte = filters.startDate;
      if (filters.endDate) where.period_start.lte = filters.endDate;
    }

    const settlements = await (this.prisma as any).payment_settlements.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return ok(settlements.map((s: any) => this.mapSettlement(s)));
  }

  async getDiscrepancyReport(
    tenantId: string,
    period: { start: Date; end: Date },
  ): Promise<Result<DiscrepancyReport, DomainError>> {
    const result = await this.getSettlements(tenantId, {
      startDate: period.start,
      endDate: period.end,
    });

    if (!result.success) return result as any;

    const settlements = result.data;
    let totalExpectedCents = 0;
    let totalReceivedCents = 0;
    let pendingCount = 0;
    let matchedCount = 0;
    let discrepancyCount = 0;

    const byMethod = settlements.map((s) => {
      totalExpectedCents += s.expectedCents;
      totalReceivedCents += s.receivedCents ?? 0;

      if (s.status === 'PENDING') pendingCount++;
      else if (s.status === 'MATCHED') matchedCount++;
      else discrepancyCount++;

      return {
        method: s.paymentMethod,
        expectedCents: s.expectedCents,
        receivedCents: s.receivedCents ?? 0,
        differenceCents: s.differenceCents ?? s.expectedCents,
        status: s.status,
      };
    });

    return ok({
      period: {
        start: period.start.toISOString().split('T')[0],
        end: period.end.toISOString().split('T')[0],
      },
      totalExpectedCents,
      totalReceivedCents,
      totalDifferenceCents: totalExpectedCents - totalReceivedCents,
      byMethod,
      pendingCount,
      matchedCount,
      discrepancyCount,
    });
  }

  private mapSettlement(s: any): Settlement {
    return {
      id: s.id,
      tenantId: s.tenant_id,
      periodStart: s.period_start instanceof Date
        ? s.period_start.toISOString().split('T')[0]
        : String(s.period_start),
      periodEnd: s.period_end instanceof Date
        ? s.period_end.toISOString().split('T')[0]
        : String(s.period_end),
      paymentMethod: s.payment_method,
      expectedCents: s.expected_cents,
      receivedCents: s.received_cents,
      differenceCents: s.difference_cents,
      status: s.status,
      notes: s.notes,
      reconciledBy: s.reconciled_by,
      reconciledAt: s.reconciled_at?.toISOString() ?? null,
      createdAt: s.created_at.toISOString(),
    };
  }
}
