'use client';

/**
 * Tarjeta de Delivery para el Panel de Despacho
 */

import { useState } from 'react';

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
}

interface Props {
  delivery: DeliveryOrder;
  availableDrivers: Driver[];
  onAssignDriver: (deliveryId: string, driverId: string) => Promise<void>;
  compact?: boolean;
}

export function DeliveryCard({ delivery, availableDrivers, onAssignDriver, compact }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [assigning, setAssigning] = useState(false);

  const elapsedMins = getElapsedMinutes(delivery);
  const isDelayed = elapsedMins > 30;

  const handleAssign = async () => {
    if (!selectedDriver) return;
    setAssigning(true);
    try {
      await onAssignDriver(delivery.id, selectedDriver);
      setSelectedDriver('');
    } finally {
      setAssigning(false);
    }
  };

  if (compact) {
    return (
      <div className={`bg-white rounded-lg p-3 shadow-sm border ${
        delivery.status === 'DELIVERED' ? 'border-green-200' : 'border-red-200'
      }`}>
        <div className="flex justify-between items-center">
          <span className="font-medium text-sm">
            #{delivery.order_id.slice(0, 8)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            delivery.status === 'DELIVERED' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {delivery.status === 'DELIVERED' ? '✓ Entregado' : '✗ Fallido'}
          </span>
        </div>
        {delivery.delivery_time_mins && (
          <p className="text-xs text-gray-500 mt-1">
            Tiempo: {delivery.delivery_time_mins} min
          </p>
        )}
        {delivery.failure_reason && (
          <p className="text-xs text-red-600 mt-1">
            {delivery.failure_reason}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm border ${
      isDelayed ? 'border-red-300 bg-red-50' : 'border-gray-200'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold">
          #{delivery.order_id.slice(0, 8)}
        </span>
        <StatusBadge status={delivery.status} />
      </div>

      <p className="text-sm text-gray-700 mb-1">
        📍 {delivery.address_text}
      </p>
      {delivery.address_reference && (
        <p className="text-xs text-gray-500 mb-2">
          Ref: {delivery.address_reference}
        </p>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <a 
          href={`tel:${delivery.customer_phone}`}
          className="text-blue-600 hover:underline"
        >
          📞 {delivery.customer_phone}
        </a>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className={`${isDelayed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
          ⏱️ {elapsedMins} min {isDelayed && '⚠️ DEMORADO'}
        </span>
        <span className="text-gray-500">
          S/ {(delivery.delivery_fee / 100).toFixed(2)}
        </span>
      </div>

      {delivery.status === 'PENDING' && availableDrivers.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
            className="flex-1 text-sm border rounded px-2 py-1"
          >
            <option value="">Seleccionar motorizado...</option>
            {availableDrivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedDriver || assigning}
            className="px-3 py-1 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {assigning ? '...' : 'Asignar'}
          </button>
        </div>
      )}

      {delivery.status === 'PENDING' && availableDrivers.length === 0 && (
        <p className="mt-3 text-xs text-amber-600">
          ⚠️ No hay motorizados disponibles
        </p>
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

  const labels: Record<string, string> = {
    PENDING: 'Pendiente',
    ASSIGNED: 'Asignado',
    DISPATCHED: 'En camino',
    DELIVERED: 'Entregado',
    FAILED: 'Fallido',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[status] || 'bg-gray-100'}`}>
      {labels[status] || status}
    </span>
  );
}

function getElapsedMinutes(delivery: DeliveryOrder): number {
  const startTime = delivery.dispatched_at || delivery.assigned_at || delivery.created_at;
  const start = new Date(startTime);
  const now = new Date();
  return Math.round((now.getTime() - start.getTime()) / (1000 * 60));
}
