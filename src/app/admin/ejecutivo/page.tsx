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
        <button
          key={p.key}
          onClick={() =>
            onChange({ preset: p.key, ...getPeriodDates(p.key) })
          }
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            value.preset === p.key
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
          }`}
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-2">
        <input
          type="date"
          value={value.start}
          max={value.end}
          onChange={(e) =>
            onChange({ preset: 'custom', start: e.target.value, end: value.end })
          }
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-300"
        />
        <span className="text-zinc-500 text-sm">—</span>
        <input
          type="date"
          value={value.end}
          min={value.start}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) =>
            onChange({ preset: 'custom', start: value.start, end: e.target.value })
          }
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-zinc-300"
        />
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  delta,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  delta: number | null;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-sm">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
      {delta !== null && (
        <div className="flex items-center gap-1 mt-1">
          {delta >= 0 ? (
            <TrendingUp className="w-3 h-3 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span
            className={`text-xs font-medium ${
              delta >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {formatPercent(delta)} vs período anterior
          </span>
        </div>
      )}
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
          <span className="text-sm text-zinc-300">{alert.message}</span>
        </div>
      ))}
    </div>
  );
}

function TopProductsTable({ products }: { products: TopProfitableProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="text-zinc-500 text-sm py-4 text-center">
        Sin datos de productos
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-zinc-500 border-b border-zinc-800">
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
            className="border-b border-zinc-800/50 last:border-0"
          >
            <td className="py-2.5">
              <div className="text-zinc-200">{p.productName}</div>
              <div className="text-zinc-500 text-xs">{p.category}</div>
            </td>
            <td className="text-right text-zinc-300">{p.unitsSold}</td>
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
          <span className="text-zinc-500">{item.label}</span>
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
    <div className="flex items-center justify-center h-48 text-zinc-600">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">Error al cargar dashboard</p>
          <button
            onClick={() => mutate()}
            className="mt-3 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Dashboard Ejecutivo
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Vista unificada del negocio
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            onClick={() => mutate()}
            disabled={isLoading}
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

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
            <KPICard
              label="Ventas Netas"
              value={formatCents(data.netSalesCents)}
              delta={data.comparison?.netSalesDelta ?? null}
              icon={DollarSign}
              color="text-emerald-400"
            />
            <KPICard
              label="Utilidad Bruta"
              value={`${formatCents(data.grossProfitCents)} (${formatPercent(data.grossMarginPercent)})`}
              delta={data.comparison?.grossProfitDelta ?? null}
              icon={TrendingUp}
              color="text-blue-400"
            />
            <KPICard
              label="Gastos Operativos"
              value={formatCents(data.operatingExpensesCents)}
              delta={null}
              icon={Receipt}
              color="text-amber-400"
            />
            <KPICard
              label="Utilidad Neta"
              value={`${formatCents(data.netIncomeCents)} (${formatPercent(data.netMarginPercent)})`}
              delta={data.comparison?.netIncomeDelta ?? null}
              icon={DollarSign}
              color={data.netIncomeCents >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
            <KPICard
              label="Órdenes"
              value={data.ordersCount.toLocaleString()}
              delta={data.comparison?.ordersCountDelta ?? null}
              icon={ShoppingCart}
              color="text-violet-400"
            />
            <KPICard
              label="Ticket Promedio"
              value={formatCents(data.avgTicketCents)}
              delta={null}
              icon={Receipt}
              color="text-cyan-400"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Hourly Sales */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 lg:col-span-2">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                Ventas por Hora {period.preset !== 'today' && '— Hoy'}
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyHourlySalesChart data={data.hourlySales} />
              </Suspense>
            </div>

            {/* Payment breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                Métodos de Pago
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyPaymentDonut data={data.paymentBreakdown} />
              </Suspense>
            </div>
          </div>

          {/* Bottom row: Top products + Margin by category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                Top 5 Productos Rentables
              </h3>
              <TopProductsTable products={data.topProducts} />
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-3">
                Margen por Categoría
              </h3>
              <Suspense fallback={chartFallback}>
                <LazyMarginBar products={data.topProducts} />
              </Suspense>
            </div>
          </div>

          {/* Footer: source status + generated time */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <SourceIndicator sources={data.sources} />
            <span className="text-xs text-zinc-600">
              Actualizado: {new Date(data.generatedAt).toLocaleTimeString('es-PE')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
