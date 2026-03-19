'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Truck, RefreshCw, Clock, Bike, CheckCircle, Package, ExternalLink } from 'lucide-react';
import { DeliveryCard } from './components/DeliveryCard';
import { MetricsSummary } from './components/MetricsSummary';

interface DeliveryOrder {
  id: string;
  order_id: string;
  driver_id: string | null;
  drivers?: { id: string; name: string; phone: string } | null;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: number;
  status: 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED';
  created_at: string;
  assigned_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  delivery_time_mins: number | null;
}

interface Driver {
  id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

function DriverStatusCard({ driver, deliveries }: { driver: Driver; deliveries: DeliveryOrder[] }) {
  const active = deliveries.find(
    d => d.driver_id === driver.id && (d.status === 'ASSIGNED' || d.status === 'DISPATCHED')
  );
  const isOnDelivery = !!active;
  const isDispatched = active?.status === 'DISPATCHED';

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
      isDispatched ? 'bg-violet-500/10 border-violet-500/30' :
      isOnDelivery ? 'bg-blue-500/10 border-blue-500/30' :
      'bg-zinc-800/60 border-zinc-700/50'
    }`}>
      <div className={`p-2 rounded-full ${
        isDispatched ? 'bg-violet-500/20 text-violet-400' :
        isOnDelivery ? 'bg-blue-500/20 text-blue-400' :
        'bg-emerald-500/20 text-emerald-400'
      }`}>
        <Bike className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{driver.name}</p>
        <p className={`text-[10px] uppercase tracking-wide font-medium ${
          isDispatched ? 'text-violet-400' :
          isOnDelivery ? 'text-blue-400' :
          'text-emerald-400'
        }`}>
          {isDispatched ? 'En camino' : isOnDelivery ? 'Asignado' : 'Disponible'}
        </p>
      </div>
      {isOnDelivery && (
        <span className={`ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full ${
          isDispatched ? 'bg-violet-500/20 text-violet-300' : 'bg-blue-500/20 text-blue-300'
        }`}>
          #{active!.order_id.slice(-6).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  title, count, accentClass, headerClass, children, emptyText,
}: {
  title: string; count: number; accentClass: string; headerClass: string;
  children: React.ReactNode; emptyText: string;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl border-t border-x ${accentClass}`}>
        <h2 className={`text-sm font-bold uppercase tracking-wider ${headerClass}`}>{title}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accentClass} ${headerClass}`}>
          {count}
        </span>
      </div>
      <div className="flex-1 border border-t-0 border-zinc-800 rounded-b-xl bg-zinc-900/40 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-340px)]">
        {count === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-8">{emptyText}</p>
        ) : children}
      </div>
    </div>
  );
}

export default function DeliveryDispatchPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [allDrivers, setAllDrivers] = useState<Driver[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [deliveriesRes, driversRes, availableRes] = await Promise.all([
        fetch('/api/delivery?status=PENDING,ASSIGNED,DISPATCHED,DELIVERED,FAILED'),
        fetch('/api/drivers'),
        fetch('/api/drivers/available'),
      ]);

      const [deliveriesData, driversData, availableData] = await Promise.all([
        deliveriesRes.json(),
        driversRes.json(),
        availableRes.json(),
      ]);

      setDeliveries(deliveriesData.deliveries || deliveriesData.items || []);
      setAllDrivers((driversData.drivers || driversData.items || []).filter((d: Driver) => d.is_active));
      setAvailableDrivers(availableData.drivers || availableData.items || []);
      setLastUpdated(new Date());
    } catch {
      toast.error('Error cargando datos de delivery');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAssignDriver = async (deliveryId: string, driverId: string) => {
    try {
      const res = await fetch(`/api/delivery/${deliveryId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error asignando motorizado');
      }
      toast.success('Motorizado asignado');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error asignando motorizado');
    }
  };

  const { pending, enCamino, completados } = useMemo(() => {
    const p: DeliveryOrder[] = [];
    const ec: DeliveryOrder[] = [];
    const c: DeliveryOrder[] = [];
    for (const d of deliveries) {
      if (d.status === 'PENDING') p.push(d);
      else if (d.status === 'ASSIGNED' || d.status === 'DISPATCHED') ec.push(d);
      else c.push(d);
    }
    return { pending: p, enCamino: ec, completados: c };
  }, [deliveries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Cargando panel de despacho...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/20 rounded-xl border border-orange-500/30">
            <Truck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Panel de Despacho</h1>
            {lastUpdated && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Actualizado: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="/driver"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium transition-colors"
            title="Abrir app motorizado"
          >
            <Bike className="w-3.5 h-3.5" />
            App Motorizado
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
        <MetricsSummary />
      </div>

      {/* Driver Status Bar */}
      {allDrivers.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-1.5">
            <Bike className="w-3 h-3" /> Motorizados
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {allDrivers.map(driver => (
              <DriverStatusCard key={driver.id} driver={driver} deliveries={deliveries} />
            ))}
          </div>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KanbanColumn
          title="Pendientes"
          count={pending.length}
          accentClass="bg-amber-500/10 border-amber-500/30"
          headerClass="text-amber-400"
          emptyText="Sin pedidos pendientes"
        >
          {pending.map(d => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              availableDrivers={availableDrivers}
              onAssignDriver={handleAssignDriver}
            />
          ))}
        </KanbanColumn>

        <KanbanColumn
          title="En camino"
          count={enCamino.length}
          accentClass="bg-violet-500/10 border-violet-500/30"
          headerClass="text-violet-400"
          emptyText="Sin entregas en camino"
        >
          {enCamino.map(d => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              availableDrivers={[]}
              onAssignDriver={handleAssignDriver}
            />
          ))}
        </KanbanColumn>

        <KanbanColumn
          title="Completados hoy"
          count={completados.length}
          accentClass="bg-emerald-500/10 border-emerald-500/30"
          headerClass="text-emerald-400"
          emptyText="Sin entregas completadas hoy"
        >
          {completados.slice(0, 15).map(d => (
            <DeliveryCard
              key={d.id}
              delivery={d}
              availableDrivers={[]}
              onAssignDriver={handleAssignDriver}
              compact
            />
          ))}
          {completados.length > 15 && (
            <a
              href="/admin/delivery/historial"
              className="block text-center text-xs text-orange-400 hover:text-orange-300 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Ver {completados.length - 15} más en historial →
            </a>
          )}
        </KanbanColumn>
      </div>

      {/* Quick stats bar */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Package className="w-4 h-4 text-amber-400" />
          <span>{pending.length} por asignar</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Clock className="w-4 h-4 text-violet-400" />
          <span>{enCamino.length} en ruta</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{completados.filter(d => d.status === 'DELIVERED').length} entregados</span>
        </div>
      </div>
    </div>
  );
}
