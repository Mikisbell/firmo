/**
 * Dashboard de Rentabilidad - Componente Principal
 * 
 * Este componente implementa el dashboard completo de análisis de rentabilidad
 * con tabla de productos, gráficos y filtros.
 * 
 * Features:
 * - Tabla de productos con métricas financieras (precio, COGS, ganancia, margen)
 * - Gráficos de márgenes por categoría y evolución temporal
 * - Filtros por rango de fechas y categoría
 * - SWR con auto-revalidación cada 30 segundos
 * - Skeleton loaders para UX durante carga
 * - Exportación a CSV
 * - Multi-tenancy con tenant_id del usuario autenticado
 * 
 * Requirements: 7.1, 7.4, 7.5, 10.4, 10.5
 * 
 * @module app/admin/reports/profitability
 */

'use client';

import { useState, useMemo, lazy, Suspense, useCallback } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/src/lib/swr-config';
import { formatCents } from '@/src/core/domain/money';
import { TrendingUp, DollarSign, Percent, Package } from 'lucide-react';
import ProductsTable from './components/ProductsTable';
import ReportFilters from './components/ReportFilters';

// Lazy loading de gráficos para optimizar bundle inicial
const MarginChart = lazy(() => import('./components/MarginChart'));
const ProfitTrendChart = lazy(() => import('./components/ProfitTrendChart'));

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

interface ProfitabilityReport {
  products: ProductMetrics[];
  summary: {
    totalRevenueCents: number;
    totalCogsCents: number;
    totalProfitCents: number;
    averageMargin: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}

interface ProfitabilityResponse {
  success: boolean;
  data: ProfitabilityReport;
}

// ============================================================================
// Skeleton Loaders
// ============================================================================

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header */}
      <div className="h-12 bg-gray-200 rounded"></div>
      
      {/* Rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded"></div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-48"></div>
        <div className="h-4 bg-gray-100 rounded w-64"></div>
        <div className="h-80 bg-gray-100 rounded"></div>
      </div>
    </div>
  );
}

// ============================================================================
// Summary Cards
// ============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

function SummaryCard({ title, value, icon, trend, trendUp }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {trend && (
            <p className={`text-sm mt-2 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="p-3 bg-blue-50 rounded-full">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ProfitabilityDashboard() {
  // ============================================================================
  // State
  // ============================================================================
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // ============================================================================
  // Data Fetching con SWR
  // ============================================================================
  
  // Construir URL con filtros
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', new Date(startDate).toISOString());
    if (endDate) params.append('endDate', new Date(endDate).toISOString());
    if (selectedCategory) params.append('categoryIds', selectedCategory);
    
    return `/api/admin/reports/profitability?${params.toString()}`;
  }, [startDate, endDate, selectedCategory]);
  
  // SWR con auto-revalidación cada 30 segundos
  const { data, error, isLoading } = useSWR<ProfitabilityResponse>(
    apiUrl,
    fetcher,
    {
      refreshInterval: 30000, // 30 segundos
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );
  
  // ============================================================================
  // Derived Data
  // ============================================================================
  
  const report = data?.data;
  const products = report?.products || [];
  const summary = report?.summary;
  
  // Obtener categorías únicas para el filtro
  const categories = useMemo(() => {
    const uniqueCategories = new Set(products.map(p => p.category));
    return Array.from(uniqueCategories).sort();
  }, [products]);
  
  // ============================================================================
  // Handlers
  // ============================================================================
  
  /**
   * Handler para cambios de filtros (con debounce aplicado por ReportFilters)
   */
  const handleFiltersChange = useCallback((filters: {
    startDate: string;
    endDate: string;
    selectedCategory: string;
  }) => {
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setSelectedCategory(filters.selectedCategory);
  }, []);
  
  /**
   * Exportar datos a CSV
   * Requirement: 12.1, 12.2, 12.3, 12.4
   */
  const handleExportCSV = useCallback(() => {
    if (!products.length) return;
    
    // Crear encabezados en español
    const headers = [
      'Producto',
      'Categoría',
      'Precio (S/)',
      'COGS (S/)',
      'Ganancia (S/)',
      'Margen (%)',
      'Unidades Vendidas',
      'Ingresos Totales (S/)',
      'Ganancia Total (S/)',
    ];
    
    // Crear filas de datos
    const rows = products.map(p => [
      p.productName,
      p.category,
      formatCents(p.priceCents),
      formatCents(p.cogsCents),
      formatCents(p.profitCents),
      `${p.marginPercent.toFixed(2)}%`,
      p.unitsSold.toString(),
      formatCents(p.totalRevenueCents),
      formatCents(p.totalProfitCents),
    ]);
    
    // Combinar encabezados y filas
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
    
    // Crear blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `rentabilidad_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [products]);
  
  /**
   * Limpiar filtros
   */
  const handleClearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setSelectedCategory('');
  }, []);
  
  // ============================================================================
  // Render: Error State
  // ============================================================================
  
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error al cargar datos</h3>
          <p className="text-red-600 text-sm">
            {error.message || 'Ocurrió un error al obtener el reporte de rentabilidad'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // Render: Loading State
  // ============================================================================
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-100 rounded w-96"></div>
        </div>
        
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        
        {/* Filters Skeleton */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
        
        {/* Table Skeleton */}
        <div className="bg-white rounded-lg shadow p-6">
          <TableSkeleton />
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // Render: Empty State
  // ============================================================================
  
  if (!products.length) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <Package className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
          <h3 className="text-yellow-800 font-semibold text-lg mb-2">
            No hay datos de rentabilidad
          </h3>
          <p className="text-yellow-600 text-sm mb-4">
            No se encontraron productos con ventas en el período seleccionado.
          </p>
          {(startDate || endDate || selectedCategory) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // ============================================================================
  // Render: Main Dashboard
  // ============================================================================
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de Rentabilidad</h1>
        <p className="text-gray-600 mt-2">
          Análisis completo de ganancias, márgenes y COGS por producto
        </p>
      </div>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard
            title="Ingresos Totales"
            value={formatCents(summary.totalRevenueCents)}
            icon={<DollarSign className="w-6 h-6 text-blue-600" />}
          />
          <SummaryCard
            title="COGS Total"
            value={formatCents(summary.totalCogsCents)}
            icon={<Package className="w-6 h-6 text-orange-600" />}
          />
          <SummaryCard
            title="Ganancia Total"
            value={formatCents(summary.totalProfitCents)}
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            trendUp={summary.totalProfitCents > 0}
          />
          <SummaryCard
            title="Margen Promedio"
            value={`${summary.averageMargin.toFixed(2)}%`}
            icon={<Percent className="w-6 h-6 text-purple-600" />}
          />
        </div>
      )}
      
      {/* Filters */}
      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        selectedCategory={selectedCategory}
        categories={categories}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        onExport={handleExportCSV}
        disabled={isLoading}
      />
      
      {/* Products Table */}
      <ProductsTable products={products} />
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin Chart */}
        <Suspense fallback={<ChartSkeleton />}>
          <MarginChart products={products} />
        </Suspense>
        
        {/* Profit Trend Chart */}
        <Suspense fallback={<ChartSkeleton />}>
          <ProfitTrendChart
            products={products}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      </div>
      
      {/* Auto-refresh indicator */}
      <div className="text-center text-sm text-gray-500">
        Los datos se actualizan automáticamente cada 30 segundos
      </div>
    </div>
  );
}
