'use client';

/**
 * Premium Analytics Dashboard
 * Dashboard de métricas en tiempo real para administradores
 * 
 * Features:
 * - KPIs en tiempo real (ventas, órdenes, ticket promedio)
 * - Comparación con semana anterior
 * - Métricas por estación KDS
 * - Top productos
 * - Ventas por hora
 * - Filtro de fecha para histórico
 * - Auto-refresh cada 30s
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 3.1
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Users,
  Clock,
  RefreshCw,
  AlertTriangle,
  ChefHat,
  Flame,
  Wine,
  Calendar,
} from 'lucide-react';
import type { RealtimeMetrics, StationMetrics, TopProduct, ComparisonMetrics, HourlySales } from '@/src/core/analytics/types';
import { unsafeCentavos } from '@/src/core/types/shared';
import { cachedFetch } from '@/src/lib/fetch-cache';

const REFRESH_INTERVAL = 30000; // 30 seconds

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export default function AnalyticsDashboardPage() {
  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [isHistorical, setIsHistorical] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // If viewing historical data, use history endpoint
      if (isHistorical && selectedDate !== getTodayDate()) {
        const historyData = await cachedFetch<any[]>(
          `/api/admin/analytics/history?from=${selectedDate}&to=${selectedDate}`,
          { method: 'GET' },
          5000 // 5s TTL para datos históricos
        );
        
        if (historyData && historyData.length > 0) {
          const dayData = historyData[0];
          setMetrics({
            ...dayData,
            stations: [],
            tables_occupied: 0,
            tables_free: 0,
            table_turnover: 0,
            avg_service_time_minutes: 0,
            orders_per_hour: 0,
            shift_id: null,
          });
          setComparison(null);
          setTopProducts([]);
          setHourlySales([]);
        } else {
          setError('No hay datos históricos para esta fecha');
        }
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Real-time data - fetch each API independently with error handling
      // Usar cachedFetch con TTL corto (2s) para datos en tiempo real
      const [metricsResult, comparisonResult, topResult, hourlyResult] = await Promise.allSettled([
        cachedFetch<RealtimeMetrics>('/api/admin/analytics/realtime', { method: 'GET' }, 2000),
        cachedFetch<ComparisonMetrics>('/api/admin/analytics/comparison', { method: 'GET' }, 2000),
        cachedFetch<{ products: TopProduct[] }>('/api/admin/analytics/top-products?limit=5', { method: 'GET' }, 2000),
        cachedFetch<{ hourly: HourlySales[] }>('/api/admin/analytics/hourly', { method: 'GET' }, 2000),
      ]);

      // Extract data with fallbacks
      const metricsData = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
      const comparisonData = comparisonResult.status === 'fulfilled' ? comparisonResult.value : null;
      const topData = topResult.status === 'fulfilled' ? topResult.value : null;
      const hourlyData = hourlyResult.status === 'fulfilled' ? hourlyResult.value : null;

      // Set data with defaults for missing sections
      setMetrics(metricsData || {
        total_sales_cents: unsafeCentavos(0),
        orders_count: 0,
        avg_ticket_cents: unsafeCentavos(0),
        tables_occupied: 0,
        tables_free: 0,
        table_turnover: 0,
        avg_service_time_minutes: 0,
        orders_per_hour: 0,
        stations: [],
        sales_by_payment_method: {
          CASH: unsafeCentavos(0),
          YAPE: unsafeCentavos(0),
          PLIN: unsafeCentavos(0),
          CARD: unsafeCentavos(0),
          TRANSFER: unsafeCentavos(0),
        },
        business_date: selectedDate,
        shift_id: null,
        last_updated: new Date().toISOString(),
      });
      setComparison(comparisonData);
      setTopProducts(topData?.products || []);
      setHourlySales(hourlyData?.hourly || []);
      setLastUpdated(new Date());
      
      // Show warning if some APIs failed but don't block the whole page
      const failedApis = [metricsResult, comparisonResult, topResult, hourlyResult]
        .filter(r => r.status === 'rejected').length;
      
      if (failedApis > 0) {
        console.warn(`${failedApis} analytics APIs failed, showing partial data`);
        setError(null); // Don't show error, just show empty states
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      // Set empty defaults so page still renders
      setMetrics({
        total_sales_cents: unsafeCentavos(0),
        orders_count: 0,
        avg_ticket_cents: unsafeCentavos(0),
        tables_occupied: 0,
        tables_free: 0,
        table_turnover: 0,
        avg_service_time_minutes: 0,
        orders_per_hour: 0,
        stations: [],
        sales_by_payment_method: {
          CASH: unsafeCentavos(0),
          YAPE: unsafeCentavos(0),
          PLIN: unsafeCentavos(0),
          CARD: unsafeCentavos(0),
          TRANSFER: unsafeCentavos(0),
        },
        business_date: selectedDate,
        shift_id: null,
        last_updated: new Date().toISOString(),
      });
      setComparison(null);
      setTopProducts([]);
      setHourlySales([]);
      setError('Algunos datos no están disponibles. Esto es normal si la base de datos está vacía.');
    } finally {
      setLoading(false);
    }
  }, [isHistorical, selectedDate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle date change
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setIsHistorical(date !== getTodayDate());
    setLoading(true);
  };

  // Refetch when date changes
  useEffect(() => {
    fetchData();
  }, [selectedDate, isHistorical, fetchData]);

  // === STRATEGY 3: useMemo para cálculos derivados ===
  
  // Formatear datos de chart con useMemo
  const formattedChartData = useMemo(() => {
    if (!hourlySales || hourlySales.length === 0) return [];
    
    return hourlySales.map(item => ({
      ...item,
      heightPercent: Math.max(...hourlySales.map(d => d.sales_cents), 1) > 0
        ? (item.sales_cents / Math.max(...hourlySales.map(d => d.sales_cents), 1)) * 100
        : 0,
    }));
  }, [hourlySales]);

  // Calcular totales de ventas por hora con useMemo
  const hourlySalesTotals = useMemo(() => {
    if (!hourlySales || hourlySales.length === 0) {
      return { totalSales: 0, totalOrders: 0 };
    }
    
    return {
      totalSales: hourlySales.reduce((sum, d) => sum + d.sales_cents, 0),
      totalOrders: hourlySales.reduce((sum, d) => sum + d.orders_count, 0),
    };
  }, [hourlySales]);

  // Calcular estadísticas de estaciones con useMemo
  const stationStats = useMemo(() => {
    if (!metrics?.stations || metrics.stations.length === 0) {
      return { totalPending: 0, hasAlerts: false, avgPrepTime: 0 };
    }
    
    return {
      totalPending: metrics.stations.reduce((sum, s) => sum + s.pending_items, 0),
      hasAlerts: metrics.stations.some(s => s.has_alert),
      avgPrepTime: metrics.stations.reduce((sum, s) => sum + s.avg_prep_time_minutes, 0) / metrics.stations.length,
    };
  }, [metrics?.stations]);

  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-zinc-400 mt-1">
            {isHistorical ? 'Datos históricos' : 'Métricas en tiempo real'} • {metrics?.business_date || selectedDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={getTodayDate()}
              className="bg-transparent text-sm focus:outline-none"
            />
          </div>
          {isHistorical && (
            <button
              onClick={() => handleDateChange(getTodayDate())}
              className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
            >
              Hoy
            </button>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">{error}</p>
              <p className="text-xs text-amber-400/70">
                Tip: Ejecuta el seed script para poblar la base de datos con datos de prueba.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Ventas del Turno"
          value={metrics ? formatCurrency(metrics.total_sales_cents) : 'S/ 0.00'}
          delta={comparison?.delta_percent.total_sales}
          icon={DollarSign}
          loading={loading}
          testId="total-revenue"
        />
        <KPICard
          label="Órdenes"
          value={metrics?.orders_count?.toString() || '0'}
          delta={comparison?.delta_percent.orders_count}
          icon={ShoppingCart}
          loading={loading}
        />
        <KPICard
          label="Ticket Promedio"
          value={metrics ? formatCurrency(metrics.avg_ticket_cents) : 'S/ 0.00'}
          delta={comparison?.delta_percent.avg_ticket}
          icon={TrendingUp}
          loading={loading}
        />
        <KPICard
          label="Mesas Ocupadas"
          value={`${metrics?.tables_occupied || 0} / ${(metrics?.tables_occupied || 0) + (metrics?.tables_free || 0)}`}
          icon={Users}
          loading={loading}
        />
      </div>

      {/* Station Metrics + Top Products */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Station Metrics */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-400" />
            Estaciones KDS
          </h2>
          <div className="space-y-3">
            {metrics?.stations && metrics.stations.length > 0 ? (
              metrics.stations.map((station) => (
                <StationCard key={station.station} station={station} />
              ))
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin datos de estaciones KDS</p>
                <p className="text-xs mt-1 text-zinc-600">
                  Las estaciones aparecerán cuando haya órdenes activas
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h2 className="text-lg font-semibold mb-4">Top 5 Productos</h2>
          <div className="space-y-2">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <TopProductRow key={product.product_id} product={product} rank={index + 1} />
              ))
            ) : (
              <div className="text-center py-8 text-zinc-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sin ventas registradas</p>
                <p className="text-xs mt-1 text-zinc-600">
                  Los productos más vendidos aparecerán aquí
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      {metrics?.sales_by_payment_method && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h2 className="text-lg font-semibold mb-4">Ventas por Método de Pago</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(metrics.sales_by_payment_method).map(([method, cents]) => (
              <div key={method} className="text-center">
                <p className="text-xl font-bold">{formatCurrency(cents)}</p>
                <p className="text-xs text-zinc-500 uppercase">{method}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly Sales Chart */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Ventas por Hora
        </h2>
        <HourlySalesChart 
          data={formattedChartData} 
          totals={hourlySalesTotals}
          loading={loading} 
        />
      </div>

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-zinc-500 text-right">
          Última actualización: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}


// ============ COMPONENTS ============

function KPICard({
  label,
  value,
  delta,
  icon: Icon,
  loading,
  testId,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: React.ElementType;
  loading?: boolean;
  testId?: string;
}) {
  const isPositive = delta !== undefined && delta >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
    >
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-blue-400">
          <Icon className="w-5 h-5" />
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            <TrendIcon className="w-3 h-3" />
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </div>
        )}
      </div>
      <p className={`text-2xl font-bold mt-3 ${loading ? 'animate-pulse' : ''}`} data-testid={testId}>
        {loading ? '...' : value}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
    </motion.div>
  );
}

function StationCard({ station }: { station: StationMetrics }) {
  const getStationIcon = (name: string) => {
    switch (name.toUpperCase()) {
      case 'COCINA': return ChefHat;
      case 'HORNO': return Flame;
      case 'BAR': return Wine;
      default: return ChefHat;
    }
  };

  const Icon = getStationIcon(station.station);
  const hasAlert = station.has_alert;

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${hasAlert ? 'bg-red-500/10 border border-red-500/30' : 'bg-zinc-800/50'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasAlert ? 'bg-red-500/20 text-red-400' : 'bg-zinc-700 text-zinc-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium">{station.station}</p>
          <p className="text-xs text-zinc-500">
            {station.avg_prep_time_minutes > 0 
              ? `~${station.avg_prep_time_minutes.toFixed(0)} min prep`
              : 'Sin datos de tiempo'}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-lg font-bold ${hasAlert ? 'text-red-400' : ''}`}>
          {station.pending_items}
        </p>
        <p className="text-xs text-zinc-500">pendientes</p>
        {station.oldest_item_minutes !== null && station.oldest_item_minutes > 0 && (
          <p className="text-xs text-amber-400 flex items-center gap-1 justify-end mt-1">
            <Clock className="w-3 h-3" />
            {station.oldest_item_minutes.toFixed(0)}m más antiguo
          </p>
        )}
      </div>
    </div>
  );
}

function TopProductRow({ product, rank }: { product: TopProduct; rank: number }) {
  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors">
      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-xs text-zinc-500">{product.sku}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{product.qty_sold}</p>
        <p className="text-xs text-zinc-500">{formatCurrency(product.revenue_cents)}</p>
      </div>
    </div>
  );
}

function HourlySalesChart({ 
  data, 
  totals,
  loading 
}: { 
  data: (HourlySales & { heightPercent?: number })[]; 
  totals: { totalSales: number; totalOrders: number };
  loading?: boolean;
}) {
  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(0)}`;
  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-500">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-zinc-500">
        <Clock className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Sin datos de ventas por hora</p>
        <p className="text-xs mt-1 text-zinc-600">
          El gráfico se poblará conforme se registren ventas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Chart */}
      <div className="flex items-end gap-1 h-40">
        {data.map((item) => {
          const heightPercent = item.heightPercent || 0;
          return (
            <div
              key={item.hour}
              className="flex-1 flex flex-col items-center group"
            >
              {/* Tooltip on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-center mb-1 whitespace-nowrap">
                <p className="font-bold">{formatCurrency(item.sales_cents)}</p>
                <p className="text-zinc-500">{item.orders_count} órdenes</p>
              </div>
              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPercent}%` }}
                transition={{ duration: 0.5, delay: item.hour * 0.02 }}
                className="w-full bg-blue-500 rounded-t min-h-[4px] hover:bg-blue-400 transition-colors cursor-pointer"
                style={{ minHeight: item.sales_cents > 0 ? '4px' : '0' }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1">
        {data.map((item) => (
          <div key={item.hour} className="flex-1 text-center">
            <p className="text-[10px] text-zinc-500">{formatHour(item.hour)}</p>
          </div>
        ))}
      </div>
      {/* Summary - Usar datos pre-calculados */}
      <div className="flex justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800">
        <span>Total: {formatCurrency(totals.totalSales)}</span>
        <span>{totals.totalOrders} órdenes</span>
      </div>
    </div>
  );
}
