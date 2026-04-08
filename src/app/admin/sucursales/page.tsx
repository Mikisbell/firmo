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
  ArrowRightLeft,
  X,
  CheckCircle,
} from 'lucide-react';
import { Button, Card, PageHeader, MetricCard, ToggleGroup } from '@/src/components/ui';

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
  const [transferModalOpen, setTransferModalOpen] = useState(false);

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
        <PageHeader title="Sucursales" description="Comparativa de metricas por sede" />
        <Card className="text-center !p-8">
          <MapPin className="w-12 h-12 text-park-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Solo una sede registrada</h2>
          <p className="text-park-gray-500 text-sm">
            Actualmente solo existe <span className="text-white font-medium">{singleName}</span>.
            Cuando registres mas sedes, podras comparar metricas entre ellas.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Sucursales"
        description="Comparativa de metricas por sede"
        actions={
          <div className="flex items-center gap-3">
            {data && data.locations.length >= 2 && (
              <Button
                variant="secondary"
                icon={<ArrowRightLeft className="w-4 h-4" />}
                onClick={() => setTransferModalOpen(true)}
              >
                Transferir Stock
              </Button>
            )}
            <ToggleGroup
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={[
                { value: 'today', label: 'Hoy' },
                { value: 'week', label: 'Ultima semana' },
                { value: 'month', label: 'Ultimo mes' },
              ]}
              size="sm"
            />
          </div>
        }
      />

      {/* Stock Transfer Modal */}
      {transferModalOpen && data && data.locations.length >= 2 && (
        <StockTransferModal
          locations={data.locations.map((l) => ({
            id: l.locationId ?? '',
            name: l.locationName,
          }))}
          onClose={() => setTransferModalOpen(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <span className="ml-3 text-park-gray-400">Cargando metricas...</span>
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
            <MetricCard
              label="Ordenes totales"
              value={data.consolidated.metrics.totalOrders.toString()}
              icon={<ShoppingCart className="w-5 h-5" />}
            />
            <MetricCard
              label="Ventas totales"
              value={formatCurrency(data.consolidated.metrics.totalSales)}
              icon={<DollarSign className="w-5 h-5" />}
            />
            <MetricCard
              label="Ticket promedio"
              value={formatCurrency(data.consolidated.metrics.avgTicket)}
              icon={<TrendingUp className="w-5 h-5" />}
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
            <div className="bg-park-gray-900 border border-park-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-park-gray-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">Tabla comparativa</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-park-gray-800 text-park-gray-500 text-xs uppercase tracking-wider">
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
                          className="hover:bg-park-gray-800/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-white font-medium flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-park-gray-600 flex-shrink-0" />
                            {loc.locationName}
                          </td>
                          <td className="px-5 py-3 text-right text-park-gray-300">
                            {loc.metrics.totalOrders}
                          </td>
                          <td className="px-5 py-3 text-right text-park-gray-300">
                            {formatCurrency(loc.metrics.totalSales)}
                          </td>
                          <td className="px-5 py-3 text-right text-park-gray-300">
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
                    <tr className="border-t border-zinc-700 bg-park-gray-800/30">
                      <td className="px-5 py-3 text-park-gray-300 font-semibold">Total</td>
                      <td className="px-5 py-3 text-right text-white font-semibold">
                        {data.consolidated.metrics.totalOrders}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-semibold">
                        {formatCurrency(data.consolidated.metrics.totalSales)}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-semibold">
                        {formatCurrency(data.consolidated.metrics.avgTicket)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-700 text-park-gray-300">
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

function StockTransferModal({
  locations,
  onClose,
}: {
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [inventoryCode, setInventoryCode] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; fromStock?: number; toStock?: number; error?: string } | null>(null);

  const handleSubmit = async () => {
    if (!fromLocationId || !toLocationId || !inventoryCode || !qty) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromLocationId,
          toLocationId,
          inventoryCode,
          qty: parseInt(qty, 10),
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ success: false, error: data.error || 'Error desconocido' });
      } else {
        setResult({ success: true, fromStock: data.fromStock, toStock: data.toStock });
      }
    } catch {
      setResult({ success: false, error: 'Error de conexion' });
    } finally {
      setSubmitting(false);
    }
  };

  const validLocations = locations.filter((l) => l.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-park-gray-900 border border-park-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
            Transferir Stock
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-park-gray-800 text-park-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result?.success ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-semibold mb-2">Transferencia exitosa</p>
            <div className="text-sm text-park-gray-400 space-y-1">
              <p>Stock origen: {result.fromStock}</p>
              <p>Stock destino: {result.toStock}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-park-gray-400 uppercase tracking-wider block mb-1">Origen</label>
              <select
                value={fromLocationId}
                onChange={(e) => setFromLocationId(e.target.value)}
                className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="">Seleccionar sede</option>
                {validLocations.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.id === toLocationId}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-park-gray-400 uppercase tracking-wider block mb-1">Destino</label>
              <select
                value={toLocationId}
                onChange={(e) => setToLocationId(e.target.value)}
                className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              >
                <option value="">Seleccionar sede</option>
                {validLocations.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.id === fromLocationId}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-park-gray-400 uppercase tracking-wider block mb-1">Codigo producto</label>
              <input
                type="text"
                value={inventoryCode}
                onChange={(e) => setInventoryCode(e.target.value)}
                placeholder="Ej: POLLO-001"
                className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-park-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            <div>
              <label className="text-xs text-park-gray-400 uppercase tracking-wider block mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Ej: 10"
                className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-park-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            <div>
              <label className="text-xs text-park-gray-400 uppercase tracking-wider block mb-1">Razon (opcional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Reposicion por alta demanda"
                className="w-full bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-park-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              />
            </div>

            {result?.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                {result.error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-park-gray-800 text-park-gray-300 hover:bg-park-gray-700 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !fromLocationId || !toLocationId || !inventoryCode || !qty}
                className="flex-1 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 disabled:bg-park-gray-700 disabled:text-park-gray-500 transition-colors"
              >
                {submitting ? 'Transfiriendo...' : 'Transferir'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationCard({ location }: { location: LocationMetrics }) {
  const { locationName, metrics } = location;
  const orderTypes = Object.entries(metrics.ordersByType);

  return (
    <div className="bg-park-gray-900 border border-park-gray-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-white truncate">{locationName}</h3>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-park-gray-500 uppercase tracking-wide">Ordenes</p>
          <p className="text-lg font-bold text-white">{metrics.totalOrders}</p>
        </div>
        <div>
          <p className="text-[11px] text-park-gray-500 uppercase tracking-wide">Ventas</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(metrics.totalSales)}</p>
        </div>
        <div>
          <p className="text-[11px] text-park-gray-500 uppercase tracking-wide">Ticket</p>
          <p className="text-lg font-bold text-amber-400">{formatCurrency(metrics.avgTicket)}</p>
        </div>
      </div>

      {/* Order type breakdown */}
      {orderTypes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-park-gray-500 uppercase tracking-wide">Por tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {orderTypes.map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-park-gray-800 text-park-gray-400"
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
          <p className="text-[11px] text-park-gray-500 uppercase tracking-wide">Top productos</p>
          <div className="space-y-1">
            {metrics.topProducts.slice(0, 3).map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-park-gray-400 truncate mr-2">{p.name}</span>
                <span className="text-park-gray-500 flex-shrink-0">
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
