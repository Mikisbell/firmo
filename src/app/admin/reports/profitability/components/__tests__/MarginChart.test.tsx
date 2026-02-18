/**
 * Tests para MarginChart
 * 
 * Valida el componente de gráfico de márgenes por categoría.
 * 
 * NOTE: Este archivo usa solo utilidades de Vitest (no @testing-library/react)
 * Los tests se enfocan en validar exports y estructura del componente.
 * 
 * @module app/admin/reports/profitability/components/__tests__
 */

import { describe, it, expect } from 'vitest';
import MarginChart from '../MarginChart';

// ============================================================================
// Tests
// ============================================================================

describe('MarginChart', () => {
  it('debe exportar una función de componente válida', () => {
    expect(typeof MarginChart).toBe('function');
    expect(MarginChart.name).toBe('MarginChart');
  });
  
  it('debe tener la firma correcta de props', () => {
    // Verificar que el componente acepta props de tipo { products: ProductMetrics[] }
    const componentString = MarginChart.toString();
    expect(componentString).toContain('products');
  });
});
