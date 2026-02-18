/**
 * Componente de Gráfico de Márgenes por Categoría
 * 
 * Visualiza los márgenes de ganancia agrupados por categoría de producto
 * usando un gráfico de barras horizontal.
 * 
 * Features:
 * - Gráfico de barras con Recharts
 * - Colores diferenciados por margen (verde: alto, amarillo: medio, rojo: bajo)
 * - Tooltip con información detallada
 * - Responsive design
 * - Ordenado por margen descendente
 * 
 * Requirements: 7.2, 10.1
 * 
 * @module app/admin/reports/profitability/components
 */

'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCents } from '@/src/core/domain/money';

// ============================================================================
// Types
// ============================================================================

interface ProductMetrics {
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

interface MarginChartProps {
  products: ProductMetrics[];
}

interface CategoryData {
  category: string;
  averageMargin: number;
  totalProfit: number;
  productCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Obtener color según el margen
 * - Verde: margen >= 40%
 * - Amarillo: margen >= 20%
 * - Rojo: margen < 20%
 */
function getMarginColor(margin: number): string {
  if (margin >= 40) return '#10b981'; // green-500
  if (margin >= 20) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

/**
 * Agrupar productos por categoría y calcular métricas
 */
function aggregateByCategory(products: ProductMetrics[]): CategoryData[] {
  const categoryMap = new Map<string, {
    totalMargin: number;
    totalProfit: number;
    count: number;
  }>();
  
  // Agrupar por categoría
  for (const product of products) {
    const existing = categoryMap.get(product.category) || {
      totalMargin: 0,
      totalProfit: 0,
      count: 0,
    };
    
    categoryMap.set(product.category, {
      totalMargin: existing.totalMargin + product.marginPercent,
      totalProfit: existing.totalProfit + product.totalProfitCents,
      count: existing.count + 1,
    });
  }
  
  // Convertir a array y calcular promedios
  const categories: CategoryData[] = [];
  
  for (const [category, data] of categoryMap.entries()) {
    categories.push({
      category,
      averageMargin: data.totalMargin / data.count,
      totalProfit: data.totalProfit,
      productCount: data.count,
    });
  }
  
  // Ordenar por margen descendente
  return categories.sort((a, b) => b.averageMargin - a.averageMargin);
}

// ============================================================================
// Custom Tooltip
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: CategoryData;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
      <p className="font-semibold text-gray-900 mb-2">{data.category}</p>
      <div className="space-y-1 text-sm">
        <p className="text-gray-700">
          <span className="font-medium">Margen Promedio:</span>{' '}
          <span className="text-blue-600 font-semibold">
            {data.averageMargin.toFixed(2)}%
          </span>
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Ganancia Total:</span>{' '}
          <span className="text-green-600 font-semibold">
            {formatCents(data.totalProfit)}
          </span>
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Productos:</span>{' '}
          {data.productCount}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MarginChart({ products }: MarginChartProps) {
  // Agregar datos por categoría
  const categoryData = useMemo(() => {
    return aggregateByCategory(products);
  }, [products]);
  
  // Empty state
  if (categoryData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Márgenes por Categoría
        </h2>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No hay datos para mostrar
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Márgenes por Categoría
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Margen promedio de ganancia por categoría de producto
      </p>
      
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={categoryData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            stroke="#6b7280"
          />
          <YAxis
            type="category"
            dataKey="category"
            width={90}
            stroke="#6b7280"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={() => 'Margen Promedio (%)'}
            wrapperStyle={{ paddingTop: '20px' }}
          />
          <Bar
            dataKey="averageMargin"
            radius={[0, 8, 8, 0]}
            label={{
              position: 'right',
              formatter: (value: unknown) => {
                const numValue = typeof value === 'number' ? value : 0;
                return `${numValue.toFixed(1)}%`;
              },
              fill: '#374151',
            }}
          >
            {categoryData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getMarginColor(entry.averageMargin)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
          <span className="text-gray-600">Alto (&ge; 40%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
          <span className="text-gray-600">Medio (&ge; 20%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-gray-600">Bajo (&lt; 20%)</span>
        </div>
      </div>
    </div>
  );
}
