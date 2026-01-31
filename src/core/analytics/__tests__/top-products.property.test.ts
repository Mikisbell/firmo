/**
 * Property Test: Top Products Ranking
 * 
 * Property 4: For any set of order items in a shift, getTopProducts(limit=N) SHALL return 
 * exactly N products (or all if fewer exist) sorted by qty_sold descending, 
 * with ties broken by revenue_cents descending.
 * 
 * Validates: Requirements 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface OrderItem {
  product_id: string;
  sku: string;
  name: string;
  qty: number;
  unit_price_cents: number;
}

interface TopProduct {
  product_id: string;
  sku: string;
  name: string;
  qty_sold: number;
  revenue_cents: number;
}

// Pure calculation function (extracted from service logic)
function calculateTopProducts(items: OrderItem[], limit: number): TopProduct[] {
  const productMap = new Map<string, {
    sku: string;
    name: string;
    qty: number;
    revenue: number;
  }>();

  for (const item of items) {
    const existing = productMap.get(item.product_id);
    if (existing) {
      existing.qty += item.qty;
      existing.revenue += item.qty * item.unit_price_cents;
    } else {
      productMap.set(item.product_id, {
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        revenue: item.qty * item.unit_price_cents,
      });
    }
  }

  const sorted = Array.from(productMap.entries())
    .sort((a, b) => {
      if (b[1].qty !== a[1].qty) return b[1].qty - a[1].qty;
      return b[1].revenue - a[1].revenue;
    })
    .slice(0, limit);

  return sorted.map(([productId, data]) => ({
    product_id: productId,
    sku: data.sku,
    name: data.name,
    qty_sold: data.qty,
    revenue_cents: data.revenue,
  }));
}

// Generators
const productIdArb = fc.constantFrom('P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010');

const orderItemArb = fc.record({
  product_id: productIdArb,
  sku: fc.string({ minLength: 3, maxLength: 6 }),
  name: fc.string({ minLength: 3, maxLength: 20 }),
  qty: fc.integer({ min: 1, max: 10 }),
  unit_price_cents: fc.integer({ min: 500, max: 10000 }), // 5 to 100 soles
});

describe('Top Products Ranking Properties', () => {
  it('Property 4.1: returns at most limit products', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 0, maxLength: 100 }),
        fc.integer({ min: 1, max: 20 }),
        (items, limit) => {
          const topProducts = calculateTopProducts(items, limit);
          expect(topProducts.length).toBeLessThanOrEqual(limit);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.2: returns all products if fewer than limit', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 0, maxLength: 5 }),
        (items) => {
          const uniqueProducts = new Set(items.map(i => i.product_id)).size;
          const topProducts = calculateTopProducts(items, 10);
          
          expect(topProducts.length).toBe(uniqueProducts);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.3: products are sorted by qty_sold descending', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 2, maxLength: 50 }),
        fc.integer({ min: 2, max: 10 }),
        (items, limit) => {
          const topProducts = calculateTopProducts(items, limit);
          
          for (let i = 1; i < topProducts.length; i++) {
            const prev = topProducts[i - 1];
            const curr = topProducts[i];
            
            // Either qty is strictly greater, or qty is equal and revenue is >= 
            expect(
              prev.qty_sold > curr.qty_sold ||
              (prev.qty_sold === curr.qty_sold && prev.revenue_cents >= curr.revenue_cents)
            ).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.4: qty_sold is sum of all quantities for that product', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const topProducts = calculateTopProducts(items, 100);
          
          for (const product of topProducts) {
            const expectedQty = items
              .filter(i => i.product_id === product.product_id)
              .reduce((sum, i) => sum + i.qty, 0);
            
            expect(product.qty_sold).toBe(expectedQty);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.5: revenue_cents is sum of (qty * unit_price) for that product', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const topProducts = calculateTopProducts(items, 100);
          
          for (const product of topProducts) {
            const expectedRevenue = items
              .filter(i => i.product_id === product.product_id)
              .reduce((sum, i) => sum + (i.qty * i.unit_price_cents), 0);
            
            expect(product.revenue_cents).toBe(expectedRevenue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.6: empty items returns empty array', () => {
    const topProducts = calculateTopProducts([], 5);
    expect(topProducts).toEqual([]);
  });

  it('Property 4.7: all values are non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const topProducts = calculateTopProducts(items, 10);
          
          for (const product of topProducts) {
            expect(Number.isInteger(product.qty_sold)).toBe(true);
            expect(product.qty_sold).toBeGreaterThan(0);
            
            expect(Number.isInteger(product.revenue_cents)).toBe(true);
            expect(product.revenue_cents).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4.8: ties in qty are broken by revenue descending', () => {
    // Create items with same qty but different prices
    const items: OrderItem[] = [
      { product_id: 'A', sku: 'SKU-A', name: 'Product A', qty: 5, unit_price_cents: 1000 },
      { product_id: 'B', sku: 'SKU-B', name: 'Product B', qty: 5, unit_price_cents: 2000 },
      { product_id: 'C', sku: 'SKU-C', name: 'Product C', qty: 5, unit_price_cents: 1500 },
    ];
    
    const topProducts = calculateTopProducts(items, 10);
    
    // All have qty=5, so should be sorted by revenue: B (10000), C (7500), A (5000)
    expect(topProducts[0].product_id).toBe('B');
    expect(topProducts[1].product_id).toBe('C');
    expect(topProducts[2].product_id).toBe('A');
  });
});
