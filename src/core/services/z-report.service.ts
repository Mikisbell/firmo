/**
 * Z-Report Service - Fiscal shift close reports (SUNAT Peru)
 *
 * Generates Z (final) and X (partial) reports with:
 * - IGV 18% breakdown (gravado/exonerado/inafecto)
 * - Comprobantes count (boletas/facturas)
 * - Payment method breakdown
 * - Cash drawer reconciliation
 *
 * All amounts in centavos (integer).
 *
 * @module core/services/z-report.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, NotFoundError, ValidationError } from '@/src/core/result';
import { LIMITS } from '@/src/core/constants/limits';

// ============================================================================
// Types
// ============================================================================

export type ReportType = 'Z' | 'X';

export interface ZReport {
  id: string;
  tenantId: string;
  shiftId: string;
  terminalId: string;
  reportType: ReportType;
  reportNumber: number;
  // Sales
  grossSalesCents: number;
  netSalesCents: number;
  discountCents: number;
  voidsCents: number;
  refundsCents: number;
  tipsCents: number;
  // IGV SUNAT
  gravadoBaseCents: number;
  gravadoIgvCents: number;
  exoneradoCents: number;
  inafectoCents: number;
  // Comprobantes
  boletasCount: number;
  boletasTotalCents: number;
  facturasCount: number;
  facturasTotalCents: number;
  voidedInvoicesCount: number;
  creditNotesCount: number;
  // Payments
  paymentsBreakdown: Record<string, { count: number; totalCents: number }>;
  // Cash
  cashOpeningCents: number;
  cashExpectedCents: number;
  cashCountedCents: number | null;
  cashDiffCents: number | null;
  // Meta
  ordersCount: number;
  generatedBy: string;
  generatedAt: string;
}

// ============================================================================
// Service
// ============================================================================

export class ZReportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a Z (final) or X (partial) report for a shift.
   * Z reports are generated once at shift close.
   * X reports can be generated anytime during a shift.
   */
  async generateReport(
    tenantId: string,
    shiftId: string,
    reportType: ReportType,
    generatedBy: string,
  ): Promise<Result<ZReport, DomainError>> {
    // 1. Validate shift
    const shift = await (this.prisma as any).shifts.findFirst({
      where: { id: shiftId, tenant_id: tenantId },
    });

    if (!shift) {
      return err(new NotFoundError('Turno', shiftId));
    }

    // Z reports only for closed shifts
    if (reportType === 'Z' && shift.status !== 'CLOSED') {
      return err(new ValidationError(
        'Reporte Z solo puede generarse para turnos cerrados',
        'reportType',
      ));
    }

    // Check if Z report already exists for this shift
    if (reportType === 'Z') {
      const existing = await (this.prisma as any).z_reports.findFirst({
        where: { shift_id: shiftId, tenant_id: tenantId, report_type: 'Z' },
      });
      if (existing) {
        return ok(this.mapReport(existing));
      }
    }

    // 2. Aggregate payments
    const payments = await (this.prisma as any).payments.findMany({
      where: {
        tenant_id: tenantId,
        shift_id: shiftId,
        status: 'COMPLETED',
      },
      select: {
        payment_method: true,
        amount_cents: true,
        tip_cents: true,
      },
    });

    const paymentsBreakdown: Record<string, { count: number; totalCents: number }> = {};
    let grossSalesCents = 0;
    let tipsCents = 0;

    for (const p of payments) {
      const method = p.payment_method;
      if (!paymentsBreakdown[method]) {
        paymentsBreakdown[method] = { count: 0, totalCents: 0 };
      }
      paymentsBreakdown[method].count++;
      paymentsBreakdown[method].totalCents += p.amount_cents;
      grossSalesCents += p.amount_cents;
      tipsCents += p.tip_cents ?? 0;
    }

    // 3. Aggregate invoices for IGV breakdown
    const invoices = await (this.prisma as any).invoices.findMany({
      where: {
        tenant_id: tenantId,
        shift_id: shiftId,
        status: { in: ['ACCEPTED', 'PENDING'] },
      },
      select: {
        invoice_type: true,
        subtotal_cents: true,
        igv_cents: true,
        total_cents: true,
        tax_category: true,
      },
    });

    let boletasCount = 0;
    let boletasTotalCents = 0;
    let facturasCount = 0;
    let facturasTotalCents = 0;
    let gravadoBaseCents = 0;
    let gravadoIgvCents = 0;
    let exoneradoCents = 0;
    let inafectoCents = 0;

    for (const inv of invoices) {
      if (inv.invoice_type === 'BOLETA') {
        boletasCount++;
        boletasTotalCents += inv.total_cents;
      } else if (inv.invoice_type === 'FACTURA') {
        facturasCount++;
        facturasTotalCents += inv.total_cents;
      }

      const category = inv.tax_category ?? 'GRAVADO';
      if (category === 'GRAVADO') {
        gravadoBaseCents += inv.subtotal_cents;
        gravadoIgvCents += inv.igv_cents ?? 0;
      } else if (category === 'EXONERADO') {
        exoneradoCents += inv.total_cents;
      } else if (category === 'INAFECTO') {
        inafectoCents += inv.total_cents;
      }
    }

    // If no invoices but we have sales, estimate IGV from gross sales
    if (invoices.length === 0 && grossSalesCents > 0) {
      gravadoBaseCents = Math.round(grossSalesCents / (1 + LIMITS.IGV_RATE));
      gravadoIgvCents = grossSalesCents - gravadoBaseCents;
    }

    // 4. Count voided invoices and credit notes
    const voidedInvoicesCount = await (this.prisma as any).invoices.count({
      where: {
        tenant_id: tenantId,
        shift_id: shiftId,
        status: 'VOIDED',
      },
    });

    const creditNotesCount = await (this.prisma as any).invoices.count({
      where: {
        tenant_id: tenantId,
        shift_id: shiftId,
        invoice_type: 'CREDIT_NOTE',
      },
    });

    // 5. Count orders
    const ordersCount = await (this.prisma as any).orders.count({
      where: {
        tenant_id: tenantId,
        terminal_id: shift.terminal_id,
        created_at: {
          gte: shift.opened_at,
          ...(shift.closed_at ? { lte: shift.closed_at } : {}),
        },
        order_status: { in: ['CONFIRMED', 'OPEN', 'IN_PROGRESS'] },
      },
    });

    // 6. Aggregate discounts and voids
    const orderAggregates = await (this.prisma as any).orders.aggregate({
      where: {
        tenant_id: tenantId,
        terminal_id: shift.terminal_id,
        created_at: {
          gte: shift.opened_at,
          ...(shift.closed_at ? { lte: shift.closed_at } : {}),
        },
      },
      _sum: {
        discount_cents: true,
      },
    });

    const discountCents = orderAggregates._sum?.discount_cents ?? 0;

    // Voids: count refunded payments
    const refundedPayments = await (this.prisma as any).payments.aggregate({
      where: {
        tenant_id: tenantId,
        shift_id: shiftId,
        status: 'REFUNDED',
      },
      _sum: { amount_cents: true },
      _count: true,
    });

    const refundsCents = refundedPayments._sum?.amount_cents ?? 0;

    // Voided orders amount
    const voidedOrders = await (this.prisma as any).orders.aggregate({
      where: {
        tenant_id: tenantId,
        terminal_id: shift.terminal_id,
        created_at: {
          gte: shift.opened_at,
          ...(shift.closed_at ? { lte: shift.closed_at } : {}),
        },
        order_status: 'VOIDED',
      },
      _sum: { total_cents: true },
    });

    const voidsCents = voidedOrders._sum?.total_cents ?? 0;

    const netSalesCents = grossSalesCents - discountCents - voidsCents - refundsCents;

    // 7. Get next report number
    const lastReport = await (this.prisma as any).z_reports.findFirst({
      where: {
        tenant_id: tenantId,
        terminal_id: shift.terminal_id,
      },
      orderBy: { report_number: 'desc' },
      select: { report_number: true },
    });

    const reportNumber = (lastReport?.report_number ?? 0) + 1;

    // 8. Create report
    const reportId = crypto.randomUUID();
    const now = new Date();

    const created = await (this.prisma as any).z_reports.create({
      data: {
        id: reportId,
        tenant_id: tenantId,
        shift_id: shiftId,
        terminal_id: shift.terminal_id,
        report_type: reportType,
        report_number: reportNumber,
        gross_sales_cents: grossSalesCents,
        net_sales_cents: netSalesCents,
        discount_cents: discountCents,
        voids_cents: voidsCents,
        refunds_cents: refundsCents,
        tips_cents: tipsCents,
        gravado_base_cents: gravadoBaseCents,
        gravado_igv_cents: gravadoIgvCents,
        exonerado_cents: exoneradoCents,
        inafecto_cents: inafectoCents,
        boletas_count: boletasCount,
        boletas_total_cents: boletasTotalCents,
        facturas_count: facturasCount,
        facturas_total_cents: facturasTotalCents,
        voided_invoices_count: voidedInvoicesCount,
        credit_notes_count: creditNotesCount,
        payments_breakdown: paymentsBreakdown,
        cash_opening_cents: shift.cash_opening_cents,
        cash_expected_cents: shift.cash_expected_cents ?? 0,
        cash_counted_cents: shift.cash_counted_cents,
        cash_diff_cents: shift.diff_cents,
        orders_count: ordersCount,
        generated_by: generatedBy,
        generated_at: now,
      },
    });

    return ok(this.mapReport(created));
  }

  /**
   * Get a report by ID
   */
  async getReport(
    tenantId: string,
    reportId: string,
  ): Promise<Result<ZReport, DomainError>> {
    const report = await (this.prisma as any).z_reports.findFirst({
      where: { id: reportId, tenant_id: tenantId },
    });

    if (!report) {
      return err(new NotFoundError('Reporte Z', reportId));
    }

    return ok(this.mapReport(report));
  }

  /**
   * Get reports for a terminal, ordered by report number desc
   */
  async getReportsByTerminal(
    tenantId: string,
    terminalId: string,
    limit: number = 20,
  ): Promise<Result<ZReport[], DomainError>> {
    const reports = await (this.prisma as any).z_reports.findMany({
      where: { tenant_id: tenantId, terminal_id: terminalId },
      orderBy: { report_number: 'desc' },
      take: limit,
    });

    return ok(reports.map((r: any) => this.mapReport(r)));
  }

  /**
   * Get report for a specific shift
   */
  async getReportByShift(
    tenantId: string,
    shiftId: string,
    reportType?: ReportType,
  ): Promise<Result<ZReport | null, DomainError>> {
    const where: any = { shift_id: shiftId, tenant_id: tenantId };
    if (reportType) where.report_type = reportType;

    const report = await (this.prisma as any).z_reports.findFirst({
      where,
      orderBy: { generated_at: 'desc' },
    });

    return ok(report ? this.mapReport(report) : null);
  }

  private mapReport(r: any): ZReport {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      shiftId: r.shift_id,
      terminalId: r.terminal_id,
      reportType: r.report_type,
      reportNumber: r.report_number,
      grossSalesCents: r.gross_sales_cents,
      netSalesCents: r.net_sales_cents,
      discountCents: r.discount_cents,
      voidsCents: r.voids_cents,
      refundsCents: r.refunds_cents,
      tipsCents: r.tips_cents,
      gravadoBaseCents: r.gravado_base_cents,
      gravadoIgvCents: r.gravado_igv_cents,
      exoneradoCents: r.exonerado_cents,
      inafectoCents: r.inafecto_cents,
      boletasCount: r.boletas_count,
      boletasTotalCents: r.boletas_total_cents,
      facturasCount: r.facturas_count,
      facturasTotalCents: r.facturas_total_cents,
      voidedInvoicesCount: r.voided_invoices_count,
      creditNotesCount: r.credit_notes_count,
      paymentsBreakdown: r.payments_breakdown ?? {},
      cashOpeningCents: r.cash_opening_cents,
      cashExpectedCents: r.cash_expected_cents,
      cashCountedCents: r.cash_counted_cents,
      cashDiffCents: r.cash_diff_cents,
      ordersCount: r.orders_count,
      generatedBy: r.generated_by,
      generatedAt: r.generated_at instanceof Date
        ? r.generated_at.toISOString()
        : String(r.generated_at),
    };
  }
}
