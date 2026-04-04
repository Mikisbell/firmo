'use client';

/**
 * Sucursales — Comparativa por Sede
 *
 * Multi-location reporting dashboard. Shows per-location KPIs
 * with period selection and comparison table.
 *
 * @module app/admin/sucursales/page
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  MapPin,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Loader2,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month';

interface LocationMetrics {
  locationId: string | null;
  locationName: string;
  metrics: {
    totalOrders: number;
    totalSales: number;
    avgTicket: number;
    topProducts: { name: string; qty: number; revenueCents: number }[];
    ordersByType: Record<string, number>;
  };
}

interface ByLocationResponse {
  locations: LocationMetrics[];
  consolidated: LocationMetrics;
  period: Period;
  locationCount: number;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Ultima semana',
  month: 'Ultimo mes',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  DINE_IN: 'Salon',
  TAKEOUT: 'Para llevar',
  DELIVERY: 'Delivery',
  PLATFORM: 'Plataforma',
  UNKNOWN: 'Otro',
};

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

export default function SucursalesPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<ByLocationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics/by-location?period=${p}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const json: ByLocationResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // Single location message
  if (!loading && !error && data && data.locationCount <= 1 && data.locations.length <= 1) {
    const singleName = data.locations[0]?.locationName || 'Sin sede';
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-7 h-7 text-cyan-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Sucursales</h1>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-zinc-300 mb-2">Solo una sede registrada</h2>
          <p className="text-zinc-500 text-sm">
            Actualmente solo existe <span className="text-zinc-300 font-medium">{singleName}</span>.
            Cuando registres mas sedes, podras comparar metricas entre ellas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Sucursales</h1>
            <p className="text-sm text-zinc-500">Comparativa de metricas por sede</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="ml-3 text-zinc-400">Cargando metricas...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Data */}
      {!loading && !error && data && (
        <>
          {/* Consolidated KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              icon={ShoppingCart}
              label="Ordenes totales"
              value={data.consolidated.metrics.totalOrders.toString()}
              color="text-blue-400"
            />
            <KPICard
              icon={DollarSign}
              label="Ventas totales"
              value={formatCurrency(data.consolidated.metrics.totalSales)}
              color="text-emerald-400"
            />
            <KPICard
              icon={TrendingUp}
              label="Ticket promedio"
              value={formatCurrency(data.consolidated.metrics.avgTicket)}
              color="text-amber-400"
            />
          </div>

          {/* Per-location cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.locations.map((loc) => (
              <LocationCard key={loc.locationId ?? 'unassigned'} location={loc} />
            ))}
          </div>

          {/* Comparison table */}
          {data.locations.length > 1 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-zinc-200">Tabla comparativa</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-5 py-3 font-medium">Sede</th>
                      <th className="text-right px-5 py-3 font-medium">Ordenes</th>
                      <th className="text-right px-5 py-3 font-medium">Ventas</th>
                      <th className="text-right px-5 py-3 font-medium">Ticket prom.</th>
                      <th className="text-right px-5 py-3 font-medium">% del total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {data.locations.map((loc) => {
                      const pct =
                        data.consolidated.metrics.totalSales > 0
                          ? (
                              (loc.metrics.totalSales / data.consolidated.metrics.totalSales) *
                              100
                            ).toFixed(1)
                          : '0.0';
                      return (
                        <tr
                          key={loc.locationId ?? 'unassigned'}
                          className="hover:bg-zinc-800/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-zinc-200 font-medium flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                            {loc.locationName}
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-300">
                            {loc.metrics.totalOrders}
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-300">
                            {formatCurrency(loc.metrics.totalSales)}
                          </td>
                          <td className="px-5 py-3 text-right text-zinc-300">
                            {formatCurrency(loc.metrics.avgTicket)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-300">
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer total */}
                  <tfoot>
                    <tr className="border-t border-zinc-700 bg-zinc-800/30">
                      <td className="px-5 py-3 text-zinc-300 font-semibold">Total</td>
                      <td className="px-5 py-3 text-right text-zinc-200 font-semibold">
                        {data.consolidated.metrics.totalOrders}
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-200 font-semibold">
                        {formatCurrency(data.consolidated.metrics.totalSales)}
                      </td>
                      <td className="px-5 py-3 text-right text-zinc-200 font-semibold">
                        {formatCurrency(data.consolidated.metrics.avgTicket)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-700 text-zinc-300">
                          100%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────── */
/* Sub-components                                         */
/* ────────────────────────────────────────────────────── */

function KPICard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-zinc-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-xl font-bold text-zinc-100 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function LocationCard({ location }: { location: LocationMetrics }) {
  const { locationName, metrics } = location;
  const orderTypes = Object.entries(metrics.ordersByType);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-zinc-200 truncate">{locationName}</h3>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Ordenes</p>
          <p className="text-lg font-bold text-zinc-100">{metrics.totalOrders}</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Ventas</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalSales)}</p>
        </div>
        <div>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Ticket</p>
          <p className="text-lg font-bold text-amber-400">{formatCurrency(metrics.avgTicket)}</p>
        </div>
      </div>

      {/* Order type breakdown */}
      {orderTypes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Por tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {orderTypes.map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-400"
              >
                {ORDER_TYPE_LABELS[type] || type}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top products */}
      {metrics.topProducts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-zinc-500 uppercase tracking-wide">Top productos</p>
          <div className="space-y-1">
            {metrics.topProducts.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 truncate mr-2">{p.name}</span>
                <span className="text-zinc-500 flex-shrink-0">
                  {p.qty}u &middot; {formatCurrency(p.revenueCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
