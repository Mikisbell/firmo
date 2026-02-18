/**
 * Profitability Property-Based Tests
 * 
 * Tests basados en propiedades para validar corrección matemática de cálculos.
 * Usa fast-check para generar miles de casos de prueba aleatorios.
 * 
 * Propiedades validadas:
 * 1. Fórmula fundamental de ganancia: profit = price - cogs
 * 2. Fórmula fundamental de margen: margin = (profit / price) × 100
 * 3. Margen cero cuando precio es cero
 * 4. COGS nunca es negativo
 * 5. Precio aumenta → ganancia aumenta (COGS constante)
 * 6. Branded types mantienen invariantes
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { asCentavos } from '@/src/core/types/shared';
import { toCOGS, toProfit, toMargin } from '@/src/core/types/profitability';
import {
  calculateProfit,
  calculateMargin,
  calculateProfitAndMargin,
  sumCOGS,
  sumProfit,
  calculateAverageMargin,
} from '@/src/core/domain/profitability';

// ============================================================================
// Arbitraries - Generadores de Datos Aleatorios
// ============================================================================

/**
 * Genera valores válidos de Centavos (0 a 1,000,000)
 */
const centavosArb = fc.integer({ min: 0, max: 1_000_000 }).map(asCentavos);

/**
 * Genera valores válidos de COGS (0 a 1,000,000)
 */
const cogsArb = fc.integer({ min: 0, max: 1_000_000 }).map(toCOGS);

/**
 * Genera valores válidos de Profit (-1,000,000 a 1,000,000)
 * Limitado para evitar casos extremos donde profit >> price
 */
const profitArb = fc.integer({ min: -100_000, max: 100_000 }).map(toProfit);

/**
 * Genera valores válidos de Margin (-100 a 100)
 */
const marginArb = fc.double({ min: -100, max: 100, noNaN: true }).map(toMargin);

/**
 * Genera pares de (price, cogs) donde price >= cogs (ganancia positiva)
 */
const profitablePairArb = fc
  .tuple(
    fc.integer({ min: 1000, max: 1_000_000 }),
    fc.integer({ min: 0, max: 999 })
  )
  .map(([price, cogsDelta]) => ({
    price: asCentavos(price),
    cogs: toCOGS(price - cogsDelta),
  }));

/**
 * Genera arrays de COGS
 */
const cogsArrayArb = fc.array(cogsArb, { minLength: 1, maxLength: 100 });

/**
 * Genera arrays de Profit
 */
const profitArrayArb = fc.array(profitArb, { minLength: 1, maxLength: 100 });

/**
 * Genera items para cálculo de margen promedio
 */
const marginItemsArb = fc.array(
  fc.record({
    profit: profitArb,
    price: centavosArb,
  }),
  { minLength: 1, maxLength: 50 }
);

// ============================================================================
// Property Tests - Propiedades Matemáticas
// ============================================================================

describe('Property 1: Fórmula Fundamental de Ganancia', () => {
  it('ganancia = precio - cogs (siempre)', () => {
    fc.assert(
      fc.property(centavosArb, cogsArb, (price, cogs) => {
        const profit = calculateProfit(price, cogs);
        return profit === price - cogs;
      }),
      { numRuns: 1000 }
    );
  });

  it('ganancia + cogs = precio (propiedad inversa)', () => {
    fc.assert(
      fc.property(centavosArb, cogsArb, (price, cogs) => {
        const profit = calculateProfit(price, cogs);
        return profit + cogs === price;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 2: Fórmula Fundamental de Margen', () => {
  it('margen = (ganancia / precio) × 100 (cuando precio > 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }).map(asCentavos),
        profitArb,
        (price, profit) => {
          const margin = calculateMargin(profit, price);
          const expected = (profit / price) * 100;
          
          // Si el margen esperado está fuera de rango, debe ser clampeado
          if (expected > 100) {
            return margin === 100;
          } else if (expected < -100) {
            return margin === -100;
          }
          
          // Comparar con tolerancia de 0.01 por redondeo
          return Math.abs(margin - expected) < 0.01;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('margen × precio = ganancia × 100 (propiedad algebraica)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }).map(asCentavos),
        profitArb,
        (price, profit) => {
          const margin = calculateMargin(profit, price);
          const lhs = margin * price;
          const rhs = profit * 100;
          
          // Si el margen fue clampeado, la propiedad no se cumple exactamente
          const expected = (profit / price) * 100;
          if (expected > 100 || expected < -100) {
            // Margen clampeado, la propiedad algebraica no se cumple
            return true;
          }
          
          // Comparar con tolerancia mayor por redondeo (0.5% del precio)
          const tolerance = Math.max(1, price * 0.005);
          return Math.abs(lhs - rhs) < tolerance;
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('Property 3: Margen Cero Cuando Precio es Cero', () => {
  it('precio = 0 → margen = 0 (siempre)', () => {
    fc.assert(
      fc.property(profitArb, (profit) => {
        const price = asCentavos(0);
        const margin = calculateMargin(profit, price);
        return margin === 0;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 4: COGS Nunca es Negativo', () => {
  it('COGS >= 0 (siempre)', () => {
    fc.assert(
      fc.property(cogsArb, (cogs) => {
        return cogs >= 0;
      }),
      { numRuns: 1000 }
    );
  });

  it('suma de COGS >= 0 (siempre)', () => {
    fc.assert(
      fc.property(cogsArrayArb, (cogsArray) => {
        const total = sumCOGS(cogsArray);
        return total >= 0;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 5: Precio Aumenta → Ganancia Aumenta', () => {
  it('si precio aumenta y COGS constante → ganancia aumenta', () => {
    fc.assert(
      fc.property(
        centavosArb,
        cogsArb,
        fc.integer({ min: 1, max: 10000 }),
        (price, cogs, delta) => {
          const profit1 = calculateProfit(price, cogs);
          const newPrice = asCentavos(price + delta);
          const profit2 = calculateProfit(newPrice, cogs);
          
          return profit2 > profit1;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('si precio aumenta y COGS constante → margen aumenta (cuando profit > 0)', () => {
    fc.assert(
      fc.property(profitablePairArb, fc.integer({ min: 1, max: 10000 }), ({ price, cogs }, delta) => {
        const profit1 = calculateProfit(price, cogs);
        const margin1 = calculateMargin(profit1, price);
        
        const newPrice = asCentavos(price + delta);
        const profit2 = calculateProfit(newPrice, cogs);
        const margin2 = calculateMargin(profit2, newPrice);
        
        // Margen aumenta cuando ganancia es positiva
        // EXCEPTO cuando el margen ya está en el límite superior (100%)
        return profit1 > 0 ? (margin2 >= margin1 || margin1 === 100) : true;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 6: Branded Types Mantienen Invariantes', () => {
  it('COGS siempre es integer', () => {
    fc.assert(
      fc.property(cogsArb, (cogs) => {
        return Number.isInteger(cogs);
      }),
      { numRuns: 1000 }
    );
  });

  it('Profit siempre es integer', () => {
    fc.assert(
      fc.property(profitArb, (profit) => {
        return Number.isInteger(profit);
      }),
      { numRuns: 1000 }
    );
  });

  it('Margin siempre está en rango [-100, 100]', () => {
    fc.assert(
      fc.property(marginArb, (margin) => {
        return margin >= -100 && margin <= 100;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 7: Agregaciones Preservan Invariantes', () => {
  it('suma de COGS es COGS válido', () => {
    fc.assert(
      fc.property(cogsArrayArb, (cogsArray) => {
        const total = sumCOGS(cogsArray);
        return Number.isInteger(total) && total >= 0;
      }),
      { numRuns: 1000 }
    );
  });

  it('suma de Profit es Profit válido', () => {
    fc.assert(
      fc.property(profitArrayArb, (profitArray) => {
        const total = sumProfit(profitArray);
        return Number.isInteger(total);
      }),
      { numRuns: 1000 }
    );
  });

  it('margen promedio está en rango [-100, 100]', () => {
    fc.assert(
      fc.property(marginItemsArb, (items) => {
        const avgMargin = calculateAverageMargin(items);
        return avgMargin >= -100 && avgMargin <= 100;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 8: Propiedades Metamórficas', () => {
  it('duplicar precio y COGS → ganancia se duplica', () => {
    fc.assert(
      fc.property(centavosArb, cogsArb, (price, cogs) => {
        const profit1 = calculateProfit(price, cogs);
        
        const doublePrice = asCentavos(price * 2);
        const doubleCogs = toCOGS(cogs * 2);
        const profit2 = calculateProfit(doublePrice, doubleCogs);
        
        return profit2 === profit1 * 2;
      }),
      { numRuns: 1000 }
    );
  });

  it('duplicar precio y COGS → margen se mantiene', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }).map(asCentavos),
        fc.integer({ min: 0, max: 500_000 }).map(toCOGS),
        (price, cogs) => {
          const { margin: margin1 } = calculateProfitAndMargin(price, cogs);
          
          const doublePrice = asCentavos(price * 2);
          const doubleCogs = toCOGS(cogs * 2);
          const { margin: margin2 } = calculateProfitAndMargin(doublePrice, doubleCogs);
          
          // Comparar con tolerancia por redondeo
          return Math.abs(margin1 - margin2) < 0.01;
        }
      ),
      { numRuns: 1000 }
    );
  });

  it('sumar constante a precio y COGS → margen cambia predeciblemente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 500_000 }).map(asCentavos),
        fc.integer({ min: 0, max: 500_000 }).map(toCOGS),
        fc.integer({ min: 1, max: 1000 }),
        (price, cogs, delta) => {
          // Skip si COGS > price (caso no realista)
          if (cogs > price) return true;
          
          const { margin: margin1 } = calculateProfitAndMargin(price, cogs);
          
          const newPrice = asCentavos(price + delta);
          const newCogs = toCOGS(cogs + delta);
          const { margin: margin2 } = calculateProfitAndMargin(newPrice, newCogs);
          
          // Cuando sumamos la misma constante a ambos, el margen disminuye
          // (porque la ganancia absoluta se mantiene pero el precio aumenta)
          // O se mantiene igual si ya está en el límite
          return margin2 <= margin1 || margin1 === -100 || margin1 === 100;
        }
      ),
      { numRuns: 1000 }
    );
  });
});

describe('Property 9: Idempotencia y Conmutatividad', () => {
  it('calcular ganancia dos veces da el mismo resultado', () => {
    fc.assert(
      fc.property(centavosArb, cogsArb, (price, cogs) => {
        const profit1 = calculateProfit(price, cogs);
        const profit2 = calculateProfit(price, cogs);
        return profit1 === profit2;
      }),
      { numRuns: 1000 }
    );
  });

  it('suma de COGS es conmutativa', () => {
    fc.assert(
      fc.property(cogsArrayArb, (cogsArray) => {
        const sum1 = sumCOGS(cogsArray);
        const sum2 = sumCOGS([...cogsArray].reverse());
        return sum1 === sum2;
      }),
      { numRuns: 1000 }
    );
  });

  it('suma de Profit es conmutativa', () => {
    fc.assert(
      fc.property(profitArrayArb, (profitArray) => {
        const sum1 = sumProfit(profitArray);
        const sum2 = sumProfit([...profitArray].reverse());
        return sum1 === sum2;
      }),
      { numRuns: 1000 }
    );
  });
});

describe('Property 10: Casos Límite', () => {
  it('precio máximo y COGS mínimo → ganancia máxima', () => {
    const maxPrice = asCentavos(1_000_000);
    const minCogs = toCOGS(0);
    const profit = calculateProfit(maxPrice, minCogs);
    
    fc.assert(
      fc.property(centavosArb, cogsArb, (price, cogs) => {
        const otherProfit = calculateProfit(price, cogs);
        return profit >= otherProfit;
      }),
      { numRuns: 1000 }
    );
  });

  it('precio = COGS → ganancia = 0, margen = 0', () => {
    fc.assert(
      fc.property(centavosArb, (value) => {
        const price = value;
        const cogs = toCOGS(value);
        const { profit, margin } = calculateProfitAndMargin(price, cogs);
        
        return profit === 0 && margin === 0;
      }),
      { numRuns: 1000 }
    );
  });
});
