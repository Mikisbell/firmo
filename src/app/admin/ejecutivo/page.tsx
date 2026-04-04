'use client';

import { useState, useMemo, lazy, Suspense } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Receipt,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useExecutiveDashboard } from '@/src/hooks/useSWRHooks';
import type {
  PeriodRange,
  PeriodPreset,
  ExecutiveDashboardData,
  PaymentMethodSummary,
  TopProfitableProduct,
  OperationalAlert,
  DataSourceStatus,
} from '@/src/core/types/executive-dashboard';
import { Button, Card, MetricCard, PageHeader } from '@/src/components/ui';

const LazyHourlySalesChart = lazy(() => import('./components/HourlySalesChart'));
const LazyPaymentDonut = lazy(() => import('./components/PaymentDonut'));
const LazyMarginBar = lazy(() => import('./components/MarginBar'));

function formatCents(cents: number): string {
  return `S/. ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getPeriodDates(preset: PeriodPreset): { start: string; end: string } {
  const today = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case 'today':
      return { start: toISO(today), end: toISO(today) };
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      return { start: toISO(weekStart), end: toISO(today) };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: toISO(monthStart), end: toISO(today) };
    }
    default:
      return { start: toISO(today), end: toISO(today) };
  }
}

// --- Sub-components ---

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodRange;
  onChange: (p: PeriodRange) => void;
}) {
  const presets: { key: PeriodPreset; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ];

  return (
    <div className="flex items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.key}
          variant={value.preset === p.key ? 'primary' : 'secondary'}
          size="sm"
          onClick={() =>
            onChange({ preset: p.key, ...getPeriodDates(p.key) })
          }
        >
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-1 ml-2">
        <input
          type="date"
          value={value.start}
          max={value.end}
          onChange={(e) =>
            onChange({ preset: 'custom', start: e.target.value, end: value.end })
          }
          className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-2 py-1.5 text-sm text-park-gray-300"
        />
        <span className="text-park-gray-400 text-sm">—</span>
        <input
          type="date"
          value={value.end}
          min={value.start}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) =>
            onChange({ preset: 'custom', start: value.start, end: e.target.value })
          }
          className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-2 py-1.5 text-sm text-park-gray-300"
        />
      </div>
    </div>
  );
}

function AlertBanner({ alerts }: { alerts: OperationalAlert[] }) {
  if (alerts.length === 0) return null;

  const iconMap = {
    critical: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-400 shrink-0" />,
  };

  const bgMap = {
    critical: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${bgMap[alert.severity]}`}
        >
          {iconMap[alert.severity]}
          <span className="text-sm text-park-gray-300">{alert.message}</span>
        </div>
      ))}
    </div>
  );
}

function TopProductsTable({ products }: { products: TopProfitableProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="text-park-gray-400 text-sm py-4 text-center">
        Sin datos de productos
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-park-gray-400 border-b border-park-gray-800">
          <th className="text-left py-2 font-medium">Producto</th>
          <th className="text-right py-2 font-medium">Vendidos</th>
          <th className="text-right py-2 font-medium">Ganancia</th>
          <th className="text-right py-2 font-medium">Margen</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr
            key={p.productId}
            className="border-b border-park-gray-800/50 last:border-0"
          >
            <td className="py-2.5">
              <div className="text-park-gray-200">{p.productName}</div>
              <div className="text-park-gray-400 text-xs">{p.category}</div>
            </td>
            <td className="text-right text-park-gray-300">{p.unitsSold}</td>
            <td className="text-right text-emerald-400 font-medium">
              {formatCents(Number(p.totalProfitCents))}
            </td>
            <td className="text-right">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                  Number(p.marginPercent) >= 40
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : Number(p.marginPercent) >= 20
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-red-500/15 text-red-400'
                }`}
              >
                {formatPercent(Number(p.marginPercent))}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SourceIndicator({ sources }: { sources: DataSourceStatus }) {
  const items = [
    { key: 'dailyKpis', label: 'KPIs' },
    { key: 'pnl', label: 'P&L' },
    { key: 'profitability', label: 'Rentabilidad' },
  ] as const;

  return (
    <div className="flex items-center gap-3 text-xs">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-1">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              sources[item.key] === 'ok'
                ? 'bg-emerald-400'
                : 'bg-red-400'
            }`}
          />
          <span className="text-park-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// --- Main page ---

export default function EjecutivoDashboardPage() {
  const [period, setPeriod] = useState<PeriodRange>({
    preset: 'today',
    ...getPeriodDates('today'),
  });

  const { data, error, isLoading, mutate } = useExecutiveDashboard(period);

  const chartFallback = (
    <div className="flex items-center justify-center h-48 text-park-gray-600">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );

  if (error) {
    return (
      <div className="p-4">
        <Card padding="md">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">Error al cargar dashboard</p>
            <Button
              variant="secondary"
              onClick={() => mutate()}
              className="mt-3"
            >
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <PageHeader
        title="Dashboard Ejecutivo"
        description="Vista unificada de rentabilidad"
        actions={
          <div className="flex items-center gap-4">
            <PeriodSelector value={period} onChange={setPeriod} />
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => mutate()}
              disabled={isLoading}
            />
          </div>
        }
      />

      {isLoading && !data ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : data ? (
        <>
          {/* Alerts */}
          <AlertBanner alerts={data.alerts} />

          {/* Hero KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Ventas Netas"
              value={data.netSalesCents}
              format="currency"
              trend={data.comparison?.netSalesDelta != null ? {
                value: Number(data.comparison.netSalesDelta.toFixed(1)),
                isPositive: data.comparison.netSalesDelta >= 0,
              } : undefined}
              icon={<DollarSign className="w-5 h-5" />}
            />
            <MetricCard
              label="Utilidad Bruta"
              value={`${formatCents(data.grossProfitCents)} (${formatPercent(data.grossMarginPercent)})`}
              trend={data.comparison?.grossProfitDelta != null ? {
                value: Number(data.comparison.grossProfitDelta.toFixed(1)),
                isPositive: data.comparison.grossProfitDelta >= 0,
              } : undefined}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <MetricCard
              label="Gastos Operativos"
              value={data.operatingExpensesCents}
              format="currency"
              icon={<Receipt className="w-5 h-5" />}
            />
            <MetricCard
              label="Utilidad Neta"
              value={`${formatCents(data.netIncomeCents)} (${formatPercent(data.netMarginPercent)})`}
              trend={data.comparison?.netIncomeDelta != null ? {
                value: Number(data.comparison.netIncomeDelta.toFixed(1)),
                isPositive: data.comparison.netIncomeDelta >= 0,
              } : undefined}
              icon={<DollarSign className="w-5 h-5" />}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
            <MetricCard
              label="Ordenes"
              value={data.ordersCount.toLocaleString()}
              trend={data.comparison?.ordersCountDelta != null ? {
                value: Number(data.comparison.ordersCountDelta.toFixed(1)),
                isPositive: data.comparison.ordersCountDelta >= 0,
              } : undefined}
              icon={<ShoppingCart className="w-5 h-5" />}
            />
            <MetricCard
              label="Ticket Promedio"
              value={data.avgTicketCents}
              format="currency"
              icon={<Receipt className="w-5 h-5" />}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Hourly Sales */}
            <Card padding="md" className="lg:col-span-2">
              <h3 className="text-sm font-medium text-park-gray-400 mb-3">
                Ventas por Hora {period.preset !== 'today' && '— Hoy'}
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyHourlySalesChart data={data.hourlySales} />
              </Suspense>
            </Card>

            {/* Payment breakdown */}
            <Card padding="md">
              <h3 className="text-sm font-medium text-park-gray-400 mb-3">
                Metodos de Pago
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyPaymentDonut data={data.paymentBreakdown} />
              </Suspense>
            </Card>
          </div>

          {/* Bottom row: Top products + Margin by category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card padding="md">
              <h3 className="text-sm font-medium text-park-gray-400 mb-3">
                Top 5 Productos Rentables
              </h3>
              <TopProductsTable products={data.topProducts} />
            </Card>

            <Card padding="md">
              <h3 className="text-sm font-medium text-park-gray-400 mb-3">
                Margen por Categoria
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyMarginBar products={data.topProducts} />
              </Suspense>
            </Card>
          </div>

          {/* Footer: source status + generated time */}
          <div className="flex items-center justify-between pt-2 border-t border-park-gray-800">
            <SourceIndicator sources={data.sources} />
            <span className="text-xs text-park-gray-600">
              Actualizado: {new Date(data.generatedAt).toLocaleTimeString('es-PE')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
