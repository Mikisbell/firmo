/**
 * Tests para ProfitTrendChart
 * 
 * Valida el componente de gráfico de tendencia de ganancia.
 * 
 * NOTE: Este archivo usa solo utilidades de Vitest (no @testing-library/react)
 * Los tests se enfocan en validar exports y estructura del componente.
 * 
 * @module app/admin/reports/profitability/components/__tests__
 */

import { describe, it, expect } from 'vitest';
import ProfitTrendChart from '../ProfitTrendChart';

// ============================================================================
// Tests
// ============================================================================

describe('ProfitTrendChart', () => {
  it('debe exportar una función de componente válida', () => {
    expect(typeof ProfitTrendChart).toBe('function');
    expect(ProfitTrendChart.name).toBe('ProfitTrendChart');
  });
  
  it('debe tener la firma correcta de props', () => {
    // Verificar que el componente acepta props de tipo { products, startDate?, endDate? }
    const componentString = ProfitTrendChart.toString();
    expect(componentString).toContain('products');
    expect(componentString).toContain('startDate');
    expect(componentString).toContain('endDate');
  });
});
