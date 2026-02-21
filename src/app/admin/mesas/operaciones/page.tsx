'use client';

/**
 * Operaciones de Mesa - Real-time table management
 *
 * Shows table status with occupy/release, merge/split, guest count, timers.
 *
 * @module app/admin/mesas/operaciones/page
 */

import { useState, useCallback, useEffect } from 'react';
import {
  LayoutGrid,
  Users,
  Clock,
  Merge,
  Split,
  DoorOpen,
  UserPlus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTableStatus } from '@/src/hooks/useSWRHooks';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/50 bg-emerald-500/10',
  OCCUPIED: 'border-red-500/50 bg-red-500/10',
  RESERVED: 'border-blue-500/50 bg-blue-500/10',
  MAINTENANCE: 'border-zinc-500/50 bg-zinc-500/10',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  MAINTENANCE: 'Mantenimiento',
};

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function OperacionesMesaPage() {
  const { data, error, isLoading, mutate } = useTableStatus();
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [occupyingId, setOccupyingId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [, setTick] = useState(0);

  // Refresh timer every minute for live stay durations
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleOccupy = useCallback(async (tableId: string) => {
    try {
      const res = await fetch(`/api/admin/mesas/${tableId}/occupy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guestCount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success('Mesa ocupada');
      setOccupyingId(null);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al ocupar mesa');
    }
  }, [guestCount, mutate]);

  const handleRelease = useCallback(async (tableId: string) => {
    try {
      const res = await fetch(`/api/admin/mesas/${tableId}/release`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error');
      }
      const d = await res.json();
      toast.success(`Mesa liberada (${d.stayMinutes} min)`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al liberar mesa');
    }
  }, [mutate]);

  const handleMerge = useCallback(async () => {
    if (selectedForMerge.length < 2) {
      toast.error('Selecciona al menos 2 mesas');
      return;
    }
    const [parent, ...children] = selectedForMerge;
    try {
      const res = await fetch(`/api/admin/mesas/${parent}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ childTableIds: children }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error');
      }
      toast.success('Mesas unidas');
      setMergeMode(false);
      setSelectedForMerge([]);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al unir mesas');
    }
  }, [selectedForMerge, mutate]);

  const handleSplit = useCallback(async (tableId: string) => {
    try {
      const res = await fetch(`/api/admin/mesas/${tableId}/split`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Error');
      }
      toast.success('Mesas separadas');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al separar mesas');
    }
  }, [mutate]);

  const toggleMergeSelection = (tableId: string) => {
    setSelectedForMerge((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
    );
  };

  const tables = data?.tables ?? [];
  const visibleTables = tables.filter((t) => !t.parentTableId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-cyan-400" />
            Operaciones Mesa
          </h1>
          <p className="text-zinc-400 mt-1">Estado en vivo de las mesas del local</p>
        </div>
        <div className="flex gap-2">
          {mergeMode ? (
            <>
              <button
                onClick={handleMerge}
                disabled={selectedForMerge.length < 2}
                className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-medium min-h-[40px] disabled:opacity-50"
              >
                <Merge className="w-4 h-4" />
                Unir ({selectedForMerge.length})
              </button>
              <button
                onClick={() => {
                  setMergeMode(false);
                  setSelectedForMerge([]);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm min-h-[40px]"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMergeMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm min-h-[40px]"
              >
                <Merge className="w-4 h-4" /> Unir Mesas
              </button>
              <button
                onClick={() => mutate()}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm min-h-[40px]"
              >
                <RefreshCw className="w-4 h-4" /> Actualizar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500">Total Mesas</p>
            <p className="text-2xl font-bold">{data.total}</p>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-xs text-emerald-400">Disponibles</p>
            <p className="text-2xl font-bold text-emerald-400">{data.available}</p>
          </div>
          <div className="bg-zinc-900 border border-red-500/30 rounded-lg p-4">
            <p className="text-xs text-red-400">Ocupadas</p>
            <p className="text-2xl font-bold text-red-400">{data.occupied}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-xs text-zinc-500">Estancia Promedio</p>
            <p className="text-2xl font-bold">{formatDuration(data.averageStayMinutes)}</p>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar mesas.
        </div>
      )}

      {/* Table Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {visibleTables.map((table) => {
          const statusColor = STATUS_COLORS[table.status] || STATUS_COLORS.MAINTENANCE;
          const statusLabel = STATUS_LABELS[table.status] || table.status;
          const isSelectedForMerge = selectedForMerge.includes(table.id);

          return (
            <div
              key={table.id}
              onClick={mergeMode ? () => toggleMergeSelection(table.id) : undefined}
              className={`
                bg-zinc-900 border-2 rounded-lg p-3 transition-all
                ${statusColor}
                ${mergeMode ? 'cursor-pointer hover:scale-105' : ''}
                ${isSelectedForMerge ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-zinc-950' : ''}
              `}
            >
              {/* Table number */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-bold">
                  {table.displayName || `Mesa ${table.number}`}
                </span>
                {table.isMerged && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                    Unida
                  </span>
                )}
              </div>

              {/* Status */}
              <p className="text-xs text-zinc-400 mb-1">{statusLabel}</p>

              {/* Capacity */}
              <div className="flex items-center gap-1 text-xs text-zinc-500 mb-2">
                <Users className="w-3 h-3" />
                <span>{table.capacity} personas</span>
              </div>

              {/* Stay timer */}
              {table.status === 'OCCUPIED' && table.stayMinutes !== null && (
                <div className="flex items-center gap-1 text-xs text-amber-400 mb-2">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(table.stayMinutes)}</span>
                </div>
              )}

              {/* Actions (not in merge mode) */}
              {!mergeMode && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {table.status === 'AVAILABLE' && (
                    <button
                      onClick={() => {
                        if (occupyingId === table.id) {
                          handleOccupy(table.id);
                        } else {
                          setOccupyingId(table.id);
                          setGuestCount(2);
                        }
                      }}
                      className="flex items-center gap-0.5 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-medium min-h-[28px]"
                    >
                      <UserPlus className="w-3 h-3" />
                      Ocupar
                    </button>
                  )}

                  {table.status === 'OCCUPIED' && (
                    <button
                      onClick={() => handleRelease(table.id)}
                      className="flex items-center gap-0.5 px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-[10px] font-medium min-h-[28px]"
                    >
                      <DoorOpen className="w-3 h-3" />
                      Liberar
                    </button>
                  )}

                  {table.isMerged && (
                    <button
                      onClick={() => handleSplit(table.id)}
                      className="flex items-center gap-0.5 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-medium min-h-[28px]"
                    >
                      <Split className="w-3 h-3" />
                      Separar
                    </button>
                  )}
                </div>
              )}

              {/* Guest count input */}
              {occupyingId === table.id && (
                <div className="mt-2 flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={table.capacity * 2}
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                    className="w-14 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-center min-h-[28px]"
                    autoFocus
                  />
                  <span className="text-[10px] text-zinc-500">comensales</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && visibleTables.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <LayoutGrid className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No hay mesas configuradas</p>
          <p className="text-zinc-500 text-sm mt-1">Configura mesas en la sección de Mesas</p>
        </div>
      )}
    </div>
  );
}
