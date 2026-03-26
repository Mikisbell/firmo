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
  
  // Fetch alerts for all stations
  const { alerts, dismissAlert } = useStationAlerts({});
  
  // Calculate global stats from all stations
  const globalStats = useMemo(() => {
    if (!stations) return { activeStations: 0, totalOrders: 0, avgTime: 0, globalEfficiency: 0 };
    
    const activeStations = stations.filter(s => s.is_active).length;
    
    // These will be calculated from individual station metrics
    // For now, return defaults - will be updated when metrics are loaded
    return {
      activeStations,
      totalOrders: 0,
      avgTime: 0,
      globalEfficiency: 0,
    };
  }, [stations]);

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar esta estación?')) return;
    
    try {
      const res = await fetch(`/api/admin/stations/${id}`, { method: 'DELETE' });
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
      label: 'Estación',
      width: '180px',
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{STATION_ICONS[s.code] || '📺'}</span>
          <div>
            <div className="font-medium">{s.code}</div>
            <div className="text-xs text-zinc-500">{s.name}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'terminals_count',
      label: 'Terminales',
      width: '120px',
      render: (s) => (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
          <Monitor className="w-3 h-3" />
          {s.terminals_count}
        </span>
      ),
    },
    {
      key: 'printers_count',
      label: 'Impresoras',
      width: '120px',
      render: (s) => (
        <span className="text-zinc-400">
          {s.printers_count} impresora{s.printers_count !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Estado',
      width: '100px',
      render: (s) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            s.is_active
              ? 'bg-green-500/20 text-green-400'
              : 'bg-zinc-500/20 text-zinc-400'
          }`}
        >
          {s.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {s.is_active ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (s) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditingStation(s); setShowModal(true); }}
            className="p-2 rounded hover:bg-zinc-800"
            title="Editar"
          >
            <Edit2 className="w-4 h-4 text-zinc-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
            className="p-2 rounded hover:bg-zinc-800"
            title="Desactivar"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estaciones KDS</h1>
          <p className="text-zinc-400 mt-1">
            {stations?.length || 0} estaciones de cocina
          </p>
        </div>
        <button
          onClick={() => { setEditingStation(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Nueva Estación
        </button>
      </div>

      {/* Global Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Estaciones Activas</span>
            <Check className="w-4 h-4 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">
            {globalStats.activeStations}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            de {stations?.length || 0} totales
          </div>
        </div>

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
              <div 
                key={alert.id}
                className={`p-3 rounded-lg border flex items-start gap-3 ${
                  alert.severity === 'HIGH' ? 'bg-red-500/10 border-red-500/20' :
                  alert.severity === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/20' :
                  'bg-blue-500/10 border-blue-500/20'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  alert.severity === 'HIGH' ? 'text-red-400' :
                  alert.severity === 'MEDIUM' ? 'text-yellow-400' :
                  'text-blue-400'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alert.stationName || 'Estación'}</span>
                    <span className="text-xs text-zinc-500">
                      hace {timeSince} min
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-1">{alert.message}</p>
                </div>
                <button 
                  className="text-zinc-500 hover:text-zinc-300"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
        searchPlaceholder="Buscar por código o nombre..."
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
  
  // Optimización: Memoizar órdenes ordenadas por tiempo de espera
  // Evita sort O(n log n) en cada render
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const waitTimeA = Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / 60000);
      const waitTimeB = Math.floor((Date.now() - new Date(b.submittedAt).getTime()) / 60000);
      return waitTimeB - waitTimeA; // Mayor tiempo primero
    });
  }, [orders]);
  
  if (!station) return null;
  
  const STATION_ICONS: Record<string, string> = {
    PARRILLA: '🔥',
    COCINA: '🍳',
    BAR: '🍺',
    FRIOS: '❄️',
    POSTRES: '🍰',
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-2xl border border-zinc-800 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{STATION_ICONS[station.code] || '📺'}</span>
            <div>
              <h2 className="text-lg font-bold">{station.name}</h2>
              <p className="text-sm text-zinc-400">
                {isLoading ? 'Cargando...' : `${orders.length} órdenes activas`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading && orders.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">Cargando órdenes...</div>
          ) : orders.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">No hay órdenes activas</div>
          ) : (
            <div className="space-y-3">
              {sortedOrders.map(order => {
                const waitTime = Math.floor((Date.now() - new Date(order.submittedAt).getTime()) / 60000);
                return (
                  <div
                    key={order.orderId}
                    className={`p-4 rounded-lg border-l-4 bg-zinc-800/50 ${
                      waitTime > 10 ? 'border-red-500' :
                      waitTime > 5 ? 'border-yellow-500' :
                      'border-green-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-bold">Orden #{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            order.status === 'PENDING' ? 'bg-zinc-700 text-zinc-300' :
                            order.status === 'COOKING' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {order.status === 'PENDING' ? 'Pendiente' :
                             order.status === 'COOKING' ? 'En preparación' :
                             'Listo'}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-400">
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
                        <div className="text-xs text-zinc-500">esperando</div>
                      </div>
                    </div>
                    
                    {/* Barra de progreso de tiempo */}
                    <div className="mt-3 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
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
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-zinc-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt <= 5;
                  }).length} rápidas
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-zinc-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt > 5 && wt <= 10;
                  }).length} normales
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-zinc-400">
                  {orders.filter(o => {
                    const wt = Math.floor((Date.now() - new Date(o.submittedAt).getTime()) / 60000);
                    return wt > 10;
                  }).length} retrasadas
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
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
    estimated_time: 10, // Tiempo estimado en minutos
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
      <div className="bg-zinc-900 rounded-xl w-full max-w-md border border-zinc-800">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold">
            {station ? 'Editar Estación' : 'Nueva Estación'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Código * <span className="text-xs">(mayúsculas, ej: PARRILLA)</span>
            </label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none uppercase"
              placeholder="PARRILLA"
              pattern="[A-Z_]+"
              required
              disabled={!!station}
            />
            {station ? (
              <p className="text-xs text-zinc-500 mt-1">
                El código no se puede modificar
              </p>
            ) : (
              <p className="text-xs text-zinc-500 mt-1">
                Solo mayúsculas y guion bajo. Ej: PARRILLA, BAR_2
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
              placeholder="Parrilla Principal"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Tiempo estimado de preparación (minutos)
            </label>
            <input
              type="number"
              value={form.estimated_time}
              onChange={(e) => setForm({ ...form, estimated_time: parseInt(e.target.value) || 10 })}
              min={1}
              max={60}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:border-amber-500 outline-none"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Usado para alertas de retraso y métricas de rendimiento
            </p>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm">Estación activa</span>
          </label>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Global Stats Card Component
function GlobalStatsCard({ stations }: { stations: Station[] }) {
  const activeStations = stations.filter(s => s.is_active);
  
  // Fetch metrics for all stations (hooks must be called unconditionally)
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
  
  // Optimización: Combinar 3 reduce en una sola iteración con useMemo
  // Reduce complejidad de O(4n) a O(n) y calcula valores directamente
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
      <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Órdenes Activas</span>
          <Monitor className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-amber-400">
          {totalOrders}
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          en todas las estaciones
        </div>
      </div>

      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Tiempo Promedio</span>
          <Clock className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-blue-400">
          {avgTime} min
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          todas las estaciones
        </div>
      </div>

      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Eficiencia Global</span>
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>
        <div className="text-2xl font-bold text-purple-400">
          {globalEfficiency}%
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          últimas 24 horas
        </div>
      </div>
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
  
  const STATION_ICONS: Record<string, string> = {
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
    <div 
      className={`relative p-4 rounded-lg border transition-all duration-300 hover:shadow-lg hover:scale-105 ${
        station.is_active 
          ? 'border-zinc-800 bg-zinc-900/80 backdrop-blur' 
          : 'border-zinc-800/50 bg-zinc-900/20 opacity-60'
      }`}
    >
      {/* Header con icono y nombre */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{STATION_ICONS[station.code] || '📺'}</span>
        <div className="flex-1">
          <div className="font-bold text-sm">{station.code}</div>
          <div className="text-xs text-zinc-500">{station.name}</div>
        </div>
      </div>
      
      {/* Métricas en tiempo real */}
      {station.is_active && (
        <>
          {isLoading ? (
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Órdenes activas</span>
                <span className={`font-bold ${
                  activeOrders > 10 ? 'text-red-400' :
                  activeOrders > 5 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {activeOrders}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Tiempo promedio</span>
                <span className={`font-bold ${
                  avgTime > 10 ? 'text-red-400' :
                  avgTime > 7 ? 'text-yellow-400' :
                  'text-green-400'
                }`}>
                  {avgTime} min
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Eficiencia</span>
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
            <span className="text-zinc-500">Carga</span>
            <span className="text-zinc-400">{load}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
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
      
      {/* Semáforo de estado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {station.is_active ? (
            <>
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full ${load < 50 ? 'bg-green-500' : 'bg-zinc-700'}`} />
                <div className={`w-2 h-2 rounded-full ${load >= 50 && load < 80 ? 'bg-yellow-500' : 'bg-zinc-700'}`} />
                <div className={`w-2 h-2 rounded-full ${load >= 80 ? 'bg-red-500 animate-pulse' : 'bg-zinc-700'}`} />
              </div>
              <span className="text-xs text-zinc-500">
                {load >= 80 ? 'Sobrecargada' : load >= 50 ? 'Ocupada' : 'Normal'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Inactiva</span>
            </>
          )}
        </div>
        
        {/* Indicador de terminales */}
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Monitor className="w-3 h-3" />
          <span>{station.terminals_count}</span>
        </div>
      </div>
      
      {/* Botón Ver Órdenes */}
      {station.is_active && activeOrders > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewOrders();
          }}
          className="mt-3 w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center justify-center gap-2"
        >
          <Clock className="w-3 h-3" />
          Ver {activeOrders} órdenes activas
        </button>
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
    </div>
  );
}
