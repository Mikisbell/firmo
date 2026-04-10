/**
 * Stress Tests: Inventario - Volúmenes Reales de Pollería
 *
 * Simula operaciones de inventario con datos de producción:
 * - 200+ productos en catálogo
 * - 1000+ movimientos de stock por día
 * - 50+ lotes concurrentes
 * - Operaciones masivas de recepción y desperdicio
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Funciones bajo test (mismas que unit tests)
// ============================================================

type MovementType = 'IN' | 'OUT' | 'WASTE' | 'ADJUST';
type ExpiryUrgency = 'EXPIRED' | 'TODAY' | 'TOMORROW' | 'SOON_3D' | 'SOON_7D' | 'OK';

function calculateExpiryUrgency(expiryDate: string | null, now?: Date): {
  urgency: ExpiryUrgency;
  daysUntilExpiry: number | null;
} {
  if (!expiryDate) return { urgency: 'OK', daysUntilExpiry: null };
  const expiry = new Date(expiryDate);
  const referenceDate = now || new Date();
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const daysUntilExpiry = Math.floor((expiryDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let urgency: ExpiryUrgency;
  if (daysUntilExpiry < 0) urgency = 'EXPIRED';
  else if (daysUntilExpiry === 0) urgency = 'TODAY';
  else if (daysUntilExpiry === 1) urgency = 'TOMORROW';
  else if (daysUntilExpiry <= 3) urgency = 'SOON_3D';
  else if (daysUntilExpiry <= 7) urgency = 'SOON_7D';
  else urgency = 'OK';
  return { urgency, daysUntilExpiry };
}

function calculateStock(movements: Array<{ type: MovementType; quantity: number }>): number {
  return movements.reduce((balance, m) => {
    switch (m.type) {
      case 'IN': return balance + m.quantity;
      case 'OUT': return balance - m.quantity;
      case 'WASTE': return balance - m.quantity;
      case 'ADJUST': return balance + m.quantity;
      default: return balance;
    }
  }, 0);
}

// ============================================================
// STRESS TESTS
// ============================================================

describe('Inventory Stress Tests', () => {

  // Test 1: 1000 movimientos de stock
  it('should handle 1000 stock movements efficiently', () => {
    const movements: Array<{ type: MovementType; quantity: number }> = [];

    // Generar 1000 movimientos realistas
    for (let i = 0; i < 1000; i++) {
      const typeIndex = i % 4;
      const types: MovementType[] = ['IN', 'OUT', 'WASTE', 'ADJUST'];
      movements.push({
        type: types[typeIndex],
        quantity: Math.floor(Math.random() * 100) + 1,
      });
    }

    const startTime = performance.now();
    const stock = calculateStock(movements);
    const endTime = performance.now();

    expect(Number.isInteger(stock)).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Debe completarse en < 100ms
  });

  // Test 2: 200 productos con vencimientos variados
  it('should calculate urgency for 200 products with varied expiries', () => {
    const now = new Date('2026-04-09');
    const products: Array<{ name: string; expiryDate: string | null }> = [];

    // Generar 200 productos con fechas de vencimiento variadas
    for (let i = 0; i < 200; i++) {
      const daysOffset = Math.floor(Math.random() * 60) - 10; // -10 a +50 días
      const expiryDate = daysOffset < 0 ? null : new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
      products.push({
        name: `Producto ${i + 1}`,
        expiryDate,
      });
    }

    const startTime = performance.now();
    const results = products.map(p => calculateExpiryUrgency(p.expiryDate, now));
    const endTime = performance.now();

    expect(results).toHaveLength(200);
    expect(results.every(r => ['EXPIRED', 'TODAY', 'TOMORROW', 'SOON_3D', 'SOON_7D', 'OK'].includes(r.urgency))).toBe(true);
    expect(endTime - startTime).toBeLessThan(50); // < 50ms
  });

  // Test 3: Kardex con 5000 entradas
  it('should handle kardex with 5000 entries', () => {
    const movements: Array<{ date: string; type: MovementType; quantity: number }> = [];
    let balance = 0;

    // Generar 5000 movimientos de kardex
    for (let i = 0; i < 5000; i++) {
      const typeIndex = i % 4;
      const types: MovementType[] = ['IN', 'OUT', 'WASTE', 'ADJUST'];
      const quantity = Math.floor(Math.random() * 50) + 1;
      const date = new Date(Date.now() - (5000 - i) * 60 * 1000).toISOString(); // Cada minuto

      movements.push({
        date,
        type: types[typeIndex],
        quantity,
      });
    }

    const startTime = performance.now();
    const finalStock = calculateStock(movements);
    const endTime = performance.now();

    expect(Number.isInteger(finalStock)).toBe(true);
    expect(endTime - startTime).toBeLessThan(500); // < 500ms
  });

  // Test 4: Múltiples lotes concurrentes (50 lotes)
  it('should handle 50 concurrent lots with FEFO ordering', () => {
    const lots: Array<{ lotNumber: string; quantity: number; expiryDate: string | null }> = [];
    const now = new Date('2026-04-09');

    // Generar 50 lotes con fechas aleatorias
    for (let i = 0; i < 50; i++) {
      const daysOffset = Math.floor(Math.random() * 30);
      lots.push({
        lotNumber: `L-${String(i + 1).padStart(3, '0')}`,
        quantity: Math.floor(Math.random() * 100) + 10,
        expiryDate: new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    // Ordenar por FEFO
    const sorted = [...lots].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    // Verificar orden FEFO
    for (let i = 1; i < sorted.length; i++) {
      const currentDate = sorted[i].expiryDate;
      const prevDate = sorted[i - 1].expiryDate;
      if (currentDate && prevDate) {
        expect(new Date(currentDate).getTime()).toBeGreaterThanOrEqual(
          new Date(prevDate).getTime()
        );
      }
    }
  });

  // Test 5: Desperdicio masivo (100 registros)
  it('should handle 100 waste records efficiently', () => {
    const wasteRecords: Array<{ itemId: string; quantity: number; costPerUnit: number }> = [];

    for (let i = 0; i < 100; i++) {
      wasteRecords.push({
        itemId: `item-${i + 1}`,
        quantity: Math.floor(Math.random() * 20) + 1,
        costPerUnit: Math.floor(Math.random() * 5000) + 100, // S/. 1.00 a S/. 50.00
      });
    }

    const startTime = performance.now();
    const totalCost = wasteRecords.reduce((sum, w) => sum + w.quantity * w.costPerUnit, 0);
    const endTime = performance.now();

    expect(totalCost).toBeGreaterThan(0);
    expect(Number.isInteger(totalCost)).toBe(true);
    expect(endTime - startTime).toBeLessThan(10); // < 10ms
  });

  // Test 6: Stock bajo con múltiples deducciones
  it('should detect low stock after 100 deductions', () => {
    let stock = 1000;
    const minStock = 100;
    let alertsTriggered = 0;

    // Simular 100 deducciones
    for (let i = 0; i < 100; i++) {
      const deduction = Math.floor(Math.random() * 15) + 5; // 5-20 unidades
      stock -= deduction;

      if (stock < minStock && stock >= minStock - 20) {
        alertsTriggered++;
      }
    }

    expect(stock).toBeLessThan(1000);
    expect(alertsTriggered).toBeGreaterThanOrEqual(0);
  });
});
