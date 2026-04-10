/**
 * Unit Tests: Inventario FEFO - Lógica de Negocio
 *
 * Valida:
 * - FEFO (First Expired First Out): lotes ordenados por vencimiento
 * - Urgencia de vencimiento: EXPIRED, TODAY, TOMORROW, SOON_3D, SOON_7D, OK
 * - Stock = IN - OUT - WASTE + ADJUST
 * - Prevención de stock negativo
 * - Alertas de stock bajo
 * - Cálculo de kardex
 * - Costo de desperdicio
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Tipos y constantes
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type MovementType = 'IN' | 'OUT' | 'WASTE' | 'ADJUST';
type StockStatus = 'OK' | 'LOW' | 'CRITICAL';
type ExpiryUrgency = 'EXPIRED' | 'TODAY' | 'TOMORROW' | 'SOON_3D' | 'SOON_7D' | 'OK';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

interface InventoryLot {
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
  urgency: ExpiryUrgency;
  daysUntilExpiry: number | null;
}

interface KardexEntry {
  date: string;
  movementType: MovementType;
  quantity: number;
  balance: number;
  reference?: string;
}

interface WasteRecord {
  itemId: string;
  quantity: number;
  costPerUnit: Centavos;
  reason: string;
  lotNumber?: string;
}

// ============================================================
// Funciones puras de negocio
// ============================================================

/**
 * Calcula urgencia de vencimiento
 */
function calculateExpiryUrgency(expiryDate: string | null, now?: Date): {
  urgency: ExpiryUrgency;
  daysUntilExpiry: number | null;
} {
  if (!expiryDate) {
    return { urgency: 'OK', daysUntilExpiry: null };
  }

  const expiry = new Date(expiryDate);
  const referenceDate = now || new Date();
  
  // Normalizar a medianoche para comparar solo días
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  
  const diffMs = expiryDay.getTime() - today.getTime();
  const daysUntilExpiry = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let urgency: ExpiryUrgency;
  if (daysUntilExpiry < 0) urgency = 'EXPIRED';
  else if (daysUntilExpiry === 0) urgency = 'TODAY';
  else if (daysUntilExpiry === 1) urgency = 'TOMORROW';
  else if (daysUntilExpiry <= 3) urgency = 'SOON_3D';
  else if (daysUntilExpiry <= 7) urgency = 'SOON_7D';
  else urgency = 'OK';

  return { urgency, daysUntilExpiry };
}

/**
 * Ordena lotes por FEFO (First Expired First Out)
 */
function sortLotsFEFO(lots: InventoryLot[]): InventoryLot[] {
  return [...lots].sort((a, b) => {
    // Lotes sin fecha van al final
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}

/**
 * Selecciona lotes para deducción usando FEFO
 */
function selectLotsForDeduction(
  lots: InventoryLot[],
  requiredQuantity: number
): Array<{ lot: InventoryLot; quantity: number }> {
  const sorted = sortLotsFEFO(lots);
  const selected: Array<{ lot: InventoryLot; quantity: number }> = [];
  let remaining = requiredQuantity;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    
    const take = Math.min(remaining, lot.quantity);
    selected.push({ lot, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`STOCK_INSUFFICIENT: Se necesitan ${requiredQuantity}, hay ${requiredQuantity - remaining}`);
  }

  return selected;
}

/**
 * Calcula stock actual desde movimientos
 */
function calculateStock(movements: Array<{ type: MovementType; quantity: number }>): number {
  return movements.reduce((balance, m) => {
    switch (m.type) {
      case 'IN': return balance + m.quantity;
      case 'OUT': return balance - m.quantity;
      case 'WASTE': return balance - m.quantity;
      case 'ADJUST': return balance + m.quantity; // ADJUST puede ser negativo
      default: return balance;
    }
  }, 0);
}

/**
 * Determina estado de stock
 */
function determineStockStatus(currentStock: number, minStock: number): StockStatus {
  if (currentStock < 0) return 'CRITICAL';
  if (currentStock < minStock) return 'LOW';
  return 'OK';
}

/**
 * Calcula costo de desperdicio
 */
function calculateWasteCost(waste: WasteRecord): Centavos {
  return centavos(waste.quantity * waste.costPerUnit);
}

/**
 * Genera entradas de kardex
 */
function generateKardex(
  initialBalance: number,
  movements: Array<{ date: string; type: MovementType; quantity: number; reference?: string }>
): KardexEntry[] {
  let balance = initialBalance;
  
  return movements.map(m => {
    const quantityDelta = m.type === 'IN' || m.type === 'ADJUST' ? m.quantity : -m.quantity;
    balance += quantityDelta;
    
    return {
      date: m.date,
      movementType: m.type,
      quantity: m.quantity,
      balance,
      reference: m.reference,
    };
  });
}

// ============================================================
// TESTS
// ============================================================

describe('Inventory FEFO - Business Logic', () => {

  // ----------------------------------------------------------
  // calculateExpiryUrgency
  // ----------------------------------------------------------

  describe('calculateExpiryUrgency', () => {

    it('should return EXPIRED for past dates', () => {
      const result = calculateExpiryUrgency('2026-04-01', new Date('2026-04-09'));
      expect(result.urgency).toBe('EXPIRED');
      expect(result.daysUntilExpiry).toBe(-8);
    });

    it('should return TODAY for same day', () => {
      const result = calculateExpiryUrgency('2026-04-09', new Date('2026-04-09'));
      expect(result.urgency).toBe('TODAY');
      expect(result.daysUntilExpiry).toBe(0);
    });

    it('should return TOMORROW for next day', () => {
      const result = calculateExpiryUrgency('2026-04-10', new Date('2026-04-09'));
      expect(result.urgency).toBe('TOMORROW');
      expect(result.daysUntilExpiry).toBe(1);
    });

    it('should return SOON_3D for 2-3 days', () => {
      expect(calculateExpiryUrgency('2026-04-11', new Date('2026-04-09')).urgency).toBe('SOON_3D');
      expect(calculateExpiryUrgency('2026-04-12', new Date('2026-04-09')).urgency).toBe('SOON_3D');
    });

    it('should return SOON_7D for 4-7 days', () => {
      expect(calculateExpiryUrgency('2026-04-13', new Date('2026-04-09')).urgency).toBe('SOON_7D');
      expect(calculateExpiryUrgency('2026-04-16', new Date('2026-04-09')).urgency).toBe('SOON_7D');
    });

    it('should return OK for > 7 days', () => {
      const result = calculateExpiryUrgency('2026-04-20', new Date('2026-04-09'));
      expect(result.urgency).toBe('OK');
      expect(result.daysUntilExpiry).toBe(11);
    });

    it('should handle null expiry', () => {
      const result = calculateExpiryUrgency(null);
      expect(result.urgency).toBe('OK');
      expect(result.daysUntilExpiry).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // sortLotsFEFO
  // ----------------------------------------------------------

  describe('sortLotsFEFO', () => {

    it('should sort lots by expiry date ascending', () => {
      const lots: InventoryLot[] = [
        { lotNumber: 'L003', quantity: 10, expiryDate: '2026-04-20', urgency: 'SOON_7D', daysUntilExpiry: 11 },
        { lotNumber: 'L001', quantity: 5, expiryDate: '2026-04-10', urgency: 'TOMORROW', daysUntilExpiry: 1 },
        { lotNumber: 'L002', quantity: 8, expiryDate: '2026-04-15', urgency: 'SOON_3D', daysUntilExpiry: 6 },
      ];

      const sorted = sortLotsFEFO(lots);

      expect(sorted.map(l => l.lotNumber)).toEqual(['L001', 'L002', 'L003']);
    });

    it('should put lots without expiry at the end', () => {
      const lots: InventoryLot[] = [
        { lotNumber: 'L001', quantity: 10, expiryDate: null, urgency: 'OK', daysUntilExpiry: null },
        { lotNumber: 'L002', quantity: 5, expiryDate: '2026-04-15', urgency: 'SOON_3D', daysUntilExpiry: 6 },
      ];

      const sorted = sortLotsFEFO(lots);

      expect(sorted.map(l => l.lotNumber)).toEqual(['L002', 'L001']);
    });

    it('should handle empty array', () => {
      expect(sortLotsFEFO([])).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // selectLotsForDeduction
  // ----------------------------------------------------------

  describe('selectLotsForDeduction', () => {

    it('should select lots in FEFO order', () => {
      const lots: InventoryLot[] = [
        { lotNumber: 'L001', quantity: 5, expiryDate: '2026-04-10', urgency: 'TOMORROW', daysUntilExpiry: 1 },
        { lotNumber: 'L002', quantity: 10, expiryDate: '2026-04-20', urgency: 'SOON_7D', daysUntilExpiry: 11 },
      ];

      const selected = selectLotsForDeduction(lots, 12);

      expect(selected).toHaveLength(2);
      expect(selected[0].lot.lotNumber).toBe('L001');
      expect(selected[0].quantity).toBe(5);
      expect(selected[1].lot.lotNumber).toBe('L002');
      expect(selected[1].quantity).toBe(7);
    });

    it('should throw if insufficient stock', () => {
      const lots: InventoryLot[] = [
        { lotNumber: 'L001', quantity: 5, expiryDate: '2026-04-10', urgency: 'TOMORROW', daysUntilExpiry: 1 },
      ];

      expect(() => selectLotsForDeduction(lots, 10)).toThrow('STOCK_INSUFFICIENT');
    });

    it('should use single lot if sufficient', () => {
      const lots: InventoryLot[] = [
        { lotNumber: 'L001', quantity: 20, expiryDate: '2026-04-10', urgency: 'TOMORROW', daysUntilExpiry: 1 },
      ];

      const selected = selectLotsForDeduction(lots, 8);

      expect(selected).toHaveLength(1);
      expect(selected[0].quantity).toBe(8);
    });
  });

  // ----------------------------------------------------------
  // calculateStock
  // ----------------------------------------------------------

  describe('calculateStock', () => {

    it('should calculate stock from movements', () => {
      const movements = [
        { type: 'IN' as MovementType, quantity: 100 },
        { type: 'OUT' as MovementType, quantity: 30 },
        { type: 'WASTE' as MovementType, quantity: 5 },
        { type: 'ADJUST' as MovementType, quantity: -10 },
      ];

      const stock = calculateStock(movements);

      expect(stock).toBe(55); // 100 - 30 - 5 - 10
    });

    it('should handle empty movements', () => {
      expect(calculateStock([])).toBe(0);
    });

    it('should handle ADJUST with negative value', () => {
      const movements = [
        { type: 'IN' as MovementType, quantity: 50 },
        { type: 'ADJUST' as MovementType, quantity: -20 },
      ];

      expect(calculateStock(movements)).toBe(30);
    });
  });

  // ----------------------------------------------------------
  // determineStockStatus
  // ----------------------------------------------------------

  describe('determineStockStatus', () => {

    it('should return OK when stock >= minStock', () => {
      expect(determineStockStatus(100, 20)).toBe('OK');
      expect(determineStockStatus(20, 20)).toBe('OK');
    });

    it('should return LOW when 0 <= stock < minStock', () => {
      expect(determineStockStatus(15, 20)).toBe('LOW');
      expect(determineStockStatus(1, 20)).toBe('LOW');
    });

    it('should return CRITICAL when stock < 0', () => {
      expect(determineStockStatus(-1, 20)).toBe('CRITICAL');
      expect(determineStockStatus(-100, 20)).toBe('CRITICAL');
    });
  });

  // ----------------------------------------------------------
  // calculateWasteCost
  // ----------------------------------------------------------

  describe('calculateWasteCost', () => {

    it('should calculate waste cost correctly', () => {
      const waste: WasteRecord = {
        itemId: 'pollo',
        quantity: 5,
        costPerUnit: 1800 as Centavos, // S/. 18.00 per unit
        reason: 'EXPIRED',
      };

      const cost = calculateWasteCost(waste);

      expect(cost).toBe(9000); // 5 × 1800 = 9000 centavos = S/. 90.00
    });

    it('should handle zero quantity', () => {
      const waste: WasteRecord = {
        itemId: 'pollo',
        quantity: 0,
        costPerUnit: 1800 as Centavos,
        reason: 'DAMAGED',
      };

      expect(calculateWasteCost(waste)).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // generateKardex
  // ----------------------------------------------------------

  describe('generateKardex', () => {

    it('should generate kardex entries with running balance', () => {
      const movements = [
        { date: '2026-04-01', type: 'IN' as MovementType, quantity: 100, reference: 'Recepción' },
        { date: '2026-04-05', type: 'OUT' as MovementType, quantity: 30, reference: 'Venta #101' },
        { date: '2026-04-07', type: 'WASTE' as MovementType, quantity: 5, reference: 'Vencido' },
      ];

      const kardex = generateKardex(0, movements);

      expect(kardex).toHaveLength(3);
      expect(kardex[0].balance).toBe(100);
      expect(kardex[1].balance).toBe(70);
      expect(kardex[2].balance).toBe(65);
    });

    it('should handle empty movements', () => {
      const kardex = generateKardex(50, []);
      expect(kardex).toHaveLength(0);
    });

    it('should handle ADJUST movements', () => {
      const movements = [
        { date: '2026-04-01', type: 'IN' as MovementType, quantity: 100 },
        { date: '2026-04-05', type: 'ADJUST' as MovementType, quantity: -20, reference: 'Ajuste inventario' },
      ];

      const kardex = generateKardex(0, movements);

      expect(kardex[0].balance).toBe(100);
      expect(kardex[1].balance).toBe(80);
    });
  });

  // ----------------------------------------------------------
  // Escenarios reales
  // ----------------------------------------------------------

  describe('Real business scenarios', () => {

    it('should handle: Recepción de pollos con lotes y vencimientos', () => {
      // Escenario: Llegan 3 lotes de pollos con diferentes fechas de vencimiento
      const lots: InventoryLot[] = [
        { lotNumber: 'P-2026-0409', quantity: 50, expiryDate: '2026-04-15', urgency: 'SOON_3D', daysUntilExpiry: 6 },
        { lotNumber: 'P-2026-0410', quantity: 30, expiryDate: '2026-04-12', urgency: 'SOON_3D', daysUntilExpiry: 3 },
        { lotNumber: 'P-2026-0411', quantity: 20, expiryDate: '2026-04-18', urgency: 'SOON_7D', daysUntilExpiry: 9 },
      ];

      // Ordenar por FEFO
      const sorted = sortLotsFEFO(lots);
      
      expect(sorted[0].lotNumber).toBe('P-2026-0410'); // Vence primero
      expect(sorted[1].lotNumber).toBe('P-2026-0409');
      expect(sorted[2].lotNumber).toBe('P-2026-0411'); // Vence último

      // Deducir 60 pollos (debería tomar de los lotes en orden FEFO)
      const selected = selectLotsForDeduction(sorted, 60);
      
      expect(selected[0].quantity).toBe(30); // Todo el lote P-2026-0410
      expect(selected[1].quantity).toBe(30); // 30 del lote P-2026-0409
    });

    it('should handle: Alerta de stock bajo', () => {
      // Escenario: Stock cae por debajo del mínimo
      const movements = [
        { type: 'IN' as MovementType, quantity: 100 },
        { type: 'OUT' as MovementType, quantity: 40 },
        { type: 'OUT' as MovementType, quantity: 35 },
        { type: 'WASTE' as MovementType, quantity: 20 },
      ];

      const currentStock = calculateStock(movements);
      const minStock = 10;
      const status = determineStockStatus(currentStock, minStock);

      expect(currentStock).toBe(5);
      expect(status).toBe('LOW'); // 5 < 10
    });

    it('should handle: Kardex completo de un producto', () => {
      // Escenario: Historial completo de papas fritas
      const movements = [
        { date: '2026-04-01', type: 'IN', quantity: 200, reference: 'Recepción inicial' },
        { date: '2026-04-02', type: 'OUT', quantity: 50, reference: 'Ventas día 1' },
        { date: '2026-04-03', type: 'OUT', quantity: 45, reference: 'Ventas día 2' },
        { date: '2026-04-04', type: 'WASTE', quantity: 10, reference: 'Papas vencidas' },
        { date: '2026-04-05', type: 'IN', quantity: 150, reference: 'Reposición' },
        { date: '2026-04-06', type: 'OUT', quantity: 60, reference: 'Ventas día 3' },
      ];

      const kardex = generateKardex(0, movements);
      const finalStock = kardex[kardex.length - 1].balance;

      expect(finalStock).toBe(185); // 200-50-45-10+150-60
      expect(kardex).toHaveLength(6);
    });

    it('should handle: Costo de desperdicio significativo', () => {
      // Escenario: 10 pollos vencidos a S/. 18.00 c/u
      const waste: WasteRecord = {
        itemId: 'pollo-entero',
        quantity: 10,
        costPerUnit: 1800 as Centavos,
        reason: 'EXPIRED',
        lotNumber: 'P-2026-0401',
      };

      const cost = calculateWasteCost(waste);

      expect(cost).toBe(18000); // S/. 180.00
      expect(cost / 100).toBe(180); // En soles
    });
  });
});
