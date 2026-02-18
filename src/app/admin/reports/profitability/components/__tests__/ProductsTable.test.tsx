/**
 * Tests Unitarios - ProductsTable Component
 * 
 * Tests para la lógica de ordenamiento y formateo de datos
 * del componente de tabla de productos.
 * 
 * @module app/admin/reports/profitability/components/__tests__
 */

import { describe, it, expect } from 'vitest';
import type { ProductMetrics } from '../ProductsTable';

// ============================================================================
// Mock Data
// ============================================================================

const mockProducts: ProductMetrics[] = [
  {
    productId: 'prod-1',
    productName: 'Pollo a la Brasa',
    category: 'Parrilla',
    priceCents: 3500,
    cogsCents: 2050,
    profitCents: 1450,
    marginPercent: 41.43,
    unitsSold: 50,
    totalRevenueCents: 175000,
    totalProfitCents: 72500,
  },
  {
    productId: 'prod-2',
    productName: 'Inca Kola',
    category: 'Bebidas',
    priceCents: 500,
    cogsCents: 200,
    profitCents: 300,
    marginPercent: 60.0,
    unitsSold: 100,
    totalRevenueCents: 50000,
    totalProfitCents: 30000,
  },
  {
    productId: 'prod-3',
    productName: 'Papas Fritas',
    category: 'Acompañamientos',
    priceCents: 800,
    cogsCents: 300,
    profitCents: 500,
    marginPercent: 62.5,
    unitsSold: 75,
    totalRevenueCents: 60000,
    totalProfitCents: 37500,
  },
];

// ============================================================================
// Helper Functions (extracted from component logic)
// ============================================================================

type SortField = keyof ProductMetrics;
type SortDirection = 'asc' | 'desc';

/**
 * Función de ordenamiento extraída del componente
 * Esta es la lógica que se prueba
 */
function sortProducts(
  products: ProductMetrics[],
  sortField: SortField,
  sortDirection: SortDirection
): ProductMetrics[] {
  return [...products].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    // Comparación numérica
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Comparación de strings
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return 0;
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('ProductsTable - Lógica de Ordenamiento', () => {
  describe('Ordenamiento por Nombre', () => {
    it('debe ordenar productos por nombre ascendente', () => {
      const sorted = sortProducts(mockProducts, 'productName', 'asc');
      
      expect(sorted[0].productName).toBe('Inca Kola');
      expect(sorted[1].productName).toBe('Papas Fritas');
      expect(sorted[2].productName).toBe('Pollo a la Brasa');
    });
    
    it('debe ordenar productos por nombre descendente', () => {
      const sorted = sortProducts(mockProducts, 'productName', 'desc');
      
      expect(sorted[0].productName).toBe('Pollo a la Brasa');
      expect(sorted[1].productName).toBe('Papas Fritas');
      expect(sorted[2].productName).toBe('Inca Kola');
    });
  });
  
  describe('Ordenamiento por Precio', () => {
    it('debe ordenar productos por precio ascendente', () => {
      const sorted = sortProducts(mockProducts, 'priceCents', 'asc');
      
      expect(sorted[0].priceCents).toBe(500); // Inca Kola
      expect(sorted[1].priceCents).toBe(800); // Papas Fritas
      expect(sorted[2].priceCents).toBe(3500); // Pollo a la Brasa
    });
    
    it('debe ordenar productos por precio descendente', () => {
      const sorted = sortProducts(mockProducts, 'priceCents', 'desc');
      
      expect(sorted[0].priceCents).toBe(3500); // Pollo a la Brasa
      expect(sorted[1].priceCents).toBe(800); // Papas Fritas
      expect(sorted[2].priceCents).toBe(500); // Inca Kola
    });
  });
  
  describe('Ordenamiento por COGS', () => {
    it('debe ordenar productos por COGS ascendente', () => {
      const sorted = sortProducts(mockProducts, 'cogsCents', 'asc');
      
      expect(sorted[0].cogsCents).toBe(200); // Inca Kola
      expect(sorted[1].cogsCents).toBe(300); // Papas Fritas
      expect(sorted[2].cogsCents).toBe(2050); // Pollo a la Brasa
    });
    
    it('debe ordenar productos por COGS descendente', () => {
      const sorted = sortProducts(mockProducts, 'cogsCents', 'desc');
      
      expect(sorted[0].cogsCents).toBe(2050); // Pollo a la Brasa
      expect(sorted[1].cogsCents).toBe(300); // Papas Fritas
      expect(sorted[2].cogsCents).toBe(200); // Inca Kola
    });
  });
  
  describe('Ordenamiento por Ganancia', () => {
    it('debe ordenar productos por ganancia ascendente', () => {
      const sorted = sortProducts(mockProducts, 'profitCents', 'asc');
      
      expect(sorted[0].profitCents).toBe(300); // Inca Kola
      expect(sorted[1].profitCents).toBe(500); // Papas Fritas
      expect(sorted[2].profitCents).toBe(1450); // Pollo a la Brasa
    });
    
    it('debe ordenar productos por ganancia descendente', () => {
      const sorted = sortProducts(mockProducts, 'profitCents', 'desc');
      
      expect(sorted[0].profitCents).toBe(1450); // Pollo a la Brasa
      expect(sorted[1].profitCents).toBe(500); // Papas Fritas
      expect(sorted[2].profitCents).toBe(300); // Inca Kola
    });
  });
  
  describe('Ordenamiento por Margen', () => {
    it('debe ordenar productos por margen ascendente', () => {
      const sorted = sortProducts(mockProducts, 'marginPercent', 'asc');
      
      expect(sorted[0].marginPercent).toBe(41.43); // Pollo a la Brasa
      expect(sorted[1].marginPercent).toBe(60.0); // Inca Kola
      expect(sorted[2].marginPercent).toBe(62.5); // Papas Fritas
    });
    
    it('debe ordenar productos por margen descendente', () => {
      const sorted = sortProducts(mockProducts, 'marginPercent', 'desc');
      
      expect(sorted[0].marginPercent).toBe(62.5); // Papas Fritas
      expect(sorted[1].marginPercent).toBe(60.0); // Inca Kola
      expect(sorted[2].marginPercent).toBe(41.43); // Pollo a la Brasa
    });
  });
  
  describe('Ordenamiento por Unidades Vendidas', () => {
    it('debe ordenar productos por unidades ascendente', () => {
      const sorted = sortProducts(mockProducts, 'unitsSold', 'asc');
      
      expect(sorted[0].unitsSold).toBe(50); // Pollo a la Brasa
      expect(sorted[1].unitsSold).toBe(75); // Papas Fritas
      expect(sorted[2].unitsSold).toBe(100); // Inca Kola
    });
    
    it('debe ordenar productos por unidades descendente', () => {
      const sorted = sortProducts(mockProducts, 'unitsSold', 'desc');
      
      expect(sorted[0].unitsSold).toBe(100); // Inca Kola
      expect(sorted[1].unitsSold).toBe(75); // Papas Fritas
      expect(sorted[2].unitsSold).toBe(50); // Pollo a la Brasa
    });
  });
  
  describe('Ordenamiento por Ingresos Totales', () => {
    it('debe ordenar productos por ingresos ascendente', () => {
      const sorted = sortProducts(mockProducts, 'totalRevenueCents', 'asc');
      
      expect(sorted[0].totalRevenueCents).toBe(50000); // Inca Kola
      expect(sorted[1].totalRevenueCents).toBe(60000); // Papas Fritas
      expect(sorted[2].totalRevenueCents).toBe(175000); // Pollo a la Brasa
    });
    
    it('debe ordenar productos por ingresos descendente', () => {
      const sorted = sortProducts(mockProducts, 'totalRevenueCents', 'desc');
      
      expect(sorted[0].totalRevenueCents).toBe(175000); // Pollo a la Brasa
      expect(sorted[1].totalRevenueCents).toBe(60000); // Papas Fritas
      expect(sorted[2].totalRevenueCents).toBe(50000); // Inca Kola
    });
  });
  
  describe('Ordenamiento por Ganancia Total', () => {
    it('debe ordenar productos por ganancia total ascendente', () => {
      const sorted = sortProducts(mockProducts, 'totalProfitCents', 'asc');
      
      expect(sorted[0].totalProfitCents).toBe(30000); // Inca Kola
      expect(sorted[1].totalProfitCents).toBe(37500); // Papas Fritas
      expect(sorted[2].totalProfitCents).toBe(72500); // Pollo a la Brasa
    });
    
    it('debe ordenar productos por ganancia total descendente', () => {
      const sorted = sortProducts(mockProducts, 'totalProfitCents', 'desc');
      
      expect(sorted[0].totalProfitCents).toBe(72500); // Pollo a la Brasa
      expect(sorted[1].totalProfitCents).toBe(37500); // Papas Fritas
      expect(sorted[2].totalProfitCents).toBe(30000); // Inca Kola
    });
  });
  
  describe('Ordenamiento por Categoría', () => {
    it('debe ordenar productos por categoría ascendente', () => {
      const sorted = sortProducts(mockProducts, 'category', 'asc');
      
      expect(sorted[0].category).toBe('Acompañamientos');
      expect(sorted[1].category).toBe('Bebidas');
      expect(sorted[2].category).toBe('Parrilla');
    });
    
    it('debe ordenar productos por categoría descendente', () => {
      const sorted = sortProducts(mockProducts, 'category', 'desc');
      
      expect(sorted[0].category).toBe('Parrilla');
      expect(sorted[1].category).toBe('Bebidas');
      expect(sorted[2].category).toBe('Acompañamientos');
    });
  });
  
  describe('Edge Cases', () => {
    it('debe manejar array vacío', () => {
      const sorted = sortProducts([], 'productName', 'asc');
      
      expect(sorted).toEqual([]);
    });
    
    it('debe manejar un solo producto', () => {
      const singleProduct = [mockProducts[0]];
      const sorted = sortProducts(singleProduct, 'productName', 'asc');
      
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toEqual(mockProducts[0]);
    });
    
    it('debe manejar productos con valores negativos', () => {
      const productsWithLoss: ProductMetrics[] = [
        {
          productId: 'prod-loss',
          productName: 'Producto con Pérdida',
          category: 'Test',
          priceCents: 1000,
          cogsCents: 1500,
          profitCents: -500,
          marginPercent: -50.0,
          unitsSold: 10,
          totalRevenueCents: 10000,
          totalProfitCents: -5000,
        },
        ...mockProducts,
      ];
      
      const sorted = sortProducts(productsWithLoss, 'profitCents', 'asc');
      
      // El producto con pérdida debe estar primero (menor ganancia)
      expect(sorted[0].profitCents).toBe(-500);
    });
    
    it('debe manejar productos con valores en cero', () => {
      const productsWithZero: ProductMetrics[] = [
        {
          productId: 'prod-zero',
          productName: 'Producto Sin Ventas',
          category: 'Test',
          priceCents: 1000,
          cogsCents: 500,
          profitCents: 500,
          marginPercent: 50.0,
          unitsSold: 0,
          totalRevenueCents: 0,
          totalProfitCents: 0,
        },
        ...mockProducts,
      ];
      
      const sorted = sortProducts(productsWithZero, 'unitsSold', 'asc');
      
      // El producto sin ventas debe estar primero
      expect(sorted[0].unitsSold).toBe(0);
    });
    
    it('debe manejar productos con nombres idénticos', () => {
      const duplicateNames: ProductMetrics[] = [
        { ...mockProducts[0], productId: 'prod-1a' },
        { ...mockProducts[0], productId: 'prod-1b' },
      ];
      
      const sorted = sortProducts(duplicateNames, 'productName', 'asc');
      
      // Ambos productos deben estar presentes
      expect(sorted).toHaveLength(2);
      expect(sorted[0].productName).toBe(sorted[1].productName);
    });
  });
  
  describe('Inmutabilidad', () => {
    it('no debe modificar el array original', () => {
      const original = [...mockProducts];
      const originalCopy = JSON.parse(JSON.stringify(original));
      
      sortProducts(original, 'priceCents', 'desc');
      
      // El array original no debe cambiar
      expect(original).toEqual(originalCopy);
    });
  });
  
  describe('Performance', () => {
    it('debe manejar lista grande de productos eficientemente', () => {
      const largeProductList: ProductMetrics[] = Array.from({ length: 1000 }, (_, i) => ({
        productId: `prod-${i}`,
        productName: `Producto ${i}`,
        category: `Categoría ${i % 5}`,
        priceCents: 1000 + i * 100,
        cogsCents: 500 + i * 50,
        profitCents: 500 + i * 50,
        marginPercent: 50.0,
        unitsSold: i * 10,
        totalRevenueCents: (1000 + i * 100) * (i * 10),
        totalProfitCents: (500 + i * 50) * (i * 10),
      }));
      
      const startTime = performance.now();
      const sorted = sortProducts(largeProductList, 'totalProfitCents', 'desc');
      const endTime = performance.now();
      
      // Debe completar en menos de 100ms
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verificar que está ordenado correctamente
      expect(sorted[0].totalProfitCents).toBeGreaterThanOrEqual(sorted[1].totalProfitCents);
      expect(sorted[1].totalProfitCents).toBeGreaterThanOrEqual(sorted[2].totalProfitCents);
    });
  });
});
