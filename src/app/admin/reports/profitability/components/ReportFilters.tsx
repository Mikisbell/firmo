/**
 * Componente de Filtros de Reporte de Rentabilidad
 * 
 * Componente reutilizable que proporciona filtros para el dashboard de rentabilidad:
 * - Filtro de rango de fechas (date picker)
 * - Filtro de categorías (multi-select)
 * - Debounce de 300ms para evitar requests excesivos
 * - Botón para limpiar filtros
 * - Botón para exportar datos a CSV
 * 
 * Requirements: 7.4, 7.5
 * 
 * @module app/admin/reports/profitability/components
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ReportFiltersProps {
  /** Fecha de inicio actual */
  startDate: string;
  /** Fecha de fin actual */
  endDate: string;
  /** Categoría seleccionada actual */
  selectedCategory: string;
  /** Categorías disponibles para el filtro */
  categories: string[];
  /** Callback cuando cambian los filtros (con debounce aplicado) */
  onFiltersChange: (filters: {
    startDate: string;
    endDate: string;
    selectedCategory: string;
  }) => void;
  /** Callback para limpiar filtros */
  onClearFilters: () => void;
  /** Callback para exportar datos */
  onExport: () => void;
  /** Deshabilitar controles durante carga */
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function ReportFilters({
  startDate,
  endDate,
  selectedCategory,
  categories,
  onFiltersChange,
  onClearFilters,
  onExport,
  disabled = false,
}: ReportFiltersProps) {
  // ============================================================================
  // State Local (para debounce)
  // ============================================================================
  
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [localCategory, setLocalCategory] = useState(selectedCategory);
  
  // ============================================================================
  // Debounce Effect
  // ============================================================================
  
  /**
   * Aplicar debounce de 300ms a los cambios de filtros
   * Requirement: 7.5 - Aplicar filtros con debounce (300ms)
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Solo llamar callback si los valores cambiaron
      if (
        localStartDate !== startDate ||
        localEndDate !== endDate ||
        localCategory !== selectedCategory
      ) {
        onFiltersChange({
          startDate: localStartDate,
          endDate: localEndDate,
          selectedCategory: localCategory,
        });
      }
    }, 300); // 300ms debounce
    
    // Cleanup: cancelar timeout si los valores cambian antes de 300ms
    return () => clearTimeout(timeoutId);
  }, [localStartDate, localEndDate, localCategory, startDate, endDate, selectedCategory, onFiltersChange]);
  
  // ============================================================================
  // Sync Props to Local State
  // ============================================================================
  
  /**
   * Sincronizar props con estado local cuando cambian externamente
   * (ej: cuando se limpian los filtros)
   */
  useEffect(() => {
    setLocalStartDate(startDate);
  }, [startDate]);
  
  useEffect(() => {
    setLocalEndDate(endDate);
  }, [endDate]);
  
  useEffect(() => {
    setLocalCategory(selectedCategory);
  }, [selectedCategory]);
  
  // ============================================================================
  // Handlers
  // ============================================================================
  
  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStartDate(e.target.value);
  }, []);
  
  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalEndDate(e.target.value);
  }, []);
  
  const handleCategoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalCategory(e.target.value);
  }, []);
  
  // ============================================================================
  // Derived State
  // ============================================================================
  
  const hasActiveFilters = localStartDate || localEndDate || localCategory;
  
  // ============================================================================
  // Render
  // ============================================================================
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h2>
      
      {/* Filtros Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fecha Inicio */}
        <div>
          <label
            htmlFor="filter-start-date"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Fecha Inicio
          </label>
          <input
            id="filter-start-date"
            type="date"
            value={localStartDate}
            onChange={handleStartDateChange}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            aria-label="Fecha de inicio del período"
          />
        </div>
        
        {/* Fecha Fin */}
        <div>
          <label
            htmlFor="filter-end-date"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Fecha Fin
          </label>
          <input
            id="filter-end-date"
            type="date"
            value={localEndDate}
            onChange={handleEndDateChange}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            aria-label="Fecha de fin del período"
          />
        </div>
        
        {/* Categoría */}
        <div>
          <label
            htmlFor="filter-category"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Categoría
          </label>
          <select
            id="filter-category"
            value={localCategory}
            onChange={handleCategoryChange}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap gap-4 mt-4">
        {/* Limpiar Filtros */}
        <button
          onClick={onClearFilters}
          disabled={disabled || !hasActiveFilters}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Limpiar todos los filtros"
        >
          <X className="w-4 h-4" />
          Limpiar Filtros
        </button>
        
        {/* Exportar CSV */}
        <button
          onClick={onExport}
          disabled={disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          aria-label="Exportar datos a CSV"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>
      
      {/* Debounce Indicator */}
      {hasActiveFilters && (
        <div className="mt-4 text-xs text-gray-500">
          Los filtros se aplican automáticamente después de 300ms
        </div>
      )}
    </div>
  );
}
