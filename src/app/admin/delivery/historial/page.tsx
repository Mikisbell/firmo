'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Filter, ChevronLeft, ChevronRight, Clock, CheckCircle, XCircle, Bike, AlertCircle } from 'lucide-react';
import { formatCents } from '@/src/core/domain/money';
import { Badge, Button, Card, PageHeader, EmptyState } from '@/src/components/ui';

interface DeliveryOrder {
  id: string;
  order_id: string;
  driver_id: string | null;
  driver_name: string | null;
  address_text: string;
  customer_phone: string;
  delivery_fee: number;
  status: string;
  created_at: string;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  delivery_time_mins: number | null;
}

interface Driver {
  id: string;
  name: string;
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; label: string }> = {
  PENDING:    { variant: 'warning',  label: 'Pendiente' },
  ASSIGNED:   { variant: 'info',     label: 'Asignado' },
  DISPATCHED: { variant: 'info',     label: 'En camino' },
  DELIVERED:  { variant: 'success',  label: 'Entregado' },
  FAILED:     { variant: 'critical', label: 'Fallido' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { variant: 'neutral' as const, label: status };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

const LIMIT = 20;

export default function DeliveryHistoryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [driverId, setDriverId] = useState('');
  const [offset, setOffset] = useState(0);

  async function fetchHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (status) params.set('status', status);
      if (driverId) params.set('driverId', driverId);
      params.set('limit', String(LIMIT));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/delivery/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
        setTotal(data.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetch('/api/drivers')
      .then(res => res.json())
      .then(data => setDrivers((data.drivers || []).filter((d: Driver & { is_active?: boolean }) => d.is_active !== false)))
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetchHistory(); }, [dateFrom, dateTo, status, driverId, offset]);

  const inputClass = 'bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500';
  const labelClass = 'block text-[10px] uppercase tracking-wider text-zinc-500 mb-1';

  return (
    <div className="space-y-5 p-4 md:p-6">
      <PageHeader
        title="Historial Delivery"
        description={`${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
        backHref="/admin/delivery"
      />

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-park-gray-500" />
          <span className="text-[10px] uppercase tracking-widest text-park-gray-500">Filtros</span>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className={labelClass}>Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              <option value="DELIVERED">Entregado</option>
              <option value="FAILED">Fallido</option>
              <option value="DISPATCHED">En camino</option>
              <option value="ASSIGNED">Asignado</option>
              <option value="PENDING">Pendiente</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Motorizado</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <Button variant="primary" size="sm" onClick={() => { setOffset(0); fetchHistory(); }}>
            Aplicar
          </Button>
          {(dateFrom || dateTo || status || driverId) && (
            <Button variant="secondary" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setStatus(''); setDriverId(''); setOffset(0); }}>
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
              <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Pedido</th>
              <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Dirección</th>
              <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Motorizado</th>
              <th className="px-4 py-3 text-left text-park-gray-400 font-medium">Estado</th>
              <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Tarifa</th>
              <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Tiempo</th>
              <th className="px-4 py-3 text-right text-park-gray-400 font-medium">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-park-gray-800/60">
            {deliveries.map(d => (
              <tr key={d.id} className="hover:bg-park-gray-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-300 font-semibold">
                  #{d.order_id.slice(-6).toUpperCase()}
                </td>
                <td className="px-4 py-3 text-zinc-400 max-w-[200px]">
                  <p className="truncate">{d.address_text}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {d.driver_name ? (
                    <span className="flex items-center gap-1.5">
                      <Bike className="w-3 h-3 text-orange-400 shrink-0" />
                      {d.driver_name}
                    </span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-4 py-3 text-right text-zinc-300 font-medium">
                  {formatCents(d.delivery_fee)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500">
                  {d.delivery_time_mins ? `${d.delivery_time_mins} min` : '—'}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500">
                  {new Date(d.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })}
                  <span className="block text-[10px] text-zinc-600">
                    {new Date(d.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="p-10 flex items-center justify-center">
            <div className="w-7 h-7 border-4 border-zinc-700 border-t-orange-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && deliveries.length === 0 && (
          <EmptyState
            icon={<ClipboardList />}
            title="No se encontraron entregas"
            description="Prueba cambiando los filtros"
          />
        )}
      </Card>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex justify-between items-center pt-1">
          <span className="text-xs text-zinc-500">
            {offset + 1}–{Math.min(offset + LIMIT, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors text-zinc-300"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Anterior
            </button>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg disabled:opacity-40 hover:bg-zinc-700 transition-colors text-zinc-300"
            >
              Siguiente <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
