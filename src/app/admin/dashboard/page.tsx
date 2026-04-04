'use client';

/**
 * Premium Analytics Dashboard
 * Dashboard de metricas en tiempo real para administradores
 *
 * Features:
 * - KPIs en tiempo real (ventas, ordenes, ticket promedio)
 * - Comparacion con semana anterior
 * - Metricas por estacion KDS
 * - Top productos
 * - Ventas por hora
 * - Filtro de fecha para historico
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
import { Button, Card, MetricCard, PageHeader, EmptyState } from '@/src/components/ui';

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
          5000 // 5s TTL para datos historicos
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
          setError('No hay datos historicos para esta fecha');
        }
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Real-time data - fetch each API independently with error handling
      const [metricsResult, comparisonResult, topResult, hourlyResult] = await Promise.allSettled([
        cachedFetch<RealtimeMetrics>('/api/admin/analytics/realtime', { method: 'GET' }, 2000),
        cachedFetch<ComparisonMetrics>('/api/admin/analytics/comparison', { method: 'GET' }, 2000),
        cachedFetch<{ products: TopProduct[] }>('/api/admin/analytics/top-products?limit=5', { method: 'GET' }, 2000),
        cachedFetch<{ hourly: HourlySales[] }>('/api/admin/analytics/hourly', { method: 'GET' }, 2000),
      ]);

      const metricsData = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
      const comparisonData = comparisonResult.status === 'fulfilled' ? comparisonResult.value : null;
      const topData = topResult.status === 'fulfilled' ? topResult.value : null;
      const hourlyData = hourlyResult.status === 'fulfilled' ? hourlyResult.value : null;

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

      const failedApis = [metricsResult, comparisonResult, topResult, hourlyResult]
        .filter(r => r.status === 'rejected').length;

      if (failedApis > 0) {
        console.warn(`${failedApis} analytics APIs failed, showing partial data`);
        setError(null);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
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
      setError('Algunos datos no estan disponibles. Esto es normal si la base de datos esta vacia.');
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

  const formattedChartData = useMemo(() => {
    if (!hourlySales || hourlySales.length === 0) return [];

    return hourlySales.map(item => ({
      ...item,
      heightPercent: Math.max(...hourlySales.map(d => d.sales_cents), 1) > 0
        ? (item.sales_cents / Math.max(...hourlySales.map(d => d.sales_cents), 1)) * 100
        : 0,
    }));
  }, [hourlySales]);

  const hourlySalesTotals = useMemo(() => {
    if (!hourlySales || hourlySales.length === 0) {
      return { totalSales: 0, totalOrders: 0 };
    }

    return {
      totalSales: hourlySales.reduce((sum, d) => sum + d.sales_cents, 0),
      totalOrders: hourlySales.reduce((sum, d) => sum + d.orders_count, 0),
    };
  }, [hourlySales]);

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
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Analytics"
        description={`${isHistorical ? 'Datos historicos' : 'KPIs, ventas por hora, top productos'} — ${metrics?.business_date || selectedDate}`}
        actions={
          <div className="flex items-center gap-3">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-park-gray-800 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-park-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={getTodayDate()}
                className="bg-transparent text-sm focus:outline-none"
              />
            </div>
            {isHistorical && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDateChange(getTodayDate())}
              >
                Hoy
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
              onClick={fetchData}
              disabled={loading}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {error && (
        <Card padding="sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-300 mb-1">{error}</p>
              <p className="text-xs text-amber-400/70">
                Tip: Ejecuta el seed script para poblar la base de datos con datos de prueba.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Ventas del Turno"
          value={metrics ? formatCurrency(metrics.total_sales_cents) : 'S/ 0.00'}
          trend={comparison?.delta_percent.total_sales != null ? {
            value: Number(comparison.delta_percent.total_sales.toFixed(1)),
            isPositive: comparison.delta_percent.total_sales >= 0,
          } : undefined}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Ordenes"
          value={metrics?.orders_count?.toString() || '0'}
          trend={comparison?.delta_percent.orders_count != null ? {
            value: Number(comparison.delta_percent.orders_count.toFixed(1)),
            isPositive: comparison.delta_percent.orders_count >= 0,
          } : undefined}
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <MetricCard
          label="Ticket Promedio"
          value={metrics ? formatCurrency(metrics.avg_ticket_cents) : 'S/ 0.00'}
          trend={comparison?.delta_percent.avg_ticket != null ? {
            value: Number(comparison.delta_percent.avg_ticket.toFixed(1)),
            isPositive: comparison.delta_percent.avg_ticket >= 0,
          } : undefined}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Mesas Ocupadas"
          value={`${metrics?.tables_occupied || 0} / ${(metrics?.tables_occupied || 0) + (metrics?.tables_free || 0)}`}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Station Metrics + Top Products */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Station Metrics */}
        <Card padding="md">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-orange-400" />
            Estaciones KDS
            {stationStats.hasAlerts && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-normal">
                {stationStats.totalPending} pendientes
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {metrics?.stations && metrics.stations.length > 0 ? (
              (() => {
                const activeStations = metrics.stations.filter(s => s.pending_items > 0);
                const bottleneckStation = activeStations.length > 0
                  ? activeStations.reduce((max, s) => (s.load ?? 0) > (max.load ?? 0) ? s : max, activeStations[0])
                  : null;
                const bottleneckName = bottleneckStation && (bottleneckStation.load ?? 0) >= 50
                  ? bottleneckStation.station
                  : null;

                return metrics.stations
                  .filter(s => s.pending_items > 0 || (s.load ?? 0) > 0)
                  .map((station) => (
                    <StationCard
                      key={station.station}
                      station={station}
                      isBottleneck={station.station === bottleneckName}
                    />
                  ));
              })()
            ) : (
              <div className="col-span-2">
                <EmptyState
                  icon={<ChefHat />}
                  title="Sin datos de estaciones KDS"
                  description="Las estaciones apareceran cuando haya ordenes activas"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Top Products */}
        <Card padding="md">
          <h2 className="text-lg font-semibold mb-4">Top 5 Productos</h2>
          <div className="space-y-2">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <TopProductRow key={product.product_id} product={product} rank={index + 1} />
              ))
            ) : (
              <EmptyState
                icon={<ShoppingCart />}
                title="Sin ventas registradas"
                description="Los productos mas vendidos apareceran aqui"
              />
            )}
          </div>
        </Card>
      </div>

      {/* Payment Methods Breakdown */}
      {metrics?.sales_by_payment_method && (
        <Card padding="md">
          <h2 className="text-lg font-semibold mb-4">Ventas por Metodo de Pago</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(metrics.sales_by_payment_method).map(([method, cents]) => (
              <div key={method} className="text-center">
                <p className="text-xl font-bold">{formatCurrency(cents)}</p>
                <p className="text-xs text-park-gray-400 uppercase">{method}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hourly Sales Chart */}
      <Card padding="md">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Ventas por Hora
        </h2>
        <HourlySalesChart
          data={formattedChartData}
          totals={hourlySalesTotals}
          loading={loading}
        />
      </Card>

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-park-gray-400 text-right">
          Ultima actualizacion: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}


// ============ COMPONENTS ============

function StationCard({ station, isBottleneck }: { station: StationMetrics; isBottleneck?: boolean }) {
  const getStationIcon = (name: string) => {
    switch (name.toUpperCase()) {
      case 'PARRILLA': return Flame;
      case 'COCINA': return ChefHat;
      case 'HORNO': return Flame;
      case 'BAR': return Wine;
      case 'FRIOS': return ChefHat;
      case 'POSTRES': return ChefHat;
      default: return ChefHat;
    }
  };

  const Icon = getStationIcon(station.station);
  const hasAlert = station.has_alert;
  const load = station.load ?? 0;
  const efficiency = station.efficiency ?? 100;

  const loadColor = load >= 80 ? 'bg-red-500' : load >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  const effColor = efficiency < 70 ? 'text-red-400' : efficiency < 85 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className={`p-3 rounded-lg border transition-all ${
      isBottleneck ? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20' :
      hasAlert ? 'bg-red-500/10 border-red-500/30' :
      'bg-park-gray-800/50 border-transparent'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            hasAlert ? 'bg-red-500/20 text-red-400' : 'bg-park-gray-800 text-park-gray-400'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{station.station}</p>
            <p className="text-xs text-park-gray-400">
              {station.avg_prep_time_minutes > 0
                ? `~${station.avg_prep_time_minutes.toFixed(0)} min`
                : 'Sin datos'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${hasAlert ? 'text-red-400' : ''}`}>
            {station.pending_items}
          </p>
          <p className="text-[10px] text-park-gray-400 uppercase">pend.</p>
        </div>
      </div>

      {/* Load bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-park-gray-400">Carga</span>
          <span className="text-park-gray-300">{load}%</span>
        </div>
        <div className="h-1.5 bg-park-gray-800 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${loadColor}`} style={{ width: `${load}%` }} />
        </div>
      </div>

      {/* Efficiency + Oldest item */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold ${effColor}`}>{efficiency}% efic.</span>
        {station.oldest_item_minutes !== null && station.oldest_item_minutes > 0 && (
          <span className="text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {station.oldest_item_minutes.toFixed(0)}m
          </span>
        )}
      </div>

      {/* Bottleneck indicator */}
      {isBottleneck && (
        <div className="mt-2 text-[10px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Cuello de botella
        </div>
      )}
    </div>
  );
}

function TopProductRow({ product, rank }: { product: TopProduct; rank: number }) {
  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-park-gray-800/50 transition-colors">
      <div className="w-6 h-6 rounded-full bg-park-gray-800 flex items-center justify-center text-xs font-bold">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-xs text-park-gray-400">{product.sku}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{product.qty_sold}</p>
        <p className="text-xs text-park-gray-400">{formatCurrency(product.revenue_cents)}</p>
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
      <div className="h-48 flex items-center justify-center text-park-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Clock />}
        title="Sin datos de ventas por hora"
        description="El grafico se poblara conforme se registren ventas"
      />
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
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-center mb-1 whitespace-nowrap">
                <p className="font-bold">{formatCurrency(item.sales_cents)}</p>
                <p className="text-park-gray-400">{item.orders_count} ordenes</p>
              </div>
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
            <p className="text-[10px] text-park-gray-400">{formatHour(item.hour)}</p>
          </div>
        ))}
      </div>
      {/* Summary */}
      <div className="flex justify-between text-xs text-park-gray-400 pt-2 border-t border-park-gray-800">
        <span>Total: {formatCurrency(totals.totalSales)}</span>
        <span>{totals.totalOrders} ordenes</span>
      </div>
    </div>
  );
}
