/**
 * Cash Alert Service - Variance detection at shift close
 *
 * Detects when the cash difference (counted vs expected)
 * exceeds the tenant's configured threshold and creates
 * an alert event. Uses the existing alert infrastructure.
 *
 * All amounts in centavos (integer).
 *
 * @module core/services/cash-alert.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError } from '@/src/core/result';
import { LIMITS } from '@/src/core/constants/limits';
import { logger } from '@/src/core/observability/structured-logger';

// ============================================================================
// Types
// ============================================================================

export interface CashVarianceAlert {
  shiftId: string;
  terminalId: string;
  cashExpectedCents: number;
  cashCountedCents: number;
  diffCents: number;
  thresholdCents: number;
  severity: 'WARNING' | 'CRITICAL';
  alertEventId: string | null;
}

// ============================================================================
// Service
// ============================================================================

export class CashAlertService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Check if a shift close has a cash variance that exceeds the threshold.
   * Creates an alert_event if the variance is significant.
   *
   * @param tenantId - Tenant ID
   * @param shiftId - Shift being closed
   * @param cashExpectedCents - Expected cash amount
   * @param cashCountedCents - Actual counted cash
   * @param closedBy - Employee closing the shift
   */
  async checkVariance(
    tenantId: string,
    shiftId: string,
    cashExpectedCents: number,
    cashCountedCents: number,
    closedBy: string,
  ): Promise<Result<CashVarianceAlert | null, DomainError>> {
    const diffCents = cashCountedCents - cashExpectedCents;
    const absDiff = Math.abs(diffCents);

    // Get tenant threshold
    const settings = await (this.prisma as any).tenant_settings.findFirst({
      where: { tenant_id: tenantId },
      select: { cash_variance_alert_cents: true },
    });

    const thresholdCents = settings?.cash_variance_alert_cents
      ?? LIMITS.DEFAULT_CASH_VARIANCE_ALERT_CENTS;

    if (absDiff <= thresholdCents) {
      return ok(null); // Within tolerance
    }

    // Get shift terminal info
    const shift = await (this.prisma as any).shifts.findFirst({
      where: { id: shiftId, tenant_id: tenantId },
      select: { terminal_id: true },
    });

    const terminalId = shift?.terminal_id ?? 'unknown';

    // Determine severity: > 5x threshold = CRITICAL
    const severity = absDiff > thresholdCents * 5 ? 'CRITICAL' : 'WARNING';

    const direction = diffCents > 0 ? 'sobrante' : 'faltante';
    const message = `Diferencia de caja ${direction}: S/ ${(absDiff / 100).toFixed(2)} ` +
      `(umbral: S/ ${(thresholdCents / 100).toFixed(2)}) — ` +
      `Terminal: ${terminalId}`;

    // Create alert event in the existing alert_events table
    let alertEventId: string | null = null;
    try {
      const event = await (this.prisma as any).alert_events.create({
        data: {
          tenant_id: tenantId,
          alert_type: 'CASH_VARIANCE',
          severity,
          current_value: absDiff,
          threshold_value: thresholdCents,
          message,
          metadata: {
            shift_id: shiftId,
            terminal_id: terminalId,
            cash_expected_cents: cashExpectedCents,
            cash_counted_cents: cashCountedCents,
            diff_cents: diffCents,
            closed_by: closedBy,
          },
          status: 'ACTIVE',
          escalated: false,
        },
      });
      alertEventId = event.id;
    } catch (error) {
      // Alert creation is non-critical — log and continue
      logger.warn('No se pudo crear alerta de varianza de caja', {
        shift_id: shiftId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.warn('Varianza de caja detectada', {
      shift_id: shiftId,
      terminal_id: terminalId,
      diff_cents: diffCents,
      threshold_cents: thresholdCents,
      severity,
    });

    return ok({
      shiftId,
      terminalId,
      cashExpectedCents,
      cashCountedCents,
      diffCents,
      thresholdCents,
      severity,
      alertEventId,
    });
  }

  /**
   * Validate opening cash does not exceed tenant maximum.
   */
  async validateOpeningCash(
    tenantId: string,
    cashOpeningCents: number,
  ): Promise<Result<boolean, DomainError>> {
    const settings = await (this.prisma as any).tenant_settings.findFirst({
      where: { tenant_id: tenantId },
      select: { max_cash_opening_cents: true },
    });

    const maxCents = settings?.max_cash_opening_cents
      ?? LIMITS.DEFAULT_MAX_CASH_OPENING_CENTS;

    if (cashOpeningCents > maxCents) {
      return err(new DomainError(
        `Monto de apertura S/ ${(cashOpeningCents / 100).toFixed(2)} excede el máximo permitido S/ ${(maxCents / 100).toFixed(2)}`,
        'CASH_OPENING_TOO_HIGH',
        { cashOpeningCents, maxCents },
      ));
    }

    return ok(true);
  }
}
