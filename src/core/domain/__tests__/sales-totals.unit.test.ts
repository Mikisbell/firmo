/**
 * Unit Test: Lógica de Negocio - Cálculo de Totales en Ventas
 *
 * Valida la lógica pura de cálculo de totales, IGV, y validaciones
 * de integridad en órdenes de venta.
 *
 * REQUISITOS CRÍTICOS:
 * - Dinero SIEMPRE en centavos (enteros)
 * - NUNCA usar float/decimal para dinero
 * - IGV = 18% (Perú)
 * - Precios ya incluyen IGV
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Tipos y constantes
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };

interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: Centavos;
}

interface OrderTotals {
  subtotalCents: Centavos;
  igvCents: Centavos;
  baseImponibleCents: Centavos;
  totalCents: Centavos;
}

const IGV_RATE = 0.18;

// ============================================================
// Funciones puras de negocio (sin dependencias externas)
// ============================================================

/**
 * Calcula totales de una orden con IGV incluido en precios
 *
 * En Perú, los precios al consumidor ya incluyen IGV.
 * Fórmula:
 * - subtotal = suma de (precio × cantidad) [ya incluye IGV]
 * - base imponible = subtotal / 1.18
 * - IGV = subtotal - base imponible
 */
function calculateOrderTotals(items: LineItem[]): OrderTotals {
  if (items.length === 0) {
    throw new Error('ORDER_MUST_HAVE_ITEMS');
  }

  // Validar items
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new Error(`ITEM_QUANTITY_MUST_BE_POSITIVE: ${item.name}`);
    }
    if (item.unitPriceCents < 0) {
      throw new Error(`ITEM_PRICE_CANNOT_BE_NEGATIVE: ${item.name}`);
    }
    if (!Number.isInteger(item.unitPriceCents)) {
      throw new Error(`ITEM_PRICE_MUST_BE_INTEGER_CENTS: ${item.name}`);
    }
  }

  // Calcular subtotal (suma de items, ya incluye IGV)
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  ) as Centavos;

  // Calcular base imponible y IGV
  // Si subtotal incluye IGV: base = subtotal / 1.18
  const baseImponibleCents = Math.round(subtotalCents / (1 + IGV_RATE)) as Centavos;
  const igvCents = (subtotalCents - baseImponibleCents) as Centavos;

  return {
    subtotalCents,
    igvCents,
    baseImponibleCents,
    totalCents: subtotalCents, // Total es igual al subtotal (IGV ya incluido)
  };
}

/**
 * Valida que un monto esté en centavos (entero no negativo)
 */
function isValidCentavos(amount: unknown): amount is Centavos {
  return typeof amount === 'number' && Number.isInteger(amount) && amount >= 0;
}

/**
 * Convierte soles a centavos
 */
function solesToCentavos(soles: number): Centavos {
  if (soles < 0) {
    throw new Error('AMOUNT_CANNOT_BE_NEGATIVE');
  }
  return Math.round(soles * 100) as Centavos;
}

/**
 * Convierte centavos a soles (para display)
 */
function centavosToSoles(centavos: Centavos): number {
  return centavos / 100;
}

/**
 * Calcula cambio (vuelto) para pago en efectivo
 */
function calculateChange(paymentAmountCents: Centavos, totalCents: Centavos): Centavos {
  if (paymentAmountCents < totalCents) {
    throw new Error('INSUFFICIENT_PAYMENT_AMOUNT');
  }

  return (paymentAmountCents - totalCents) as Centavos;
}

/**
 * Valida integridad de una orden
 */
function validateOrderIntegrity(items: LineItem[], totals: OrderTotals): string[] {
  const errors: string[] = [];

  // Validar items
  if (items.length === 0) {
    errors.push('ORDER_MUST_HAVE_AT_LEAST_ONE_ITEM');
  }

  for (const item of items) {
    if (!item.name || item.name.trim() === '') {
      errors.push(`ITEM_NAME_CANNOT_BE_EMPTY: ${item.id}`);
    }
    if (item.quantity <= 0) {
      errors.push(`ITEM_QUANTITY_MUST_BE_POSITIVE: ${item.name}`);
    }
    if (!isValidCentavos(item.unitPriceCents)) {
      errors.push(`ITEM_PRICE_INVALID_CENTS: ${item.name} (${item.unitPriceCents})`);
    }
  }

  // Validar totales
  if (!isValidCentavos(totals.subtotalCents)) {
    errors.push(`SUBTOTAL_INVALID_CENTS: ${totals.subtotalCents}`);
  }
  if (!isValidCentavos(totals.igvCents)) {
    errors.push(`IGV_INVALID_CENTS: ${totals.igvCents}`);
  }
  if (!isValidCentavos(totals.totalCents)) {
    errors.push(`TOTAL_INVALID_CENTS: ${totals.totalCents}`);
  }

  // Validar consistencia
  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0
  );

  if (calculatedSubtotal !== totals.subtotalCents) {
    errors.push(
      `SUBTOTAL_MISMATCH: expected ${calculatedSubtotal}, got ${totals.subtotalCents}`
    );
  }

  if (totals.totalCents !== totals.subtotalCents) {
    errors.push(
      `TOTAL_SHOULD_EQUAL_SUBTOTAL: total=${totals.totalCents}, subtotal=${totals.subtotalCents}`
    );
  }

  // IGV debe ser aproximadamente 18% del subtotal (incluido)
  const expectedIGV = Math.round(totals.subtotalCents * IGV_RATE / (1 + IGV_RATE));
  if (Math.abs(expectedIGV - totals.igvCents) > 1) {
    errors.push(
      `IGV_CALCULATION_ERROR: expected ~${expectedIGV}, got ${totals.igvCents}`
    );
  }

  return errors;
}

// ============================================================
// TESTS
// ============================================================

describe('Sales Domain Logic - Totals Calculation', () => {

  // ----------------------------------------------------------
  // calculateOrderTotals
  // ----------------------------------------------------------

  describe('calculateOrderTotals', () => {

    it('should calculate totals correctly for a single item', () => {
      const items: LineItem[] = [
        {
          id: 'item-1',
          name: 'Pollo Entero',
          quantity: 1,
          unitPriceCents: 5500 as Centavos, // S/. 55.00
        },
      ];

      const totals = calculateOrderTotals(items);

      // Subtotal = 5500 (ya incluye IGV)
      expect(totals.subtotalCents).toBe(5500);
      // Base imponible = 5500 / 1.18 = 4661
      expect(totals.baseImponibleCents).toBe(4661);
      // IGV = 5500 - 4661 = 839
      expect(totals.igvCents).toBe(839);
      // Total = subtotal
      expect(totals.totalCents).toBe(5500);

      // Verificar que IGV es realmente 18%
      const calculatedIGVRate = (totals.igvCents / totals.subtotalCents) * 100;
      expect(calculatedIGVRate).toBeCloseTo(15.25, 1); // 839/5500 = 15.25% (IGV incluido)
    });

    it('should calculate totals correctly for multiple items', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
        { id: '2', name: 'Inca Kola 1.5L', quantity: 2, unitPriceCents: 900 as Centavos },
        { id: '3', name: 'Papas Fritas Grande', quantity: 1, unitPriceCents: 1200 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      // Subtotal = 5500 + 1800 + 1200 = 8500
      expect(totals.subtotalCents).toBe(8500);
      // Base = 8500 / 1.18 = 7203
      expect(totals.baseImponibleCents).toBe(7203);
      // IGV = 8500 - 7203 = 1297
      expect(totals.igvCents).toBe(1297);
      expect(totals.totalCents).toBe(8500);
    });

    it('should handle large quantities correctly', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Inca Kola 500ml', quantity: 100, unitPriceCents: 400 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(40000); // 100 × 400
      expect(totals.totalCents).toBe(40000);
    });

    it('should throw error if items array is empty', () => {
      expect(() => calculateOrderTotals([])).toThrow('ORDER_MUST_HAVE_ITEMS');
    });

    it('should throw error if item quantity is zero', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: 0, unitPriceCents: 5500 as Centavos },
      ];

      expect(() => calculateOrderTotals(items)).toThrow('ITEM_QUANTITY_MUST_BE_POSITIVE');
    });

    it('should throw error if item quantity is negative', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: -1, unitPriceCents: 5500 as Centavos },
      ];

      expect(() => calculateOrderTotals(items)).toThrow('ITEM_QUANTITY_MUST_BE_POSITIVE');
    });

    it('should throw error if item price is not integer', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: 1, unitPriceCents: 5500.5 as Centavos },
      ];

      expect(() => calculateOrderTotals(items)).toThrow('ITEM_PRICE_MUST_BE_INTEGER_CENTS');
    });

    it('should handle items with zero price (complimentary)', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Agua de cortesía', quantity: 2, unitPriceCents: 0 as Centavos },
        { id: '2', name: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(5500);
      expect(totals.totalCents).toBe(5500);
    });
  });

  // ----------------------------------------------------------
  // isValidCentavos
  // ----------------------------------------------------------

  describe('isValidCentavos', () => {

    it('should return true for positive integers', () => {
      expect(isValidCentavos(0)).toBe(true);
      expect(isValidCentavos(1)).toBe(true);
      expect(isValidCentavos(100)).toBe(true);
      expect(isValidCentavos(999999)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isValidCentavos(-1)).toBe(false);
      expect(isValidCentavos(-100)).toBe(false);
    });

    it('should return false for non-integers', () => {
      expect(isValidCentavos(1.5)).toBe(false);
      expect(isValidCentavos(0.01)).toBe(false);
      expect(isValidCentavos(100.99)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidCentavos('100' as any)).toBe(false);
      expect(isValidCentavos(null as any)).toBe(false);
      expect(isValidCentavos(undefined as any)).toBe(false);
      expect(isValidCentavos(NaN)).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // solesToCentavos / centavosToSoles
  // ----------------------------------------------------------

  describe('Currency conversion', () => {

    it('should convert soles to centavos correctly', () => {
      expect(solesToCentavos(0)).toBe(0);
      expect(solesToCentavos(1)).toBe(100);
      expect(solesToCentavos(10)).toBe(1000);
      expect(solesToCentavos(55.00)).toBe(5500);
      expect(solesToCentavos(85.50)).toBe(8550);
      expect(solesToCentavos(0.01)).toBe(1);
    });

    it('should round correctly for fractional soles', () => {
      expect(solesToCentavos(0.005)).toBe(1); // Rounds up
      expect(solesToCentavos(0.004)).toBe(0); // Rounds down
    });

    it('should throw error for negative soles', () => {
      expect(() => solesToCentavos(-1)).toThrow('AMOUNT_CANNOT_BE_NEGATIVE');
    });

    it('should convert centavos to soles correctly', () => {
      expect(centavosToSoles(0 as Centavos)).toBe(0);
      expect(centavosToSoles(100 as Centavos)).toBe(1);
      expect(centavosToSoles(5500 as Centavos)).toBe(55);
      expect(centavosToSoles(8550 as Centavos)).toBe(85.5);
    });

    it('should be reversible (soles → centavos → soles)', () => {
      const originalSoles = 55.50;
      const centavos = solesToCentavos(originalSoles);
      const backToSoles = centavosToSoles(centavos);

      expect(backToSoles).toBe(originalSoles);
    });
  });

  // ----------------------------------------------------------
  // calculateChange
  // ----------------------------------------------------------

  describe('calculateChange', () => {

    it('should calculate exact change correctly', () => {
      const change = calculateChange(10000 as Centavos, 8500 as Centavos);
      expect(change).toBe(1500); // S/. 15.00 de vuelto
    });

    it('should return zero for exact payment', () => {
      const change = calculateChange(8500 as Centavos, 8500 as Centavos);
      expect(change).toBe(0);
    });

    it('should throw error if payment is insufficient', () => {
      expect(() => calculateChange(5000 as Centavos, 8500 as Centavos))
        .toThrow('INSUFFICIENT_PAYMENT_AMOUNT');
    });

    it('should handle large change amounts', () => {
      const change = calculateChange(100000 as Centavos, 8500 as Centavos);
      expect(change).toBe(91500); // S/. 915.00
    });
  });

  // ----------------------------------------------------------
  // validateOrderIntegrity
  // ----------------------------------------------------------

  describe('validateOrderIntegrity', () => {

    it('should return no errors for a valid order', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
        { id: '2', name: 'Inca Kola 1.5L', quantity: 2, unitPriceCents: 900 as Centavos },
      ];

      const totals = calculateOrderTotals(items);
      const errors = validateOrderIntegrity(items, totals);

      expect(errors).toEqual([]);
    });

    it('should detect empty items array', () => {
      const errors = validateOrderIntegrity([], {
        subtotalCents: 0 as Centavos,
        igvCents: 0 as Centavos,
        baseImponibleCents: 0 as Centavos,
        totalCents: 0 as Centavos,
      });

      expect(errors).toContain('ORDER_MUST_HAVE_AT_LEAST_ONE_ITEM');
    });

    it('should detect negative quantity', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: -1, unitPriceCents: 5500 as Centavos },
      ];

      const totals = {
        subtotalCents: -5500 as Centavos,
        igvCents: -839 as Centavos,
        baseImponibleCents: -4661 as Centavos,
        totalCents: -5500 as Centavos,
      };

      const errors = validateOrderIntegrity(items, totals);

      expect(errors.some(e => e.includes('ITEM_QUANTITY_MUST_BE_POSITIVE'))).toBe(true);
      expect(errors.some(e => e.includes('SUBTOTAL_INVALID_CENTS'))).toBe(true);
    });

    it('should detect subtotal mismatch', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos },
      ];

      const totals: OrderTotals = {
        subtotalCents: 6000 as Centavos, // Wrong! Should be 5500
        igvCents: 915 as Centavos,
        baseImponibleCents: 5085 as Centavos,
        totalCents: 6000 as Centavos,
      };

      const errors = validateOrderIntegrity(items, totals);

      expect(errors.some(e => e.includes('SUBTOTAL_MISMATCH'))).toBe(true);
    });

    it('should detect IGV calculation errors', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos },
      ];

      const totals: OrderTotals = {
        subtotalCents: 5500 as Centavos,
        igvCents: 2000 as Centavos, // Wrong! Should be ~839
        baseImponibleCents: 3500 as Centavos,
        totalCents: 5500 as Centavos,
      };

      const errors = validateOrderIntegrity(items, totals);

      expect(errors.some(e => e.includes('IGV_CALCULATION_ERROR'))).toBe(true);
    });

    it('should detect empty item names', () => {
      const items: LineItem[] = [
        { id: '1', name: '', quantity: 1, unitPriceCents: 5500 as Centavos },
      ];

      const totals = {
        subtotalCents: 5500 as Centavos,
        igvCents: 839 as Centavos,
        baseImponibleCents: 4661 as Centavos,
        totalCents: 5500 as Centavos,
      };

      const errors = validateOrderIntegrity(items, totals);

      expect(errors.some(e => e.includes('ITEM_NAME_CANNOT_BE_EMPTY'))).toBe(true);
    });

    it('should detect multiple errors at once', () => {
      const items: LineItem[] = [
        { id: '1', name: '', quantity: -1, unitPriceCents: 5500.5 as Centavos },
      ];

      const totals: OrderTotals = {
        subtotalCents: -5500.5 as any,
        igvCents: -839 as any,
        baseImponibleCents: -4661 as any,
        totalCents: -5500.5 as any,
      };

      const errors = validateOrderIntegrity(items, totals);

      // Should detect multiple errors
      expect(errors.length).toBeGreaterThan(3);
    });
  });

  // ----------------------------------------------------------
  // Edge cases y casos de borde
  // ----------------------------------------------------------

  describe('Edge cases', () => {

    it('should handle very large orders correctly', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Pollo Entero', quantity: 1000, unitPriceCents: 5500 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(5_500_000); // S/. 55,000.00
      expect(Number.isInteger(totals.subtotalCents)).toBe(true);
    });

    it('should handle minimum possible values', () => {
      const items: LineItem[] = [
        { id: '1', name: 'Item mínimo', quantity: 1, unitPriceCents: 1 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(1); // S/. 0.01
      expect(totals.igvCents).toBe(0); // IGV < 1 centavo, redondea a 0
    });

    it('should maintain precision with many items', () => {
      const items: LineItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        name: `Producto ${i}`,
        quantity: 1,
        unitPriceCents: 1234 as Centavos,
      }));

      const totals = calculateOrderTotals(items);

      expect(totals.subtotalCents).toBe(123400); // 100 × 1234
      expect(Number.isInteger(totals.subtotalCents)).toBe(true);
    });

    it('should handle rounding correctly for IGV', () => {
      // Caso donde IGV genera fracción de centavo
      const items: LineItem[] = [
        { id: '1', name: 'Producto raro', quantity: 1, unitPriceCents: 100 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      // Base = 100 / 1.18 = 84.74... → 85
      // IGV = 100 - 85 = 15
      expect(totals.baseImponibleCents).toBe(85);
      expect(totals.igvCents).toBe(15);
      expect(totals.subtotalCents).toBe(100);
    });
  });

  // ----------------------------------------------------------
  // Casos reales del negocio
  // ----------------------------------------------------------

  describe('Real business scenarios', () => {

    it('should calculate correctly: Combo Familiar completo', () => {
      // Escenario real: Mesa pide combo familiar + bebidas
      const items: LineItem[] = [
        { id: '1', name: 'Combo Familiar', quantity: 1, unitPriceCents: 8900 as Centavos },
        { id: '2', name: 'Inca Kola 1.5L', quantity: 2, unitPriceCents: 900 as Centavos },
        { id: '3', name: 'Ají Extra', quantity: 3, unitPriceCents: 100 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      // Subtotal = 8900 + 1800 + 300 = 11000
      expect(totals.subtotalCents).toBe(11000); // S/. 110.00
      expect(totals.baseImponibleCents).toBe(9322); // 11000 / 1.18
      expect(totals.igvCents).toBe(1678); // 11000 - 9322
      expect(totals.totalCents).toBe(11000);

      // Validar integridad
      const errors = validateOrderIntegrity(items, totals);
      expect(errors).toEqual([]);
    });

    it('should calculate correctly: Pedido para evento grande', () => {
      // Escenario: Pedido corporativo de 50 pollos
      const items: LineItem[] = [
        { id: '1', name: 'Pollo Entero', quantity: 50, unitPriceCents: 5500 as Centavos },
        { id: '2', name: 'Papas Fritas Grande', quantity: 50, unitPriceCents: 1200 as Centavos },
        { id: '3', name: 'Ensalada', quantity: 50, unitPriceCents: 600 as Centavos },
        { id: '4', name: 'Chicha Morada Jarra', quantity: 25, unitPriceCents: 1200 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      // Subtotal = 275000 + 60000 + 30000 + 30000 = 395000
      expect(totals.subtotalCents).toBe(395000); // S/. 3,950.00
      expect(totals.baseImponibleCents).toBe(334746); // 395000 / 1.18
      expect(totals.igvCents).toBe(60254); // 395000 - 334746
      expect(totals.totalCents).toBe(395000);

      // Validar cambio si paga con S/. 4,000
      const change = calculateChange(400000 as Centavos, totals.totalCents);
      expect(change).toBe(5000); // S/. 50.00 de vuelto
    });

    it('should handle: Mesa paga con billete grande', () => {
      const items: LineItem[] = [
        { id: '1', name: '1/2 Pollo', quantity: 2, unitPriceCents: 2800 as Centavos },
        { id: '2', name: 'Coca Cola 500ml', quantity: 2, unitPriceCents: 400 as Centavos },
      ];

      const totals = calculateOrderTotals(items);

      // Total = 5600 + 800 = 6400 (S/. 64.00)
      expect(totals.totalCents).toBe(6400);

      // Cliente paga con billete de S/. 100
      const change = calculateChange(10000 as Centavos, totals.totalCents);
      expect(change).toBe(3600); // Vuelto: S/. 36.00
    });
  });
});
