'use client';

/**
 * Historial de Deliveries
 */

import { useState, useEffect } from 'react';

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

export default function DeliveryHistoryPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  
  // Filtros
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [driverId, setDriverId] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (status) params.set('status', status);
      if (driverId) params.set('driverId', driverId);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await fetch(`/api/admin/delivery/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status, driverId, offset]);

  useEffect(() => {
    fetch('/api/drivers')
      .then(res => res.json())
      .then(data => setDrivers(data.drivers || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, status, driverId, offset]);

  const handleFilter = () => {
    setOffset(0);
    fetchHistory();
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">📋 Historial de Entregas</h1>

      {/* Filtros */}
      <div className="bg-white rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Desde</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">Todos</option>
            <option value="DELIVERED">Entregado</option>
            <option value="FAILED">Fallido</option>
            <option value="PENDING">Pendiente</option>
            <option value="DISPATCHED">En camino</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Motorizado</label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="px-3 py-2 border rounded"
          >
            <option value="">Todos</option>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          Filtrar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Pedido</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Dirección</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Motorizado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Tiempo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deliveries.map(d => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-mono text-sm">
                  #{d.order_id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {d.address_text.slice(0, 40)}...
                </td>
                <td className="px-4 py-3 text-sm">
                  {d.driver_name || '-'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-4 py-3 text-sm">
                  {d.delivery_time_mins ? `${d.delivery_time_mins} min` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(d.created_at).toLocaleDateString('es-PE')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto" />
          </div>
        )}

        {!loading && deliveries.length === 0 && (
          <p className="p-8 text-center text-gray-500">
            No se encontraron entregas
          </p>
        )}
      </div>

      {/* Paginación */}
      {total > limit && (
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-600">
            Mostrando {offset + 1}-{Math.min(offset + limit, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    ASSIGNED: 'bg-blue-100 text-blue-700',
    DISPATCHED: 'bg-purple-100 text-purple-700',
    DELIVERED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <span className={`text-xs px-2 py-1 rounded ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}
