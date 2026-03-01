/**
 * Denominaciones monetarias peruanas (PEN)
 *
 * Billetes y monedas en circulación para conteo de arqueo de caja.
 * Valores en centavos (integer).
 *
 * @module core/constants/denominations
 */

export interface Denomination {
  /** Valor facial en centavos */
  faceCents: number;
  /** Label para UI */
  label: string;
  /** Tipo: billete o moneda */
  type: 'bill' | 'coin';
}

/**
 * Denominaciones peruanas ordenadas de mayor a menor.
 * Fuente: BCRP (Banco Central de Reserva del Perú)
 */
export const PEN_DENOMINATIONS: readonly Denomination[] = [
  // Billetes
  { faceCents: 20_000, label: 'S/ 200', type: 'bill' },
  { faceCents: 10_000, label: 'S/ 100', type: 'bill' },
  { faceCents:  5_000, label: 'S/ 50',  type: 'bill' },
  { faceCents:  2_000, label: 'S/ 20',  type: 'bill' },
  { faceCents:  1_000, label: 'S/ 10',  type: 'bill' },
  // Monedas
  { faceCents:    500, label: 'S/ 5',   type: 'coin' },
  { faceCents:    200, label: 'S/ 2',   type: 'coin' },
  { faceCents:    100, label: 'S/ 1',   type: 'coin' },
  { faceCents:     50, label: 'S/ 0.50', type: 'coin' },
  { faceCents:     20, label: 'S/ 0.20', type: 'coin' },
  { faceCents:     10, label: 'S/ 0.10', type: 'coin' },
] as const;

/** Map de face_value → Denomination para lookup rápido */
export const DENOMINATION_MAP = new Map(
  PEN_DENOMINATIONS.map(d => [d.faceCents, d])
);

/**
 * Calcula el total de un conteo de denominaciones.
 * @param counts - Map de faceCents → cantidad de unidades
 * @returns Total en centavos
 */
export function calculateDenominationTotal(
  counts: Record<number, number>
): number {
  let total = 0;
  for (const [face, qty] of Object.entries(counts)) {
    total += Number(face) * (qty || 0);
  }
  return total;
}
