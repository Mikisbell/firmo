/**
 * Profitability Unit Tests
 * 
 * Tests unitarios para funciones de cálculo de rentabilidad.
 * Validan casos específicos y edge cases.
 */

import { describe, it, expect } from 'vitest';
import { asCentavos } from '@/src/core/types/shared';
import {
  toCOGS,
  toProfit,
  toMargin,
  unsafeCOGS,
  unsafeProfit,
  unsafeMargin,
  isCOGS,
  isProfit,
  isMargin,
} from '@/src/core/types/profitability';
import {
  calculateProfit,
  calculateMargin,
  calculateProfitAndMargin,
  formatCents,
  formatMargin,
  formatCOGS,
  formatProfit,
  validatePrice,
  validateCOGS,
  validateMargin,
  validateQuantity,
  sumCOGS,
  sumProfit,
  calculateAverageMargin,
} from '@/src/core/domain/profitability';

describe('Branded Types - Constructores', () => {
  describe('toCOGS', () => {
    it('debe crear COGS válido con valor positivo', () => {
      const cogs = toCOGS(2050);
      expect(cogs).toBe(2050);
    });

    it('debe crear COGS con valor cero', () => {
      const cogs = toCOGS(0);
      expect(cogs).toBe(0);
    });

    it('debe rechazar COGS negativo', () => {
      expect(() => toCOGS(-100)).toThrow('COGS no puede ser negativo');
    });

    it('debe rechazar COGS decimal', () => {
      expect(() => toCOGS(20.5)).toThrow('COGS debe ser integer');
    });
  });

  describe('toProfit', () => {
    it('debe crear Profit positivo', () => {
      const profit = toProfit(1450);
      expect(profit).toBe(1450);
    });

    it('debe crear Profit negativo (pérdida)', () => {
      const profit = toProfit(-500);
      expect(profit).toBe(-500);
    });

    it('debe crear Profit cero', () => {
      const profit = toProfit(0);
      expect(profit).toBe(0);
    });

    it('debe rechazar Profit decimal', () => {
      expect(() => toProfit(14.5)).toThrow('Profit debe ser integer');
    });
  });

  describe('toMargin', () => {
    it('debe crear Margin positivo', () => {
      const margin = toMargin(41.43);
      expect(margin).toBe(41.43);
    });

    it('debe crear Margin negativo', () => {
      const margin = toMargin(-20);
      expect(margin).toBe(-20);
    });

    it('debe crear Margin cero', () => {
      const margin = toMargin(0);
      expect(margin).toBe(0);
    });

    it('debe aceptar Margin en límite superior (100)', () => {
      const margin = toMargin(100);
      expect(margin).toBe(100);
    });

    it('debe aceptar Margin en límite inferior (-100)', () => {
      const margin = toMargin(-100);
      expect(margin).toBe(-100);
    });

    it('debe rechazar Margin > 100', () => {
      expect(() => toMargin(150)).toThrow('Margin debe estar en rango [-100, 100]');
    });

    it('debe rechazar Margin < -100', () => {
      expect(() => toMargin(-150)).toThrow('Margin debe estar en rango [-100, 100]');
    });
  });

  describe('Constructores unsafe', () => {
    it('unsafeCOGS debe crear COGS sin validación', () => {
      const cogs = unsafeCOGS(2050);
      expect(cogs).toBe(2050);
    });

    it('unsafeProfit debe crear Profit sin validación', () => {
      const profit = unsafeProfit(1450);
      expect(profit).toBe(1450);
    });

    it('unsafeMargin debe crear Margin sin validación', () => {
      const margin = unsafeMargin(41.43);
      expect(margin).toBe(41.43);
    });
  });
});

describe('Type Guards', () => {
  describe('isCOGS', () => {
    it('debe retornar true para COGS válido', () => {
      expect(isCOGS(2050)).toBe(true);
      expect(isCOGS(0)).toBe(true);
    });

    it('debe retornar false para valores inválidos', () => {
      expect(isCOGS(-100)).toBe(false);
      expect(isCOGS(20.5)).toBe(false);
      expect(isCOGS('2050')).toBe(false);
      expect(isCOGS(null)).toBe(false);
    });
  });

  describe('isProfit', () => {
    it('debe retornar true para Profit válido', () => {
      expect(isProfit(1450)).toBe(true);
      expect(isProfit(-500)).toBe(true);
      expect(isProfit(0)).toBe(true);
    });

    it('debe retornar false para valores inválidos', () => {
      expect(isProfit(14.5)).toBe(false);
      expect(isProfit('1450')).toBe(false);
      expect(isProfit(null)).toBe(false);
    });
  });

  describe('isMargin', () => {
    it('debe retornar true para Margin válido', () => {
      expect(isMargin(41.43)).toBe(true);
      expect(isMargin(-20)).toBe(true);
      expect(isMargin(0)).toBe(true);
      expect(isMargin(100)).toBe(true);
      expect(isMargin(-100)).toBe(true);
    });

    it('debe retornar false para valores inválidos', () => {
      expect(isMargin(150)).toBe(false);
      expect(isMargin(-150)).toBe(false);
      expect(isMargin('41.43')).toBe(false);
      expect(isMargin(null)).toBe(false);
    });
  });
});

describe('Funciones de Cálculo', () => {
  describe('calculateProfit', () => {
    it('debe calcular ganancia correctamente', () => {
      const price = asCentavos(3500);  // S/35.00
      const cogs = toCOGS(2050);       // S/20.50
      const profit = calculateProfit(price, cogs);
      
      expect(profit).toBe(1450);  // S/14.50
    });

    it('debe calcular pérdida cuando COGS > precio', () => {
      const price = asCentavos(2000);
      const cogs = toCOGS(2500);
      const profit = calculateProfit(price, cogs);
      
      expect(profit).toBe(-500);  // Pérdida de S/5.00
    });

    it('debe retornar cero cuando precio = COGS', () => {
      const price = asCentavos(2000);
      const cogs = toCOGS(2000);
      const profit = calculateProfit(price, cogs);
      
      expect(profit).toBe(0);
    });
  });

  describe('calculateMargin', () => {
    it('debe calcular margen correctamente', () => {
      const profit = toProfit(1450);
      const price = asCentavos(3500);
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBeCloseTo(41.43, 2);
    });

    it('debe calcular margen negativo para pérdidas', () => {
      const profit = toProfit(-500);
      const price = asCentavos(2000);
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBe(-25);
    });

    it('debe retornar cero cuando precio es cero', () => {
      const profit = toProfit(1000);
      const price = asCentavos(0);
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBe(0);
    });

    it('debe retornar cero cuando ganancia es cero', () => {
      const profit = toProfit(0);
      const price = asCentavos(2000);
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBe(0);
    });

    it('debe redondear a 2 decimales', () => {
      const profit = toProfit(333);
      const price = asCentavos(1000);
      const margin = calculateMargin(profit, price);
      
      expect(margin).toBe(33.3);  // 33.30 redondeado
    });
  });

  describe('calculateProfitAndMargin', () => {
    it('debe calcular ganancia y margen juntos', () => {
      const price = asCentavos(3500);
      const cogs = toCOGS(2050);
      const result = calculateProfitAndMargin(price, cogs);
      
      expect(result.profit).toBe(1450);
      expect(result.margin).toBeCloseTo(41.43, 2);
    });
  });
});

describe('Helpers de Formateo', () => {
  describe('formatCents', () => {
    it('debe formatear centavos positivos', () => {
      expect(formatCents(3500)).toBe('S/ 35.00');
    });

    it('debe formatear centavos negativos', () => {
      expect(formatCents(-500)).toBe('S/ -5.00');
    });

    it('debe formatear cero', () => {
      expect(formatCents(0)).toBe('S/ 0.00');
    });
  });

  describe('formatMargin', () => {
    it('debe formatear margen positivo', () => {
      const margin = toMargin(41.43);
      expect(formatMargin(margin)).toBe('41.43%');
    });

    it('debe formatear margen negativo', () => {
      const margin = toMargin(-20);
      expect(formatMargin(margin)).toBe('-20.00%');
    });

    it('debe formatear cero', () => {
      const margin = toMargin(0);
      expect(formatMargin(margin)).toBe('0.00%');
    });
  });

  describe('formatCOGS', () => {
    it('debe formatear COGS', () => {
      const cogs = toCOGS(2050);
      expect(formatCOGS(cogs)).toBe('S/ 20.50');
    });
  });

  describe('formatProfit', () => {
    it('debe formatear Profit', () => {
      const profit = toProfit(1450);
      expect(formatProfit(profit)).toBe('S/ 14.50');
    });
  });
});

describe('Validadores', () => {
  describe('validatePrice', () => {
    it('debe validar precio válido', () => {
      const price = asCentavos(3500);
      expect(validatePrice(price)).toBe(true);
    });

    it('debe rechazar precio negativo', () => {
      const price = -100 as any;
      expect(() => validatePrice(price)).toThrow('Precio no puede ser negativo');
    });
  });

  describe('validateCOGS', () => {
    it('debe validar COGS válido', () => {
      const cogs = toCOGS(2050);
      expect(validateCOGS(cogs)).toBe(true);
    });

    it('debe rechazar COGS negativo', () => {
      const cogs = -100 as any;
      expect(() => validateCOGS(cogs)).toThrow('COGS no puede ser negativo');
    });
  });

  describe('validateMargin', () => {
    it('debe validar margen válido', () => {
      const margin = toMargin(41.43);
      expect(validateMargin(margin)).toBe(true);
    });

    it('debe rechazar margen fuera de rango', () => {
      const margin = 150 as any;
      expect(() => validateMargin(margin)).toThrow('Margin debe estar en rango [-100, 100]');
    });
  });

  describe('validateQuantity', () => {
    it('debe validar cantidad válida', () => {
      expect(validateQuantity(5)).toBe(true);
      expect(validateQuantity(1.5)).toBe(true);
    });

    it('debe rechazar cantidad cero', () => {
      expect(() => validateQuantity(0)).toThrow('Cantidad debe ser mayor a cero');
    });

    it('debe rechazar cantidad negativa', () => {
      expect(() => validateQuantity(-5)).toThrow('Cantidad debe ser mayor a cero');
    });

    it('debe rechazar cantidad no numérica', () => {
      expect(() => validateQuantity('5' as any)).toThrow('Cantidad debe ser un número');
    });
  });
});

describe('Helpers de Agregación', () => {
  describe('sumCOGS', () => {
    it('debe sumar múltiples COGS', () => {
      const cogs1 = toCOGS(1000);
      const cogs2 = toCOGS(500);
      const cogs3 = toCOGS(250);
      const total = sumCOGS([cogs1, cogs2, cogs3]);
      
      expect(total).toBe(1750);
    });

    it('debe retornar cero para array vacío', () => {
      const total = sumCOGS([]);
      expect(total).toBe(0);
    });
  });

  describe('sumProfit', () => {
    it('debe sumar múltiples Profit', () => {
      const profit1 = toProfit(1450);
      const profit2 = toProfit(-500);
      const profit3 = toProfit(750);
      const total = sumProfit([profit1, profit2, profit3]);
      
      expect(total).toBe(1700);
    });

    it('debe retornar cero para array vacío', () => {
      const total = sumProfit([]);
      expect(total).toBe(0);
    });
  });

  describe('calculateAverageMargin', () => {
    it('debe calcular margen promedio ponderado', () => {
      const items = [
        { profit: toProfit(1450), price: asCentavos(3500) },  // 41.43%
        { profit: toProfit(500), price: asCentavos(2000) }    // 25%
      ];
      const avgMargin = calculateAverageMargin(items);
      
      // Promedio ponderado: (1450 + 500) / (3500 + 2000) = 1950 / 5500 = 35.45%
      expect(avgMargin).toBeCloseTo(35.45, 2);
    });

    it('debe retornar cero para array vacío', () => {
      const avgMargin = calculateAverageMargin([]);
      expect(avgMargin).toBe(0);
    });

    it('debe manejar pérdidas en el promedio', () => {
      const items = [
        { profit: toProfit(1000), price: asCentavos(2000) },   // 50%
        { profit: toProfit(-500), price: asCentavos(2000) }    // -25%
      ];
      const avgMargin = calculateAverageMargin(items);
      
      // Promedio: (1000 - 500) / (2000 + 2000) = 500 / 4000 = 12.5%
      expect(avgMargin).toBe(12.5);
    });
  });
});
