'use client';

/**
 * Panel de Despacho de Delivery
 * Tres columnas: PENDIENTES, EN CAMINO, COMPLETADOS
 */

import { useState, useEffect, useCallback } from 'react';
import { DeliveryCard } from './components/DeliveryCard';
import { MetricsSummary } from './components/MetricsSummary';

interface DeliveryOrder {
  id: string;
  order_id: string;
  driver_id: string | null;
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
  status: 'available' | 'on_delivery' | 'inactive';
}

export default function DeliveryDispatchPage() {
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [deliveriesRes, driversRes] = await Promise.all([
        fetch('/api/delivery'),
        fetch('/api/drivers/available'),
      ]);

      if (!deliveriesRes.ok || !driversRes.ok) {
        throw new Error('Error fetching data');
      }

      const deliveriesData = await deliveriesRes.json();
      const driversData = await driversRes.json();

      setDeliveries(deliveriesData.deliveries || []);
      setAvailableDrivers(driversData.drivers || []);
      setError(null);
    } catch (err) {
      setError('Error cargando datos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Polling cada 10 segundos
    const interval = setInterval(fetchData, 10000);
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

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error asignando motorizado');
    }
  };

  const pending = deliveries.filter(d => d.status === 'PENDING');
  const enCamino = deliveries.filter(d => d.status === 'ASSIGNED' || d.status === 'DISPATCHED');
  const completados = deliveries.filter(d => d.status === 'DELIVERED' || d.status === 'FAILED');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">📦 Panel de Despacho</h1>
        <MetricsSummary />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Columna PENDIENTES */}
        <div className="bg-yellow-50 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-800 mb-3">
            PENDIENTES ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map(delivery => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                availableDrivers={availableDrivers}
                onAssignDriver={handleAssignDriver}
              />
            ))}
            {pending.length === 0 && (
              <p className="text-gray-500 text-sm">Sin pedidos pendientes</p>
            )}
          </div>
        </div>

        {/* Columna EN CAMINO */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h2 className="font-semibold text-blue-800 mb-3">
            EN CAMINO ({enCamino.length})
          </h2>
          <div className="space-y-3">
            {enCamino.map(delivery => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                availableDrivers={[]}
                onAssignDriver={handleAssignDriver}
              />
            ))}
            {enCamino.length === 0 && (
              <p className="text-gray-500 text-sm">Sin entregas en camino</p>
            )}
          </div>
        </div>

        {/* Columna COMPLETADOS */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h2 className="font-semibold text-gray-700 mb-3">
            COMPLETADOS HOY ({completados.length})
          </h2>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {completados.slice(0, 10).map(delivery => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                availableDrivers={[]}
                onAssignDriver={handleAssignDriver}
                compact
              />
            ))}
            {completados.length === 0 && (
              <p className="text-gray-500 text-sm">Sin entregas completadas hoy</p>
            )}
            {completados.length > 10 && (
              <a
                href="/admin/delivery/historial"
                className="text-blue-600 text-sm hover:underline block text-center"
              >
                Ver historial completo →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
