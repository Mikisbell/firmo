/**
 * Shift Service - Query and summary operations for POS shifts
 *
 * @module core/services/shift.service
 */

import { PrismaClient } from '@prisma/client';
import { Result, ok, err, DomainError } from '@/src/core/result';

export interface ShiftSummary {
  shiftId: string;
  terminalId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  cashOpeningCents: number;
  cashExpectedCents: number | null;
  cashCountedCents: number | null;
  diffCents: number | null;
  ordersCount: number;
  totalSalesCents: number;
  paymentBreakdown: Record<string, { count: number; totalCents: number }>;
}

export class ShiftService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get active (OPEN) shift for a terminal
   */
  async getActiveShift(
    tenantId: string,
    terminalId: string
  ): Promise<Result<any | null, DomainError>> {
    try {
      const shift = await this.prisma.shifts.findFirst({
        where: {
          tenant_id: tenantId,
          terminal_id: terminalId,
          status: 'OPEN',
        },
        orderBy: { opened_at: 'desc' },
      });
      return ok(shift);
    } catch (error) {
      return err(new DomainError('Error al buscar turno activo', 'QUERY_FAILED'));
    }
  }

  /**
   * Get shift summary with payment breakdown
   */
  async getShiftSummary(
    tenantId: string,
    shiftId: string
  ): Promise<Result<ShiftSummary, DomainError>> {
    try {
      const shift = await this.prisma.shifts.findFirst({
        where: { id: shiftId, tenant_id: tenantId },
      });

      if (!shift) {
        return err(new DomainError('Turno no encontrado', 'NOT_FOUND'));
      }

      // Get payments for this shift
      const payments = await this.prisma.payments.findMany({
        where: { tenant_id: tenantId, shift_id: shiftId, status: 'COMPLETED' },
      });

      // Get orders count for this shift
      const ordersCount = await this.prisma.orders.count({
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

      // Calculate payment breakdown
      const breakdown: Record<string, { count: number; totalCents: number }> = {};
      let totalSalesCents = 0;

      for (const p of payments) {
        const method = p.payment_method;
        if (!breakdown[method]) {
          breakdown[method] = { count: 0, totalCents: 0 };
        }
        breakdown[method].count++;
        breakdown[method].totalCents += p.amount_cents;
        totalSalesCents += p.amount_cents;
      }

      return ok({
        shiftId: shift.id,
        terminalId: shift.terminal_id,
        status: shift.status,
        openedAt: shift.opened_at.toISOString(),
        closedAt: shift.closed_at?.toISOString() ?? null,
        openedBy: shift.opened_by,
        closedBy: shift.closed_by ?? null,
        cashOpeningCents: shift.cash_opening_cents,
        cashExpectedCents: shift.cash_expected_cents ?? null,
        cashCountedCents: shift.cash_counted_cents ?? null,
        diffCents: shift.diff_cents ?? null,
        ordersCount,
        totalSalesCents,
        paymentBreakdown: breakdown,
      });
    } catch (error) {
      return err(new DomainError('Error al obtener resumen de turno', 'QUERY_FAILED'));
    }
  }

  /**
   * Get shift history for a terminal
   */
  async getShiftHistory(
    tenantId: string,
    terminalId: string,
    limit: number = 10
  ): Promise<Result<any[], DomainError>> {
    try {
      const shifts = await this.prisma.shifts.findMany({
        where: {
          tenant_id: tenantId,
          terminal_id: terminalId,
        },
        orderBy: { opened_at: 'desc' },
        take: limit,
      });
      return ok(shifts);
    } catch (error) {
      return err(new DomainError('Error al obtener historial de turnos', 'QUERY_FAILED'));
    }
  }
}
