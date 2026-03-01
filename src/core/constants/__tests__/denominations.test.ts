/**
 * PEN Denominations Tests
 *
 * @module core/constants/__tests__/denominations.test
 */

import { describe, it, expect } from 'vitest';
import {
  PEN_DENOMINATIONS,
  DENOMINATION_MAP,
  calculateDenominationTotal,
} from '../denominations';

describe('PEN_DENOMINATIONS', () => {
  it('debe tener 11 denominaciones (5 billetes + 6 monedas)', () => {
    expect(PEN_DENOMINATIONS).toHaveLength(11);

    const bills = PEN_DENOMINATIONS.filter(d => d.type === 'bill');
    const coins = PEN_DENOMINATIONS.filter(d => d.type === 'coin');

    expect(bills).toHaveLength(5);
    expect(coins).toHaveLength(6);
  });

  it('debe estar ordenado de mayor a menor', () => {
    for (let i = 0; i < PEN_DENOMINATIONS.length - 1; i++) {
      expect(PEN_DENOMINATIONS[i].faceCents).toBeGreaterThan(
        PEN_DENOMINATIONS[i + 1].faceCents,
      );
    }
  });

  it('debe tener S/200 como billete más alto', () => {
    expect(PEN_DENOMINATIONS[0].faceCents).toBe(20_000);
    expect(PEN_DENOMINATIONS[0].label).toBe('S/ 200');
    expect(PEN_DENOMINATIONS[0].type).toBe('bill');
  });

  it('debe tener S/0.10 como moneda más baja', () => {
    const last = PEN_DENOMINATIONS[PEN_DENOMINATIONS.length - 1];
    expect(last.faceCents).toBe(10);
    expect(last.label).toBe('S/ 0.10');
    expect(last.type).toBe('coin');
  });

  it('todos los faceCents deben ser enteros positivos', () => {
    for (const d of PEN_DENOMINATIONS) {
      expect(Number.isInteger(d.faceCents)).toBe(true);
      expect(d.faceCents).toBeGreaterThan(0);
    }
  });
});

describe('DENOMINATION_MAP', () => {
  it('debe contener todas las denominaciones', () => {
    expect(DENOMINATION_MAP.size).toBe(11);
  });

  it('debe permitir lookup por faceCents', () => {
    const d100 = DENOMINATION_MAP.get(10_000);
    expect(d100).toBeDefined();
    expect(d100!.label).toBe('S/ 100');

    const d050 = DENOMINATION_MAP.get(50);
    expect(d050).toBeDefined();
    expect(d050!.label).toBe('S/ 0.50');
  });

  it('debe retornar undefined para valores inválidos', () => {
    expect(DENOMINATION_MAP.get(999)).toBeUndefined();
    expect(DENOMINATION_MAP.get(0)).toBeUndefined();
  });
});

describe('calculateDenominationTotal', () => {
  it('debe calcular total correctamente', () => {
    const counts = {
      10_000: 3,  // 3x S/100 = 30000
      5_000: 2,   // 2x S/50  = 10000
      100: 5,     // 5x S/1   =   500
    };

    expect(calculateDenominationTotal(counts)).toBe(40_500);
  });

  it('debe retornar 0 para conteo vacío', () => {
    expect(calculateDenominationTotal({})).toBe(0);
  });

  it('debe ignorar cantidades 0', () => {
    const counts = {
      10_000: 0,
      5_000: 1,
    };

    expect(calculateDenominationTotal(counts)).toBe(5_000);
  });

  it('debe calcular caso completo con todas las denominaciones', () => {
    const counts: Record<number, number> = {};
    // 1 de cada denominación
    for (const d of PEN_DENOMINATIONS) {
      counts[d.faceCents] = 1;
    }

    const expectedTotal = PEN_DENOMINATIONS.reduce(
      (sum, d) => sum + d.faceCents,
      0,
    );

    expect(calculateDenominationTotal(counts)).toBe(expectedTotal);
  });
});
