'use client';

/**
 * Premium Analytics Dashboard
 * Dashboard de metricas en tiempo real para administradores
 *
 * Features:
 * - KPIs en tiempo real (ventas, ordenes, ticket promedio)
 * - Comparacion con periodo anterior
 * - Metricas por estacion KDS
 * - Top productos
 * - Ventas por hora
 * - Filtro de periodo (hoy, semana, mes) — sincronizado con URL
 * - Auto-refresh cada 30s (solo en "hoy")
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Clock,
  RefreshCw,
  AlertTriangle,
  ChefHat,
  Flame,
  Wine,
  BarChart3,
  Percent,
} from 'lucide-react';
import type {
  RealtimeMetrics,
  StationMetrics,
  TopProduct,
  ComparisonMetrics,
  HourlySales,
} from '@/src/core/analytics/types';
import { unsafeCentavos } from '@/src/core/types/shared';
import { cachedFetch } from '@/src/lib/fetch-cache';
import {
  Button,
  Card,
  MetricCard,
  PageHeader,
  EmptyState,
  SkeletonPage,
} from '@/src/components/ui';
import { useQueryState } from '@/src/hooks/useQueryState';

const REFRESH_INTERVAL = 30000; // 30 seconds

type Period = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Última semana',
  month: 'Último mes',
};

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function getDateRangeForPeriod(period: Period): { from: string; to: string } {
  const today = getTodayDate();
  switch (period) {
    case 'week':
      return { from: getDateDaysAgo(6), to: today };
    case 'month':
      return { from: getDateDaysAgo(29), to: today };
    case 'today':
    default:
      return { from: today, to: today };
  }
}

const EMPTY_METRICS: RealtimeMetrics = {
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
  business_date: getTodayDate(),
  shift_id: null,
  last_updated: new Date().toISOString(),
};

export default function AnalyticsDashboardPage() {
  const [period, setPeriod] = useQueryState<Period>('period', 'today');

  const [metrics, setMetrics] = useState<RealtimeMetrics | null>(null);
  const [comparison, setComparison] = useState<ComparisonMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (period !== 'today') {
        // Historical aggregate over period range
        const { from, to } = getDateRangeForPeriod(period);
        const historyData = await cachedFetch<any[]>(
          `/api/admin/analytics/history?from=${from}&to=${to}`,
          { method: 'GET' },
          5000,
        );

        if (historyData && historyData.length > 0) {
          // Aggregate totals across days
          const totalSales = historyData.reduce(
            (s, d) => s + (d.total_sales_cents || 0),
            0,
          );
          const ordersCount = historyData.reduce(
            (s, d) => s + (d.orders_count || 0),
            0,
          );
          const avgTicket = ordersCount > 0 ? Math.round(totalSales / ordersCount) : 0;

          const paymentMethodAgg = historyData.reduce(
            (acc, d) => {
              const pm = d.sales_by_payment_method || {};
              acc.CASH += pm.CASH || 0;
              acc.YAPE += pm.YAPE || 0;
              acc.PLIN += pm.PLIN || 0;
              acc.CARD += pm.CARD || 0;
              acc.TRANSFER += pm.TRANSFER || 0;
              return acc;
            },
            { CASH: 0, YAPE: 0, PLIN: 0, CARD: 0, TRANSFER: 0 },
          );

          setMetrics({
            ...EMPTY_METRICS,
            total_sales_cents: unsafeCentavos(totalSales),
            orders_count: ordersCount,
            avg_ticket_cents: unsafeCentavos(avgTicket),
            sales_by_payment_method: {
              CASH: unsafeCentavos(paymentMethodAgg.CASH),
              YAPE: unsafeCentavos(paymentMethodAgg.YAPE),
              PLIN: unsafeCentavos(paymentMethodAgg.PLIN),
              CARD: unsafeCentavos(paymentMethodAgg.CARD),
              TRANSFER: unsafeCentavos(paymentMethodAgg.TRANSFER),
            },
            business_date: `${from} → ${to}`,
          });
        } else {
          setMetrics({ ...EMPTY_METRICS, business_date: `${from} → ${to}` });
        }
        setComparison(null);
        setTopProducts([]);
        setHourlySales([]);
        setError(null);
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Real-time data for "today"
      const [metricsResult, comparisonResult, topResult, hourlyResult] =
        await Promise.allSettled([
          cachedFetch<RealtimeMetrics>(
            '/api/admin/analytics/realtime',
            { method: 'GET' },
            2000,
          ),
          cachedFetch<ComparisonMetrics>(
            '/api/admin/analytics/comparison',
            { method: 'GET' },
            2000,
          ),
          cachedFetch<{ products: TopProduct[] }>(
            '/api/admin/analytics/top-products?limit=5',
            { method: 'GET' },
            2000,
          ),
          cachedFetch<{ hourly: HourlySales[] }>(
            '/api/admin/analytics/hourly',
            { method: 'GET' },
            2000,
          ),
        ]);

      const metricsData =
        metricsResult.status === 'fulfilled' ? metricsResult.value : null;
      const comparisonData =
        comparisonResult.status === 'fulfilled' ? comparisonResult.value : null;
      const topData = topResult.status === 'fulfilled' ? topResult.value : null;
      const hourlyData =
        hourlyResult.status === 'fulfilled' ? hourlyResult.value : null;

      setMetrics(metricsData || EMPTY_METRICS);
      setComparison(comparisonData);
      setTopProducts(topData?.products || []);
      setHourlySales(hourlyData?.hourly || []);
      setLastUpdated(new Date());

      const failedApis = [metricsResult, comparisonResult, topResult, hourlyResult].filter(
        (r) => r.status === 'rejected',
      ).length;

      if (failedApis > 0) {
        console.warn(`${failedApis} analytics APIs failed, showing partial data`);
      }
      setError(null);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setMetrics(EMPTY_METRICS);
      setComparison(null);
      setTopProducts([]);
      setHourlySales([]);
      setError(
        'Algunos datos no estan disponibles. Esto es normal si la base de datos esta vacia.',
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh only for "today"
  useEffect(() => {
    if (period !== 'today') return;
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [period, fetchData]);

  const formattedChartData = useMemo(() => {
    if (!hourlySales || hourlySales.length === 0) return [];
    const maxSales = Math.max(...hourlySales.map((d) => d.sales_cents), 1);
    return hourlySales.map((item) => ({
      ...item,
      heightPercent: maxSales > 0 ? (item.sales_cents / maxSales) * 100 : 0,
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
      hasAlerts: metrics.stations.some((s) => s.has_alert),
      avgPrepTime:
        metrics.stations.reduce((sum, s) => sum + s.avg_prep_time_minutes, 0) /
        metrics.stations.length,
    };
  }, [metrics?.stations]);

  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

  const hasNoData = !loading && metrics !== null && metrics.orders_count === 0;

  // Show full skeleton on initial load (no data yet)
  if (loading && metrics === null) {
    return (
      <div className="p-4">
        <SkeletonPage />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Analytics"
        description={`KPIs y métricas — ${PERIOD_LABELS[period]}`}
        actions={
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            disabled={loading}
          >
            Actualizar
          </Button>
        }
      />

      {/* Period Selector (tabs) */}
      <div className="flex items-center gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

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
          label={period === 'today' ? 'Ventas del Turno' : 'Ventas del Periodo'}
          value={metrics ? formatCurrency(metrics.total_sales_cents) : 'S/ 0.00'}
          trend={
            comparison?.delta_percent.total_sales != null
              ? {
                  value: Number(comparison.delta_percent.total_sales.toFixed(1)),
                  isPositive: comparison.delta_percent.total_sales >= 0,
                }
              : undefined
          }
          icon={<DollarSign className="w-5 h-5" />}
        />
        <MetricCard
          label="Órdenes"
          value={metrics?.orders_count?.toString() || '0'}
          trend={
            comparison?.delta_percent.orders_count != null
              ? {
                  value: Number(comparison.delta_percent.orders_count.toFixed(1)),
                  isPositive: comparison.delta_percent.orders_count >= 0,
                }
              : undefined
          }
          icon={<ShoppingCart className="w-5 h-5" />}
        />
        <MetricCard
          label="Ticket Promedio"
          value={metrics ? formatCurrency(metrics.avg_ticket_cents) : 'S/ 0.00'}
          trend={
            comparison?.delta_percent.avg_ticket != null
              ? {
                  value: Number(comparison.delta_percent.avg_ticket.toFixed(1)),
                  isPositive: comparison.delta_percent.avg_ticket >= 0,
                }
              : undefined
          }
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          label="Órdenes/Hora"
          value={metrics?.orders_per_hour?.toFixed(1) || '0.0'}
          icon={<Percent className="w-5 h-5" />}
        />
      </div>

      {hasNoData ? (
        <Card padding="md">
          <EmptyState
            icon={<BarChart3 />}
            title="Sin datos para este período"
            description="No se registraron órdenes en el rango seleccionado. Probá con otro período o esperá a que ingresen ventas."
          />
        </Card>
      ) : (
        <>
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
                    const activeStations = metrics.stations.filter(
                      (s) => s.pending_items > 0,
                    );
                    const bottleneckStation =
                      activeStations.length > 0
                        ? activeStations.reduce(
                            (max, s) =>
                              (s.load ?? 0) > (max.load ?? 0) ? s : max,
                            activeStations[0],
                          )
                        : null;
                    const bottleneckName =
                      bottleneckStation && (bottleneckStation.load ?? 0) >= 50
                        ? bottleneckStation.station
                        : null;

                    const visible = metrics.stations.filter(
                      (s) => s.pending_items > 0 || (s.load ?? 0) > 0,
                    );

                    if (visible.length === 0) {
                      return (
                        <div className="col-span-2">
                          <EmptyState
                            icon={<ChefHat />}
                            title="Sin estaciones activas"
                            description="Las estaciones apareceran cuando haya ordenes activas"
                          />
                        </div>
                      );
                    }

                    return visible.map((station) => (
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
                    <TopProductRow
                      key={product.product_id}
                      product={product}
                      rank={index + 1}
                    />
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
              <h2 className="text-lg font-semibold mb-4">Ventas por Método de Pago</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(metrics.sales_by_payment_method).map(
                  ([method, cents]) => (
                    <div key={method} className="text-center">
                      <p className="text-xl font-bold tabular-nums text-white">
                        {formatCurrency(cents)}
                      </p>
                      <p className="text-xs text-park-gray-400 uppercase mt-1">
                        {method}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </Card>
          )}

          {/* Hourly Sales Chart — solo en "hoy" */}
          {period === 'today' && (
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
          )}
        </>
      )}

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-park-gray-400 text-right tabular-nums">
          Última actualización: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

// ============ COMPONENTS ============

function StationCard({
  station,
  isBottleneck,
}: {
  station: StationMetrics;
  isBottleneck?: boolean;
}) {
  const getStationIcon = (name: string) => {
    switch (name.toUpperCase()) {
      case 'PARRILLA':
        return Flame;
      case 'COCINA':
        return ChefHat;
      case 'HORNO':
        return Flame;
      case 'BAR':
        return Wine;
      case 'FRIOS':
        return ChefHat;
      case 'POSTRES':
        return ChefHat;
      default:
        return ChefHat;
    }
  };

  const Icon = getStationIcon(station.station);
  const hasAlert = station.has_alert;
  const load = station.load ?? 0;
  const efficiency = station.efficiency ?? 100;

  const loadColor =
    load >= 80 ? 'bg-red-500' : load >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  const effColor =
    efficiency < 70
      ? 'text-red-400'
      : efficiency < 85
        ? 'text-yellow-400'
        : 'text-green-400';

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isBottleneck
          ? 'bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20'
          : hasAlert
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-park-gray-800/50 border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              hasAlert
                ? 'bg-red-500/20 text-red-400'
                : 'bg-park-gray-800 text-park-gray-400'
            }`}
          >
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{station.station}</p>
            <p className="text-xs text-park-gray-400 tabular-nums">
              {station.avg_prep_time_minutes > 0
                ? `~${station.avg_prep_time_minutes.toFixed(0)} min`
                : 'Sin datos'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={`text-lg font-bold tabular-nums ${hasAlert ? 'text-red-400' : ''}`}
          >
            {station.pending_items}
          </p>
          <p className="text-[10px] text-park-gray-400 uppercase">pend.</p>
        </div>
      </div>

      {/* Load bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-park-gray-400">Carga</span>
          <span className="text-park-gray-300 tabular-nums">{load}%</span>
        </div>
        <div className="h-1.5 bg-park-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${loadColor}`}
            style={{ width: `${load}%` }}
          />
        </div>
      </div>

      {/* Efficiency + Oldest item */}
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold tabular-nums ${effColor}`}>{efficiency}% efic.</span>
        {station.oldest_item_minutes !== null && station.oldest_item_minutes > 0 && (
          <span className="text-amber-400 flex items-center gap-1 tabular-nums">
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
      <div className="w-6 h-6 rounded-full bg-park-gray-800 flex items-center justify-center text-xs font-bold tabular-nums">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{product.name}</p>
        <p className="text-xs text-park-gray-400">{product.sku}</p>
      </div>
      <div className="text-right">
        <p className="font-bold tabular-nums">{product.qty_sold}</p>
        <p className="text-xs text-park-gray-400 tabular-nums">
          {formatCurrency(product.revenue_cents)}
        </p>
      </div>
    </div>
  );
}

function HourlySalesChart({
  data,
  totals,
  loading,
}: {
  data: (HourlySales & { heightPercent?: number })[];
  totals: { totalSales: number; totalOrders: number };
  loading?: boolean;
}) {
  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(0)}`;
  const formatHour = (hour: number) => `${hour.toString().padStart(2, '0')}:00`;

  if (loading && data.length === 0) {
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
        description="El gráfico se poblará conforme se registren ventas"
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
            <div key={item.hour} className="flex-1 flex flex-col items-center group">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-center mb-1 whitespace-nowrap">
                <p className="font-bold tabular-nums">
                  {formatCurrency(item.sales_cents)}
                </p>
                <p className="text-park-gray-400 tabular-nums">
                  {item.orders_count} órdenes
                </p>
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPercent}%` }}
                transition={{ duration: 0.5, delay: item.hour * 0.02 }}
                className="w-full bg-park-brand-600 rounded-t min-h-[4px] hover:bg-park-brand-500 transition-colors cursor-pointer"
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
            <p className="text-[10px] text-park-gray-400 tabular-nums">
              {formatHour(item.hour)}
            </p>
          </div>
        ))}
      </div>
      {/* Summary */}
      <div className="flex justify-between text-xs text-park-gray-400 pt-2 border-t border-park-gray-800 tabular-nums">
        <span>Total: {formatCurrency(totals.totalSales)}</span>
        <span>{totals.totalOrders} órdenes</span>
      </div>
    </div>
  );
}
