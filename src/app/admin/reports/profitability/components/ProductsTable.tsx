/**
 * Tabla de Productos - Componente de Rentabilidad
 * 
 * Componente reutilizable que muestra una tabla de productos con métricas
 * financieras (precio, COGS, ganancia, margen) con ordenamiento por columnas.
 * 
 * Features:
 * - Ordenamiento por cualquier columna (click en headers)
 * - Memoización de cálculos pesados con useMemo
 * - Formato monetario y colores condicionales
 * - Responsive design
 * - TypeScript type-safe
 * 
 * Requirements: 7.1, 10.3
 * 
 * @module app/admin/reports/profitability/components
 */

'use client';

import { useMemo, useState } from 'react';
import { formatCents } from '@/src/core/domain/money';
import { ChevronUp, ChevronDown } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ProductMetrics {
  productId: string;
  productName: string;
  category: string;
  priceCents: number;
  cogsCents: number;
  profitCents: number;
  marginPercent: number;
  unitsSold: number;
  totalRevenueCents: number;
  totalProfitCents: number;
}

type SortField = keyof ProductMetrics;
type SortDirection = 'asc' | 'desc';

interface ProductsTableProps {
  products: ProductMetrics[];
}

// ============================================================================
// Component
// ============================================================================

export default function ProductsTable({ products }: ProductsTableProps) {
  // ============================================================================
  // State
  // ============================================================================
  
  const [sortField, setSortField] = useState<SortField>('totalProfitCents');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // ============================================================================
  // Handlers
  // ============================================================================
  
  /**
   * Manejar click en header de columna para ordenar
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle dirección si es la misma columna
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nueva columna, ordenar descendente por defecto
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // ============================================================================
  // Memoized Data
  // ============================================================================
  
  /**
   * Productos ordenados según sortField y sortDirection
   * Memoizado para evitar recalcular en cada render
   * Requirement: 10.3
   */
  const sortedProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
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
    
    return sorted;
  }, [products, sortField, sortDirection]);
  
  // ============================================================================
  // Render Helpers
  // ============================================================================
  
  /**
   * Renderizar icono de ordenamiento en header
   */
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return null;
    }
    
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };
  
  /**
   * Clase CSS para header clickeable
   */
  const headerClass = (field: SortField) => {
    const baseClass = "px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors";
    const activeClass = sortField === field ? "bg-gray-100" : "";
    return `${baseClass} ${activeClass}`;
  };
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Productos ({products.length})
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className={`${headerClass('productName')} text-left`}
                onClick={() => handleSort('productName')}
              >
                Producto
                {renderSortIcon('productName')}
              </th>
              <th
                className={`${headerClass('category')} text-left`}
                onClick={() => handleSort('category')}
              >
                Categoría
                {renderSortIcon('category')}
              </th>
              <th
                className={`${headerClass('priceCents')} text-right`}
                onClick={() => handleSort('priceCents')}
              >
                Precio
                {renderSortIcon('priceCents')}
              </th>
              <th
                className={`${headerClass('cogsCents')} text-right`}
                onClick={() => handleSort('cogsCents')}
              >
                COGS
                {renderSortIcon('cogsCents')}
              </th>
              <th
                className={`${headerClass('profitCents')} text-right`}
                onClick={() => handleSort('profitCents')}
              >
                Ganancia
                {renderSortIcon('profitCents')}
              </th>
              <th
                className={`${headerClass('marginPercent')} text-right`}
                onClick={() => handleSort('marginPercent')}
              >
                Margen
                {renderSortIcon('marginPercent')}
              </th>
              <th
                className={`${headerClass('unitsSold')} text-right`}
                onClick={() => handleSort('unitsSold')}
              >
                Unidades
                {renderSortIcon('unitsSold')}
              </th>
              <th
                className={`${headerClass('totalRevenueCents')} text-right`}
                onClick={() => handleSort('totalRevenueCents')}
              >
                Ingresos
                {renderSortIcon('totalRevenueCents')}
              </th>
              <th
                className={`${headerClass('totalProfitCents')} text-right`}
                onClick={() => handleSort('totalProfitCents')}
              >
                Ganancia Total
                {renderSortIcon('totalProfitCents')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProducts.map((product) => (
              <tr key={product.productId} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {product.productName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                    {product.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCents(product.priceCents)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCents(product.cogsCents)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={product.profitCents >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCents(product.profitCents)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={product.marginPercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {product.marginPercent.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {product.unitsSold}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {formatCents(product.totalRevenueCents)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <span className={product.totalProfitCents >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {formatCents(product.totalProfitCents)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
