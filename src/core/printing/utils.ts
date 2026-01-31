/**
 * Utility functions for printing
 * Extracted to enable property-based testing
 */

import type { Centavos } from '@/src/core/types/shared';

export interface OrderLineInput {
  line_id: string;
  product_id: string;
  name: string;
  qty: number;
  unit_price_cents: Centavos;
  line_total_cents: Centavos;
  station?: string;
}

export interface PrintLine {
  name: string;
  qty: number;
  total: Centavos;
}

/**
 * Transforms order lines to print lines for precheck/ticket printing.
 * 
 * Properties:
 * - All items are preserved (same count)
 * - Order is preserved
 * - Name falls back to product_id if empty
 * - Totals are preserved exactly (no rounding)
 * 
 * @param items - Array of order line items
 * @returns Array of print lines ready for TicketTemplate
 */
export function transformLinesToPrint(items: OrderLineInput[]): PrintLine[] {
  return items.map(item => ({
    name: item.name || item.product_id,
    qty: item.qty,
    total: item.line_total_cents
  }));
}

/**
 * Calculates the total from print lines.
 * Used to verify ticket totals match order totals.
 * 
 * @param lines - Array of print lines
 * @returns Sum of all line totals in cents
 */
export function calculatePrintTotal(lines: PrintLine[]): Centavos {
  return lines.reduce((sum, line) => sum + line.total, 0) as Centavos;
}
