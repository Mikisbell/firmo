'use client';

import { useState } from 'react';
import { MapPin, Phone, Clock, AlertTriangle, CheckCircle, XCircle, Bike } from 'lucide-react';
import { formatCents } from '@/src/core/domain/money';

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
}

interface Props {
  delivery: DeliveryOrder;
  availableDrivers: Driver[];
  onAssignDriver: (deliveryId: string, driverId: string) => Promise<void>;
  compact?: boolean;
}

function getElapsedMinutes(delivery: DeliveryOrder): number {
  const startTime = delivery.dispatched_at || delivery.assigned_at || delivery.created_at;
  return Math.round((Date.now() - new Date(startTime).getTime()) / 60000);
}

const STATUS_CONFIG = {
  PENDING:    { label: 'Pendiente',   bg: 'bg-amber-500/15',   border: 'border-amber-500/40',   badge: 'bg-amber-500/20 text-amber-300'   },
  ASSIGNED:   { label: 'Asignado',    bg: 'bg-blue-500/15',    border: 'border-blue-500/40',    badge: 'bg-blue-500/20 text-blue-300'    },
  DISPATCHED: { label: 'En camino',   bg: 'bg-violet-500/15',  border: 'border-violet-500/40',  badge: 'bg-violet-500/20 text-violet-300 animate-pulse' },
  DELIVERED:  { label: 'Entregado',   bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300' },
  FAILED:     { label: 'Fallido',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     badge: 'bg-red-500/20 text-red-300'      },
} as const;

export function DeliveryCard({ delivery, availableDrivers, onAssignDriver, compact }: Props) {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [assigning, setAssigning] = useState(false);

  const elapsedMins = getElapsedMinutes(delivery);
  const isDelayed = elapsedMins > 30 && (delivery.status === 'ASSIGNED' || delivery.status === 'DISPATCHED');
  const cfg = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.PENDING;
  const shortId = delivery.order_id.slice(-6).toUpperCase();

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
      <div className={`rounded-lg p-3 border ${cfg.bg} ${cfg.border}`}>
        <div className="flex justify-between items-center">
          <span className="font-mono text-xs font-semibold text-zinc-300">#{shortId}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1 truncate">{delivery.address_text}</p>
        {delivery.delivery_time_mins && (
          <p className="text-[10px] text-zinc-500 mt-0.5">⏱ {delivery.delivery_time_mins} min</p>
        )}
        {delivery.failure_reason && (
          <p className="text-[10px] text-red-400 mt-0.5">{delivery.failure_reason}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cfg.bg} ${cfg.border} ${isDelayed ? 'ring-1 ring-red-500/50' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-mono text-sm font-bold text-white">#{shortId}</span>
          {isDelayed && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-red-400">
              <AlertTriangle className="w-3 h-3" /> DEMORADO
            </span>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Address */}
      <div className="flex items-start gap-2 text-sm">
        <MapPin className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-zinc-200 leading-snug">{delivery.address_text}</p>
          {delivery.address_reference && (
            <p className="text-zinc-500 text-xs mt-0.5">Ref: {delivery.address_reference}</p>
          )}
        </div>
      </div>

      {/* Phone + Fee + Time */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <a href={`tel:${delivery.customer_phone}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <Phone className="w-3 h-3" />
          {delivery.customer_phone}
        </a>
        <span className="text-zinc-300 font-medium">{formatCents(delivery.delivery_fee)}</span>
      </div>

      {/* Elapsed time */}
      <div className="flex items-center gap-1 text-xs">
        <Clock className={`w-3 h-3 ${isDelayed ? 'text-red-400' : 'text-zinc-500'}`} />
        <span className={isDelayed ? 'text-red-400 font-medium' : 'text-zinc-500'}>
          {elapsedMins} min {delivery.status === 'DISPATCHED' ? 'en camino' : 'esperando'}
        </span>
      </div>

      {/* Driver assigned */}
      {delivery.drivers && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-800/50 rounded-lg px-2.5 py-1.5">
          <Bike className="w-3 h-3 text-orange-400" />
          <span>{delivery.drivers.name}</span>
          {delivery.drivers.phone && (
            <a href={`tel:${delivery.drivers.phone}`} className="ml-auto text-blue-400 hover:text-blue-300">
              {delivery.drivers.phone}
            </a>
          )}
        </div>
      )}

      {/* Assign driver */}
      {delivery.status === 'PENDING' && (
        <div className="flex gap-2 pt-1">
          {availableDrivers.length > 0 ? (
            <>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="flex-1 text-xs bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Seleccionar motorizado...</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedDriver || assigning}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
              >
                {assigning ? '...' : 'Asignar'}
              </button>
            </>
          ) : (
            <p className="text-xs text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Sin motorizados disponibles
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {delivery.status === 'DELIVERED' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle className="w-3.5 h-3.5" />
          Entregado en {delivery.delivery_time_mins ?? elapsedMins} min
        </div>
      )}
      {delivery.status === 'FAILED' && delivery.failure_reason && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {delivery.failure_reason}
        </div>
      )}
    </div>
  );
}
