/**
 * Property 10: Search Filter Correctness
 * Validates: Requirements 1.5, 5.2
 * 
 * Propiedades:
 * - Búsqueda por código o nombre debe ser case-insensitive
 * - Resultados filtrados deben contener el término de búsqueda
 * - Filtro vacío retorna todos los items
 * - Filtro de stock bajo solo retorna items con status LOW o CRITICAL
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Tipo de status
type StockStatus = 'OK' | 'LOW' | 'CRITICAL';

// Item de inventario
interface InventoryItem {
  id: string;
  code: string;
  name: string;
  stock: number;
  minStock: number;
  status: StockStatus;
}

// Calcular status
function calculateStatus(stock: number, minStock: number): StockStatus {
  if (minStock <= 0) return 'OK';
  if (stock < minStock) return 'CRITICAL';
  if (stock < minStock * 1.5) return 'LOW';
  return 'OK';
}

// Filtrar por búsqueda (case-insensitive)
function filterBySearch(items: InventoryItem[], query: string): InventoryItem[] {
  if (!query || query.trim() === '') {
    return items;
  }
  
  const lowerQuery = query.toLowerCase().trim();
  
  return items.filter(item => 
    item.code.toLowerCase().includes(lowerQuery) ||
    item.name.toLowerCase().includes(lowerQuery)
  );
}

// Filtrar por stock bajo
function filterByLowStock(items: InventoryItem[]): InventoryItem[] {
  return items.filter(item => item.status === 'LOW' || item.status === 'CRITICAL');
}

// Filtrar combinado
function filterItems(
  items: InventoryItem[], 
  options: { search?: string; lowStockOnly?: boolean }
): InventoryItem[] {
  let result = items;
  
  if (options.search) {
    result = filterBySearch(result, options.search);
  }
  
  if (options.lowStockOnly) {
    result = filterByLowStock(result);
  }
  
  return result;
}

// Arbitrarios
const codeArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
const nameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const stockArb = fc.integer({ min: 0, max: 10000 });
const minStockArb = fc.integer({ min: 0, max: 1000 });

const inventoryItemArb = fc.record({
  id: fc.uuid(),
  code: codeArb,
  name: nameArb,
  stock: stockArb,
  minStock: minStockArb,
}).map(item => ({
  ...item,
  status: calculateStatus(item.stock, item.minStock),
}));

const inventoryListArb = fc.array(inventoryItemArb, { minLength: 0, maxLength: 100 });

describe('Property 10: Search Filter Correctness', () => {
  describe('Search by code or name', () => {
    it('should return all items when search is empty', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          fc.constantFrom('', '   ', null as unknown as string, undefined as unknown as string),
          (items, query) => {
            const result = filterBySearch(items, query as string);
            
            expect(result).toHaveLength(items.length);
            expect(result).toEqual(items);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          codeArb,
          (items, searchTerm) => {
            const lowerResult = filterBySearch(items, searchTerm.toLowerCase());
            const upperResult = filterBySearch(items, searchTerm.toUpperCase());
            const mixedResult = filterBySearch(items, searchTerm);
            
            // Todos deben retornar los mismos resultados
            expect(lowerResult).toEqual(upperResult);
            expect(upperResult).toEqual(mixedResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only return items containing the search term', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          codeArb.filter(s => s.length >= 2),
          (items, searchTerm) => {
            const result = filterBySearch(items, searchTerm);
            const lowerSearch = searchTerm.toLowerCase().trim();
            
            // Si no hay resultados, el test pasa (no hay items que verificar)
            if (result.length === 0) {
              return true;
            }
            
            // Todos los resultados deben contener el término
            for (const item of result) {
              const matchesCode = item.code.toLowerCase().includes(lowerSearch);
              const matchesName = item.name.toLowerCase().includes(lowerSearch);
              
              expect(matchesCode || matchesName).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should find items by exact code match', () => {
      const items: InventoryItem[] = [
        { id: '1', code: 'POLLO-KG', name: 'Pollo', stock: 50, minStock: 10, status: 'OK' },
        { id: '2', code: 'PAPA-KG', name: 'Papa', stock: 100, minStock: 20, status: 'OK' },
        { id: '3', code: 'SAL-KG', name: 'Sal', stock: 10, minStock: 2, status: 'OK' },
      ];
      
      const result = filterBySearch(items, 'POLLO-KG');
      
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('POLLO-KG');
    });

    it('should find items by partial name match', () => {
      const items: InventoryItem[] = [
        { id: '1', code: 'POLLO-KG', name: 'Pollo entero', stock: 50, minStock: 10, status: 'OK' },
        { id: '2', code: 'PAPA-KG', name: 'Papa amarilla', stock: 100, minStock: 20, status: 'OK' },
        { id: '3', code: 'SAL-KG', name: 'Sal de mesa', stock: 10, minStock: 2, status: 'OK' },
      ];
      
      const result = filterBySearch(items, 'amarilla');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Papa amarilla');
    });

    it('should return empty array when no matches', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          (items) => {
            // Buscar algo que no existe
            const result = filterBySearch(items, 'ZZZZNOTEXIST12345');
            
            expect(result).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Low stock filter', () => {
    it('should only return items with LOW or CRITICAL status', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          (items) => {
            const result = filterByLowStock(items);
            
            for (const item of result) {
              expect(['LOW', 'CRITICAL']).toContain(item.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not include OK status items', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          (items) => {
            const result = filterByLowStock(items);
            
            for (const item of result) {
              expect(item.status).not.toBe('OK');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return correct count of low stock items', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          (items) => {
            const result = filterByLowStock(items);
            const expectedCount = items.filter(i => i.status === 'LOW' || i.status === 'CRITICAL').length;
            
            expect(result).toHaveLength(expectedCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined filters', () => {
    it('should apply both search and low stock filters', () => {
      const items: InventoryItem[] = [
        { id: '1', code: 'POLLO-KG', name: 'Pollo', stock: 5, minStock: 10, status: 'CRITICAL' },
        { id: '2', code: 'POLLO-MEDIO', name: 'Medio Pollo', stock: 50, minStock: 10, status: 'OK' },
        { id: '3', code: 'PAPA-KG', name: 'Papa', stock: 15, minStock: 20, status: 'LOW' },
      ];
      
      const result = filterItems(items, { search: 'POLLO', lowStockOnly: true });
      
      // Solo POLLO-KG tiene status CRITICAL y contiene "POLLO"
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('POLLO-KG');
    });

    it('should return subset when both filters applied', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          codeArb,
          (items, search) => {
            const searchOnly = filterItems(items, { search });
            const lowStockOnly = filterItems(items, { lowStockOnly: true });
            const combined = filterItems(items, { search, lowStockOnly: true });
            
            // Combined debe ser subconjunto de ambos
            expect(combined.length).toBeLessThanOrEqual(searchOnly.length);
            expect(combined.length).toBeLessThanOrEqual(lowStockOnly.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent (applying same filter twice = same result)', () => {
      fc.assert(
        fc.property(
          inventoryListArb,
          codeArb,
          (items, search) => {
            const result1 = filterItems(items, { search, lowStockOnly: true });
            const result2 = filterItems(result1, { search, lowStockOnly: true });
            
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty inventory list', () => {
      const result = filterItems([], { search: 'test', lowStockOnly: true });
      expect(result).toHaveLength(0);
    });

    it('should handle special characters in search', () => {
      const items: InventoryItem[] = [
        { id: '1', code: 'POLLO-1/4', name: 'Pollo 1/4', stock: 50, minStock: 10, status: 'OK' },
        { id: '2', code: 'POLLO-1/2', name: 'Pollo 1/2', stock: 50, minStock: 10, status: 'OK' },
      ];
      
      const result = filterBySearch(items, '1/4');
      
      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('POLLO-1/4');
    });

    it('should handle unicode characters', () => {
      const items: InventoryItem[] = [
        { id: '1', code: 'AJI-KG', name: 'Ají amarillo', stock: 5, minStock: 1, status: 'OK' },
        { id: '2', code: 'OREGANO', name: 'Orégano', stock: 2, minStock: 1, status: 'OK' },
      ];
      
      const result = filterBySearch(items, 'ají');
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ají amarillo');
    });
  });
});
