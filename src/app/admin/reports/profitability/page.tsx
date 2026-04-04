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
import { Button, Card, PageHeader, MetricCard, EmptyState } from '@/src/components/ui';

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
      <div className="h-12 bg-park-gray-800 rounded"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-park-gray-800 rounded"></div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-32 bg-park-gray-800 rounded-xl"></div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-park-gray-800 rounded w-48"></div>
        <div className="h-4 bg-park-gray-800 rounded w-64"></div>
        <div className="h-80 bg-park-gray-800 rounded"></div>
      </div>
    </Card>
  );
}

// ============================================================================
// Summary Cards
// ============================================================================

// SummaryCard replaced by MetricCard from Design System

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
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <h3 className="text-red-400 font-semibold mb-2">Error al cargar datos</h3>
          <p className="text-red-400/80 text-sm">
            {error.message || 'Ocurrió un error al obtener el reporte de rentabilidad'}
          </p>
          <Button variant="destructive" onClick={() => window.location.reload()} className="mt-4">
            Reintentar
          </Button>
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
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <Card>
          <TableSkeleton />
        </Card>
      </div>
    );
  }
  
  // ============================================================================
  // Render: Empty State
  // ============================================================================
  
  if (!products.length) {
    return (
      <div className="p-6">
        <PageHeader title="Rentabilidad" description="Análisis completo de ganancias, márgenes y COGS por producto" />
        <Card padding="none">
          <EmptyState
            icon={<Package />}
            title="No hay datos de rentabilidad"
            description="No se encontraron productos con ventas en el período seleccionado."
            action={(startDate || endDate || selectedCategory) ? { label: 'Limpiar Filtros', onClick: handleClearFilters } : undefined}
          />
        </Card>
      </div>
    );
  }
  
  // ============================================================================
  // Render: Main Dashboard
  // ============================================================================
  
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rentabilidad"
        description="Análisis completo de ganancias, márgenes y COGS por producto"
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            label="Ingresos Totales"
            value={formatCents(summary.totalRevenueCents)}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            label="COGS Total"
            value={formatCents(summary.totalCogsCents)}
            icon={<Package className="w-5 h-5" />}
          />
          <MetricCard
            label="Ganancia Total"
            value={formatCents(summary.totalProfitCents)}
            icon={<TrendingUp className="w-5 h-5" />}
            trend={summary.totalProfitCents > 0 ? { value: summary.averageMargin, isPositive: true } : undefined}
          />
          <MetricCard
            label="Margen Promedio"
            value={`${summary.averageMargin.toFixed(2)}%`}
            icon={<Percent className="w-5 h-5" />}
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
      <div className="text-center text-sm text-park-gray-500">
        Los datos se actualizan automáticamente cada 30 segundos
      </div>
    </div>
  );
}
