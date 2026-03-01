/**
 * Denomination Service - Cash counting by denomination at shift close
 *
 * Saves and retrieves denomination counts per shift for Peruvian
 * currency (PEN). All amounts in centavos (integer).
 *
 * @module core/services/denomination.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, ValidationError, NotFoundError } from '@/src/core/result';
import { PEN_DENOMINATIONS, DENOMINATION_MAP, calculateDenominationTotal } from '@/src/core/constants/denominations';

// ============================================================================
// Types
// ============================================================================

export interface DenominationCount {
  faceValue: number;
  label: string;
  type: 'bill' | 'coin';
  count: number;
  totalCents: number;
}

export interface DenominationSummary {
  shiftId: string;
  counts: DenominationCount[];
  grandTotalCents: number;
}

/** Input: map of faceCents → quantity */
export type DenominationInput = Record<number, number>;

// ============================================================================
// Service
// ============================================================================

export class DenominationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Save denomination counts for a shift close.
   * Validates all face values are valid PEN denominations.
   */
  async saveCounts(
    tenantId: string,
    shiftId: string,
    counts: DenominationInput,
  ): Promise<Result<DenominationSummary, DomainError>> {
    // Validate shift exists and belongs to tenant
    const shift = await (this.prisma as any).shifts.findFirst({
      where: { id: shiftId, tenant_id: tenantId },
    });

    if (!shift) {
      return err(new NotFoundError('Turno', shiftId));
    }

    // Validate all face values
    const invalidFaces: number[] = [];
    for (const faceStr of Object.keys(counts)) {
      const face = Number(faceStr);
      if (!DENOMINATION_MAP.has(face)) {
        invalidFaces.push(face);
      }
    }

    if (invalidFaces.length > 0) {
      return err(new ValidationError(
        `Denominaciones inválidas: ${invalidFaces.join(', ')}`,
        'counts',
      ));
    }

    // Validate no negative quantities
    for (const [face, qty] of Object.entries(counts)) {
      if (qty < 0) {
        return err(new ValidationError(
          `Cantidad negativa para denominación ${face}`,
          'counts',
        ));
      }
    }

    // Upsert each denomination count
    const result: DenominationCount[] = [];

    for (const denom of PEN_DENOMINATIONS) {
      const qty = counts[denom.faceCents] ?? 0;
      if (qty === 0) continue;

      const totalCents = denom.faceCents * qty;

      await (this.prisma as any).shift_denominations.upsert({
        where: {
          shift_id_face_value: {
            shift_id: shiftId,
            face_value: denom.faceCents,
          },
        },
        create: {
          tenant_id: tenantId,
          shift_id: shiftId,
          face_value: denom.faceCents,
          count: qty,
          total_cents: totalCents,
        },
        update: {
          count: qty,
          total_cents: totalCents,
        },
      });

      result.push({
        faceValue: denom.faceCents,
        label: denom.label,
        type: denom.type,
        count: qty,
        totalCents,
      });
    }

    const grandTotal = calculateDenominationTotal(counts);

    return ok({
      shiftId,
      counts: result,
      grandTotalCents: grandTotal,
    });
  }

  /**
   * Get denomination counts for a shift.
   */
  async getCounts(
    tenantId: string,
    shiftId: string,
  ): Promise<Result<DenominationSummary, DomainError>> {
    const rows = await (this.prisma as any).shift_denominations.findMany({
      where: { shift_id: shiftId, tenant_id: tenantId },
      orderBy: { face_value: 'desc' },
    });

    let grandTotal = 0;
    const counts: DenominationCount[] = rows.map((r: any) => {
      const denom = DENOMINATION_MAP.get(r.face_value);
      grandTotal += r.total_cents;
      return {
        faceValue: r.face_value,
        label: denom?.label ?? `S/ ${(r.face_value / 100).toFixed(2)}`,
        type: denom?.type ?? 'coin',
        count: r.count,
        totalCents: r.total_cents,
      };
    });

    return ok({
      shiftId,
      counts,
      grandTotalCents: grandTotal,
    });
  }
}
