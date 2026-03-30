/**
 * Admin Reports Profitability Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - calcMarginPercent: profit / revenue * 100
 * - calcTotalRevenue: sum of totalRevenueCents
 * - calcTotalProfit: sum of totalProfitCents
 * - calcAverageMargin: avg of marginPercent
 * - CSV headers completeness (9 columns)
 * - Profitability URL building
 *
 * @module app/admin/reports/profitability/__tests__/profitability-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

interface ProductMetrics {
  productId:          string;
  productName:        string;
  category:           string;
  priceCents:         number;
  cogsCents:          number;
  profitCents:        number;
  marginPercent:      number;
  unitsSold:          number;
  totalRevenueCents:  number;
  totalProfitCents:   number;
}

const CSV_HEADERS = [
  'Producto', 'Categoría', 'Precio', 'COGS',
  'Ganancia', 'Margen%', 'Unidades', 'Ingresos', 'Ganancia Total',
];

function calcMarginPercent(revenueCents: number, cogsCents: number): number {
  if (revenueCents === 0) return 0;
  const profit = revenueCents - cogsCents;
  return Math.round((profit / revenueCents) * 100 * 100) / 100;
}

function calcTotalRevenue(products: ProductMetrics[]): number {
  return products.reduce((sum, p) => sum + p.totalRevenueCents, 0);
}

function calcTotalProfit(products: ProductMetrics[]): number {
  return products.reduce((sum, p) => sum + p.totalProfitCents, 0);
}

function calcAverageMargin(products: ProductMetrics[]): number {
  if (products.length === 0) return 0;
  const total = products.reduce((sum, p) => sum + p.marginPercent, 0);
  return Math.round((total / products.length) * 100) / 100;
}

function extractUniqueCategories(products: ProductMetrics[]): string[] {
  return Array.from(new Set(products.map(p => p.category))).sort();
}

function buildProfitabilityURL(startDate: string, endDate: string, categoryId?: string): string {
  const params = new URLSearchParams({ startDate, endDate });
  if (categoryId) params.append('categoryIds', categoryId);
  return `/api/admin/reports/profitability?${params.toString()}`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminReportsProfitabilityPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — CSV headers
// ============================================================================

describe('AdminReportsProfitabilityPage — CSV headers', () => {
  it('hay exactamente 9 columnas', () => {
    expect(CSV_HEADERS).toHaveLength(9);
  });

  it('incluye columnas esenciales', () => {
    expect(CSV_HEADERS).toContain('Producto');
    expect(CSV_HEADERS).toContain('Categoría');
    expect(CSV_HEADERS).toContain('Margen%');
    expect(CSV_HEADERS).toContain('Ganancia Total');
    expect(CSV_HEADERS).toContain('Unidades');
  });
});

// ============================================================================
// Tests — calcMarginPercent
// ============================================================================

describe('AdminReportsProfitabilityPage — calcMarginPercent', () => {
  it('revenue = 0 → 0% (sin división por cero)', () => {
    expect(calcMarginPercent(0, 0)).toBe(0);
  });

  it('revenue = 10000, cogs = 4000 → 60%', () => {
    expect(calcMarginPercent(10000, 4000)).toBe(60);
  });

  it('revenue = cogs → 0% (sin ganancia)', () => {
    expect(calcMarginPercent(10000, 10000)).toBe(0);
  });

  it('cogs = 0 → 100% (margen total)', () => {
    expect(calcMarginPercent(10000, 0)).toBe(100);
  });

  it('property: margen entre -∞ y 100 para COGS válidos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 0, max: 1000000 }),
        (revenue, cogs) => {
          const margin = calcMarginPercent(revenue, Math.min(cogs, revenue));
          expect(margin).toBeGreaterThanOrEqual(0);
          expect(margin).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — calcTotalRevenue / calcTotalProfit
// ============================================================================

describe('AdminReportsProfitabilityPage — Totales', () => {
  const products: ProductMetrics[] = [
    { productId: '1', productName: 'Pollo', category: 'POLLOS', priceCents: 2500, cogsCents: 1000, profitCents: 1500, marginPercent: 60, unitsSold: 100, totalRevenueCents: 250000, totalProfitCents: 150000 },
    { productId: '2', productName: 'Papas', category: 'GUARNICIONES', priceCents: 800, cogsCents: 200, profitCents: 600, marginPercent: 75, unitsSold: 50, totalRevenueCents: 40000, totalProfitCents: 30000 },
  ];

  it('totalRevenue = suma de totalRevenueCents', () => {
    expect(calcTotalRevenue(products)).toBe(290000);
  });

  it('totalProfit = suma de totalProfitCents', () => {
    expect(calcTotalProfit(products)).toBe(180000);
  });

  it('sin productos → totales = 0', () => {
    expect(calcTotalRevenue([])).toBe(0);
    expect(calcTotalProfit([])).toBe(0);
  });

  it('avgMargin = promedio de marginPercent', () => {
    // (60 + 75) / 2 = 67.5
    expect(calcAverageMargin(products)).toBe(67.5);
  });

  it('sin productos → avgMargin = 0', () => {
    expect(calcAverageMargin([])).toBe(0);
  });

  it('property: totalProfit <= totalRevenue cuando profit <= revenue para cada producto', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 10 }),
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 1, maxLength: 10 }),
        (revenues, profits) => {
          const n = Math.min(revenues.length, profits.length);
          const prods = revenues.slice(0, n).map((rev, i) => ({
            productId: String(i), productName: 'P', category: 'C',
            priceCents: 1000, cogsCents: 500, profitCents: Math.min(profits[i], rev),
            marginPercent: 0, unitsSold: 1,
            totalRevenueCents: rev, totalProfitCents: Math.min(profits[i], rev)
          }));
          expect(calcTotalProfit(prods)).toBeLessThanOrEqual(calcTotalRevenue(prods));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — extractUniqueCategories
// ============================================================================

describe('AdminReportsProfitabilityPage — Categorías únicas', () => {
  it('extrae categorías únicas ordenadas', () => {
    const products: ProductMetrics[] = [
      { productId: '1', productName: 'P1', category: 'POLLOS',      priceCents: 0, cogsCents: 0, profitCents: 0, marginPercent: 0, unitsSold: 0, totalRevenueCents: 0, totalProfitCents: 0 },
      { productId: '2', productName: 'P2', category: 'BEBIDAS',     priceCents: 0, cogsCents: 0, profitCents: 0, marginPercent: 0, unitsSold: 0, totalRevenueCents: 0, totalProfitCents: 0 },
      { productId: '3', productName: 'P3', category: 'POLLOS',      priceCents: 0, cogsCents: 0, profitCents: 0, marginPercent: 0, unitsSold: 0, totalRevenueCents: 0, totalProfitCents: 0 },
      { productId: '4', productName: 'P4', category: 'GUARNICIONES',priceCents: 0, cogsCents: 0, profitCents: 0, marginPercent: 0, unitsSold: 0, totalRevenueCents: 0, totalProfitCents: 0 },
    ];
    const cats = extractUniqueCategories(products);
    expect(cats).toHaveLength(3);
    expect(cats).toEqual(['BEBIDAS', 'GUARNICIONES', 'POLLOS']); // sorted
  });

  it('sin duplicados en el resultado', () => {
    const products: ProductMetrics[] = Array.from({ length: 5 }, (_, i) => ({
      productId: String(i), productName: 'P', category: 'POLLOS',
      priceCents: 0, cogsCents: 0, profitCents: 0, marginPercent: 0,
      unitsSold: 0, totalRevenueCents: 0, totalProfitCents: 0,
    }));
    expect(extractUniqueCategories(products)).toHaveLength(1);
  });
});

// ============================================================================
// Tests — URL
// ============================================================================

describe('AdminReportsProfitabilityPage — URL', () => {
  it('incluye startDate y endDate', () => {
    const url = buildProfitabilityURL('2026-01-01', '2026-01-31');
    expect(url).toContain('startDate=2026-01-01');
    expect(url).toContain('endDate=2026-01-31');
  });

  it('con categoría → incluye categoryIds', () => {
    const url = buildProfitabilityURL('2026-01-01', '2026-01-31', 'cat-123');
    expect(url).toContain('categoryIds=cat-123');
  });
});
