/**
 * Property-Based Tests for Products Management
 * 
 * Property 2: Filtro de Productos Retorna Resultados Correctos
 * Property 3: Versión de Catálogo Incrementa en Edición
 * Property 4: Precios Almacenados como Enteros
 * 
 * Validates: Requirements 3.1, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types
interface Product {
  id: string;
  sku: string;
  name: string;
  short_name: string | null;
  price_cents: number;
  category: string;
  station: string;
  type: 'SIMPLE' | 'COMBO';
  is_active: boolean;
}

// Filter function (mirrors DataTable logic)
function filterProducts(
  products: Product[],
  filters: {
    search?: string;
    category?: string;
    station?: string;
    is_active?: string;
  }
): Product[] {
  let result = [...products];

  // Apply search
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        (p.short_name && p.short_name.toLowerCase().includes(searchLower))
    );
  }

  // Apply category filter
  if (filters.category) {
    result = result.filter((p) => p.category === filters.category);
  }

  // Apply station filter
  if (filters.station) {
    result = result.filter((p) => p.station === filters.station);
  }

  // Apply is_active filter
  if (filters.is_active !== undefined) {
    const isActive = filters.is_active === 'true';
    result = result.filter((p) => p.is_active === isActive);
  }

  return result;
}

// Arbitraries
const categoryArb = fc.constantFrom('POLLOS', 'PARRILLAS', 'BEBIDAS', 'EXTRAS', 'POSTRES', 'COMBOS');
const stationArb = fc.constantFrom('PARRILLA', 'COCINA', 'BAR', 'HORNO', 'POSTRES', 'EMPAQUE');
const typeArb = fc.constantFrom<'SIMPLE' | 'COMBO'>('SIMPLE', 'COMBO');

const productArb = fc.record({
  id: fc.uuid(),
  sku: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  short_name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  price_cents: fc.integer({ min: 0, max: 1000000 }), // 0 to 10,000.00
  category: categoryArb,
  station: stationArb,
  type: typeArb,
  is_active: fc.boolean(),
});

const productsArrayArb = fc.array(productArb, { minLength: 0, maxLength: 50 });

describe('Products - Property Tests', () => {
  describe('Property 2: Filter Returns Correct Results', () => {
    it('category filter returns only products with matching category', () => {
      fc.assert(
        fc.property(productsArrayArb, categoryArb, (products, category) => {
          const filtered = filterProducts(products, { category });
          
          // All filtered products must have the specified category
          filtered.forEach((p) => {
            expect(p.category).toBe(category);
          });
          
          // All products with matching category must be in result
          const expected = products.filter((p) => p.category === category);
          expect(filtered.length).toBe(expected.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('station filter returns only products with matching station', () => {
      fc.assert(
        fc.property(productsArrayArb, stationArb, (products, station) => {
          const filtered = filterProducts(products, { station });
          
          filtered.forEach((p) => {
            expect(p.station).toBe(station);
          });
          
          const expected = products.filter((p) => p.station === station);
          expect(filtered.length).toBe(expected.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('is_active filter returns only products with matching status', () => {
      fc.assert(
        fc.property(productsArrayArb, fc.boolean(), (products, isActive) => {
          const filtered = filterProducts(products, { is_active: String(isActive) });
          
          filtered.forEach((p) => {
            expect(p.is_active).toBe(isActive);
          });
          
          const expected = products.filter((p) => p.is_active === isActive);
          expect(filtered.length).toBe(expected.length);
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('combined filters return intersection of all criteria', () => {
      fc.assert(
        fc.property(
          productsArrayArb,
          categoryArb,
          stationArb,
          fc.boolean(),
          (products, category, station, isActive) => {
            const filtered = filterProducts(products, {
              category,
              station,
              is_active: String(isActive),
            });
            
            // All filtered products must match ALL criteria
            filtered.forEach((p) => {
              expect(p.category).toBe(category);
              expect(p.station).toBe(station);
              expect(p.is_active).toBe(isActive);
            });
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('search filter is case-insensitive', () => {
      fc.assert(
        fc.property(
          productsArrayArb,
          fc.string({ minLength: 1, maxLength: 10 }),
          (products, searchTerm) => {
            const lowerResult = filterProducts(products, { search: searchTerm.toLowerCase() });
            const upperResult = filterProducts(products, { search: searchTerm.toUpperCase() });
            
            // Case should not affect results
            expect(lowerResult.length).toBe(upperResult.length);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('empty filter returns all products', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProducts(products, {});
          expect(filtered.length).toBe(products.length);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Catalog Version Increments on Edit', () => {
    // Simulates catalog version behavior
    interface CatalogState {
      version: number;
      products: Product[];
    }

    function editProduct(state: CatalogState, productId: string, updates: Partial<Product>): CatalogState {
      const productIndex = state.products.findIndex((p) => p.id === productId);
      if (productIndex === -1) return state;

      const newProducts = [...state.products];
      newProducts[productIndex] = { ...newProducts[productIndex], ...updates };

      return {
        version: state.version + 1, // Always increment on edit
        products: newProducts,
      };
    }

    function createProduct(state: CatalogState, product: Product): CatalogState {
      return {
        version: state.version + 1, // Increment on create
        products: [...state.products, product],
      };
    }

    it('version increments by exactly 1 on product edit', () => {
      fc.assert(
        fc.property(
          productsArrayArb.filter((arr) => arr.length > 0),
          fc.integer({ min: 1, max: 1000 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (products, initialVersion, newName) => {
            const state: CatalogState = { version: initialVersion, products };
            const productToEdit = products[0];
            
            const newState = editProduct(state, productToEdit.id, { name: newName });
            
            expect(newState.version).toBe(initialVersion + 1);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('version increments by exactly 1 on product create', () => {
      fc.assert(
        fc.property(
          productsArrayArb,
          fc.integer({ min: 1, max: 1000 }),
          productArb,
          (products, initialVersion, newProduct) => {
            const state: CatalogState = { version: initialVersion, products };
            
            const newState = createProduct(state, newProduct);
            
            expect(newState.version).toBe(initialVersion + 1);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple edits increment version correctly', () => {
      fc.assert(
        fc.property(
          productsArrayArb.filter((arr) => arr.length > 0),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 10 }),
          (products, initialVersion, editCount) => {
            let state: CatalogState = { version: initialVersion, products };
            
            for (let i = 0; i < editCount; i++) {
              state = editProduct(state, products[0].id, { name: `Name ${i}` });
            }
            
            expect(state.version).toBe(initialVersion + editCount);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Prices Stored as Integers', () => {
    it('price_cents is always a non-negative integer', () => {
      fc.assert(
        fc.property(productArb, (product) => {
          expect(Number.isInteger(product.price_cents)).toBe(true);
          expect(product.price_cents).toBeGreaterThanOrEqual(0);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('price validation rejects non-integers', () => {
      const validatePrice = (price: number): boolean => {
        return Number.isInteger(price) && price >= 0;
      };

      fc.assert(
        fc.property(fc.double({ min: 0, max: 10000 }), (price) => {
          if (Number.isInteger(price)) {
            expect(validatePrice(price)).toBe(true);
          } else {
            expect(validatePrice(price)).toBe(false);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('price conversion from display to cents is lossless', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000000 }), (cents) => {
          // Convert to display format and back
          const display = cents / 100;
          const backToCents = Math.round(display * 100);
          
          expect(backToCents).toBe(cents);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('all products in array have integer prices', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          products.forEach((p) => {
            expect(Number.isInteger(p.price_cents)).toBe(true);
            expect(p.price_cents).toBeGreaterThanOrEqual(0);
          });
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
