'use client';

/**
 * KDS Stations Management Page
 * CRUD de estaciones KDS (Kitchen Display System)
 *
 * Requirements: KDS stations management
 */

import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Check, X, Monitor, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { DataTable, Column, FilterConfig } from '../components/DataTable';
import { useAdminData } from '@/src/hooks/useAdminData';
import { useStationMetrics } from './hooks/useStationMetrics';
import { useStationOrders } from './hooks/useStationOrders';
import { useStationAlerts } from './hooks/useStationAlerts';
import { useStations } from '@/src/hooks/useSWRHooks';
import { Button, Badge, Card, PageHeader, MetricCard, EmptyState, ConfirmDialog } from '@/src/components/ui';
import { Tooltip } from '@/src/components/ui/Tooltip';

interface Station {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  terminals_count: number;
  printers_count: number;
}

interface _Alert {
  id: string;
  station: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  timestamp: Date;
}

// Station icons mapping
const STATION_ICONS: Record<string, string> = {
  PARRILLA: '🔥',
  COCINA: '🍳',
  BAR: '🍺',
  FRIOS: '❄️',
  POSTRES: '🍰',
};

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

const filters: FilterConfig[] = [
  { key: 'is_active', label: 'Estado', options: STATUS_OPTIONS },
];

export default function StationsPage() {
  // Migrado a SWR - Tarea 9.3 Lote 2
  const { data, error: swrError, isLoading: loading, mutate } = useStations();
  const stations = data?.items || [];
  const error = swrError ? 'Error al cargar estaciones' : null;

  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [showOrdersModal, setShowOrdersModal] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch alerts for all stations
  const { alerts, dismissAlert } = useStationAlerts({});

  // Calculate global stats from all stations
  const globalStats = useMemo(() => {
    if (!stations) return { activeStations: 0, totalOrders: 0, avgTime: 0, globalEfficiency: 0 };

    const activeStations = stations.filter(s => s.is_active).length;

    return {
      activeStations,
      totalOrders: 0,
      avgTime: 0,
      globalEfficiency: 0,
    };
  }, [stations]);

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    try {
      const res = await fetch(`/api/admin/stations/${confirmDeleteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      mutate(); // Revalidar con SWR
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const columns: Column<Station>[] = [
    {
      key: 'code',
      label: 'Estacion',
      width: '180px',
      sortable: true,
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{STATION_ICONS[s.code] || '📺'}</span>
          <div>
            <div className="font-medium">{s.code}</div>
            <div className="text-xs text-park-gray-500">{s.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'terminals_count',
      label: 'Terminales',
      width: '120px',
      sortable: true,
      numeric: true,
      render: (s) => (
        <Badge variant="info">
          <span className="inline-flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            {s.terminals_count}
          </span>
        </Badge>
      ),
    },
    {
      key: 'printers_count',
      label: 'Impresoras',
      width: '120px',
      render: (s) => (
        <span className="text-park-gray-400">
          {s.printers_count} impresora{s.printers_count !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (s) => (
        <Badge variant={s.is_active ? 'success' : 'neutral'} dot>
          {s.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (s) => (
        <div className="flex items-center gap-1">
          <Tooltip content="Editar">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setEditingStation(s); setShowModal(true); }}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Eliminar">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><div className="h-16 bg-park-gray-800 rounded animate-pulse" /></Card>
          ))}
        </div>
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Estaciones KDS"
        description={`${stations?.length || 0} estaciones de cocina`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => { setEditingStation(null); setShowModal(true); }}
          >
            Nueva Estacion
          </Button>
        }
      />

      {/* Global Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Estaciones Activas"
          value={`${globalStats.activeStations} de ${stations?.length || 0}`}
          icon={<Check className="w-5 h-5 text-green-400" />}
        />
        <GlobalStatsCard stations={stations || []} />
      </div>

      {/* Station summary - Enhanced with metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {(stations || []).map(station => (
          <StationCard
            key={station.id}
            station={station}
            onViewOrders={() => setShowOrdersModal(station.id)}
          />
        ))}
      </div>

      {/* Alertas de rendimiento */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => {
            const timeSince = Math.floor((Date.now() - new Date(alert.createdAt).getTime()) / 60000);
            return (
              <Card
                key={alert.id}
                className={
                  alert.severity === 'HIGH' ? 'border-red-500/20' :
                  alert.severity === 'MEDIUM' ? 'border-yellow-500/20' :
                  'border-blue-500/20'
                }
                padding="sm"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    alert.severity === 'HIGH' ? 'text-red-400' :
                    alert.severity === 'MEDIUM' ? 'text-yellow-400' :
                    'text-blue-400'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.stationName || 'Estacion'}</span>
                      <span className="text-xs text-park-gray-500">
                        hace {timeSince} min
                      </span>
                    </div>
                    <p className="text-sm text-park-gray-300 mt-1">{alert.message}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => dismissAlert(alert.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <DataTable
        data={stations || []}
        columns={columns}
        filters={filters}
        searchPlaceholder="Buscar por codigo o nombre..."
        searchKeys={['code', 'name']}
        loading={loading}
        emptyMessage="No hay estaciones"
      />

      {showModal && (
        <StationModal
          station={editingStation}
          onClose={() => { setShowModal(false); setEditingStation(null); }}
          onSave={() => { setShowModal(false); setEditingStation(null); mutate(); }}
        />
      )}

      {showOrdersModal && (
        <OrdersModalWithData
          stationId={showOrdersModal}
          station={stations?.find(s => s.id === showOrdersModal)}
          onClose={() => setShowOrdersModal(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirm}
        title="¿Desactivar estacion?"
        description="La estacion dejara de recibir nuevas ordenes en el KDS. Se puede reactivar mas tarde."
        confirmLabel="Desactivar"
        variant="destructive"
      />
    </div>
  );
}

function OrdersModalWithData({
  stationId,
  station,
  onClose,
}: {
  stationId: string;
  station: Station | undefined;
  onClose: () => void;
}) {
  const { orders, isLoading, loadMore, hasMore } = useStationOrders({
    stationId,
    limit: 20
  });

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const waitTimeA = Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / 60000);
      const waitTimeB = Math.floor((Date.now() - new Date(b.submittedAt).getTime()) / 60000);
      return waitTimeB - waitTimeA;
    });
  }, [orders]);

  if (!station) return null;

  const STATION_ICONS_LOCAL: Record<string, string> = {
    PARRILLA: '🔥',
    COCINA: '🍳',
    BAR: '🍺',
    FRIOS: '❄️',
    POSTRES: '🍰',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card padding="none" className="w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-park-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{STATION_ICONS_LOCAL[station.code] || '📺'}</span>
            <div>
              <h2 className="text-lg font-bold">{station.name}</h2>
              <p className="text-sm text-park-gray-400">
                {isLoading ? 'Cargando...' : `${orders.length} ordenes activas`}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {isLoading && orders.length === 0 ? (
            <div className="text-center text-park-gray-500 py-8">Cargando ordenes...</div>
          ) : orders.length === 0 ? (
            <div className="text-center text-park-gray-500 py-8">No hay ordenes activas</div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map(order => {
                const waitTime = Math.floor((Date.now() - new Date(order.submittedAt).getTime()) / 60000);
                return (
                  <div
                    key={order.orderId}
                    className={`p-4 rounded-lg border-l-4 bg-park-gray-800/50 ${
                      waitTime > 10 ? 'border-red-500' :
                      waitTime > 5 ? 'border-yellow-500' :
                      'border-green-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold">Orden #{order.orderNumber}</span>
                          <Badge
                            variant={
                              order.status === 'PENDING' ? 'neutral' :
                              order.status === 'COOKING' ? 'info' : 'success'
                            }
                          >
                            {order.status === 'PENDING' ? 'Pendiente' :
                             order.status === 'COOKING' ? 'En preparacion' :
                             'Listo'}
                          </Badge>
                        </div>
                        <div className="text-sm text-park-gray-400">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          waitTime > 10 ? 'text-red-400' :
                          waitTime > 5 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>
                          {waitTime} min
                        </div>
                        <div className="text-xs text-park-gray-500">esperando</div>
                      </div>
                    </div>

                    {/* Barra de progreso de tiempo */}
                    <div className="mt-3 h-1.5 bg-park-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          waitTime > 10 ? 'bg-red-500' :
                          waitTime > 5 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min((waitTime / 15) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <Button
                  variant="secondary"
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? 'Cargando...' : 'Cargar mas'}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-park-gray-800 bg-park-gray-900/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-park-gray-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt <= 5;
                  }).length} rapidas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-park-gray-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt > 5 && wt <= 10;
                  }).length} normales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-park-gray-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt > 10;
                  }).length} retrasadas
                </span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}



function StationModal({
  station,
  onClose,
  onSave
}: {
  station: Station | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    code: station?.code || '',
    name: station?.name || '',
    is_active: station?.is_active ?? true,
    estimated_time: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = station ? `/api/admin/stations/${station.id}` : '/api/admin/stations';
      const method = station ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card padding="none" className="w-full max-w-md">
        <div className="p-4 border-b border-park-gray-800">
          <h2 className="text-lg font-bold">
            {station ? 'Editar Estacion' : 'Nueva Estacion'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-park-gray-400 mb-1">
              Codigo * <span className="text-xs">(mayusculas, ej: PARRILLA)</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:border-park-brand-500 outline-none uppercase"
              placeholder="PARRILLA"
              pattern="[A-Z_]+"
              required
              disabled={!!station}
            />
            {station ? (
              <p className="text-xs text-park-gray-500 mt-1">
                El codigo no se puede modificar
              </p>
            ) : (
              <p className="text-xs text-park-gray-500 mt-1">
                Solo mayusculas y guion bajo. Ej: PARRILLA, BAR_2
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-park-gray-400 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:border-park-brand-500 outline-none"
              placeholder="Parrilla Principal"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-park-gray-400 mb-1">
              Tiempo estimado de preparacion (minutos)
            </label>
            <input
              type="number"
              value={form.estimated_time}
              onChange={(e) => setForm({ ...form, estimated_time: parseInt(e.target.value) || 10 })}
              min={1}
              max={60}
              className="w-full px-3 py-2 bg-park-gray-800 border border-park-gray-700 rounded-lg focus:border-park-brand-500 outline-none"
            />
            <p className="text-xs text-park-gray-500 mt-1">
              Usado para alertas de retraso y metricas de rendimiento
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-park-gray-700 bg-park-gray-800 text-park-brand-500 focus:ring-park-brand-500"
            />
            <span className="text-sm">Estacion activa</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              className="flex-1"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}


// Global Stats Card Component
function GlobalStatsCard({ stations }: { stations: Station[] }) {
  const activeStations = stations.filter(s => s.is_active);

  const station1Metrics = useStationMetrics({ stationId: activeStations[0]?.id || '' });
  const station2Metrics = useStationMetrics({ stationId: activeStations[1]?.id || '' });
  const station3Metrics = useStationMetrics({ stationId: activeStations[2]?.id || '' });
  const station4Metrics = useStationMetrics({ stationId: activeStations[3]?.id || '' });
  const station5Metrics = useStationMetrics({ stationId: activeStations[4]?.id || '' });

  const stationMetrics = [
    station1Metrics.metrics,
    station2Metrics.metrics,
    station3Metrics.metrics,
    station4Metrics.metrics,
    station5Metrics.metrics,
  ].filter((m, idx) => idx < activeStations.length && m !== null);

  const { totalOrders, avgTime, globalEfficiency } = useMemo(() => {
    const validMetrics = stationMetrics.filter(m => m !== null);
    if (validMetrics.length === 0) {
      return { totalOrders: 0, avgTime: 0, globalEfficiency: 0 };
    }

    let total = 0;
    let sumTime = 0;
    let sumEfficiency = 0;

    for (const m of validMetrics) {
      total += m?.activeOrders || 0;
      sumTime += m?.avgTime || 0;
      sumEfficiency += m?.efficiency || 0;
    }

    return {
      totalOrders: total,
      avgTime: Math.round(sumTime / validMetrics.length),
      globalEfficiency: Math.round(sumEfficiency / validMetrics.length),
    };
  }, [stationMetrics]);

  return (
    <>
      <MetricCard
        label="Ordenes Activas"
        value={totalOrders}
        icon={<Monitor className="w-5 h-5 text-amber-400" />}
      />
      <MetricCard
        label="Tiempo Promedio"
        value={`${avgTime} min`}
        icon={<Clock className="w-5 h-5 text-blue-400" />}
      />
      <MetricCard
        label="Eficiencia Global"
        value={`${globalEfficiency}%`}
        icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
      />
    </>
  );
}

// Station Card Component with Real Metrics
function StationCard({
  station,
  onViewOrders
}: {
  station: Station;
  onViewOrders: () => void;
}) {
  const { metrics, isLoading } = useStationMetrics({
    stationId: station.id,
    enabled: station.is_active
  });

  const STATION_ICONS_LOCAL: Record<string, string> = {
    PARRILLA: '🔥',
    COCINA: '🍳',
    BAR: '🍺',
    FRIOS: '❄️',
    POSTRES: '🍰',
  };

  const activeOrders = metrics?.activeOrders || 0;
  const avgTime = metrics?.avgTime || 0;
  const efficiency = metrics?.efficiency || 0;
  const load = metrics?.load || 0;

  return (
    <Card
      hover
      className={`relative ${!station.is_active ? 'opacity-60' : ''}`}
      padding="sm"
    >
      {/* Header con icono y nombre */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{STATION_ICONS_LOCAL[station.code] || '📺'}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">{station.code}</div>
          <div className="text-xs text-park-gray-500">{station.name}</div>
        </div>
      </div>

      {/* Metricas en tiempo real */}
      {station.is_active && (
        <>
          {isLoading ? (
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-park-gray-800 rounded animate-pulse" />
              <div className="h-4 bg-park-gray-800 rounded animate-pulse" />
              <div className="h-4 bg-park-gray-800 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-park-gray-400">Ordenes activas</span>
                <span className={`font-bold ${
                  activeOrders > 10 ? 'text-red-400' :
                  activeOrders > 5 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {activeOrders}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-park-gray-400">Tiempo promedio</span>
                <span className={`font-bold ${
                  avgTime > 10 ? 'text-red-400' :
                  avgTime > 7 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {avgTime} min
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-park-gray-400">Eficiencia</span>
                <span className={`font-bold ${
                  efficiency < 70 ? 'text-red-400' :
                  efficiency < 85 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {efficiency}%
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Barra de carga */}
      {station.is_active && !isLoading && (
        <div className="mb-3">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-park-gray-500">Carga</span>
            <span className="text-park-gray-400">{load}%</span>
          </div>
          <div className="h-2 bg-park-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                load > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                load > 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                'bg-gradient-to-r from-green-500 to-emerald-500'
              }`}
              style={{ width: `${load}%` }}
            />
          </div>
        </div>
      )}

      {/* Semaforo de estado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {station.is_active ? (
            <>
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${load < 50 ? 'bg-green-500' : 'bg-park-gray-700'}`} />
                <div className={`w-2 h-2 rounded-full ${load >= 50 && load < 80 ? 'bg-yellow-500' : 'bg-park-gray-700'}`} />
                <div className={`w-2 h-2 rounded-full ${load >= 80 ? 'bg-red-500 animate-pulse' : 'bg-park-gray-700'}`} />
              </div>
              <span className="text-xs text-park-gray-500">
                {load >= 80 ? 'Sobrecargada' : load >= 50 ? 'Ocupada' : 'Normal'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-park-gray-600" />
              <span className="text-xs text-park-gray-500">Inactiva</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-park-gray-500">
          <Monitor className="w-3 h-3" />
          <span>{station.terminals_count}</span>
        </div>
      </div>

      {/* Boton Ver Ordenes */}
      {station.is_active && activeOrders > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onViewOrders();
          }}
          icon={<Clock className="w-3 h-3" />}
          className="mt-3 w-full text-amber-400 hover:text-amber-300"
        >
          Ver {activeOrders} ordenes activas
        </Button>
      )}

      {/* Pulse animation para estaciones activas */}
      {station.is_active && (
        <div className="absolute top-2 right-2">
          <div className="relative">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
          </div>
        </div>
      )}
    </Card>
  );
}
