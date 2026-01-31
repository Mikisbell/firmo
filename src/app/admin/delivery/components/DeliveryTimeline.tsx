'use client';

/**
 * DeliveryTimeline Component
 * Muestra la línea de tiempo de un delivery con todos los timestamps
 * 
 * Requirements: 8.2, 8.3
 */

import { Check, Clock, Truck, MapPin, X, Camera } from 'lucide-react';

interface DeliveryTimelineProps {
  delivery: {
    id: string;
    status: string;
    created_at: string;
    assigned_at: string | null;
    dispatched_at: string | null;
    delivered_at: string | null;
    failed_at: string | null;
    failure_reason: string | null;
    signature_url: string | null;
    delivery_time_mins: number | null;
  };
  driverName?: string;
}

interface TimelineStep {
  label: string;
  timestamp: string | null;
  icon: React.ElementType;
  status: 'completed' | 'current' | 'pending' | 'failed';
}

export default function DeliveryTimeline({ delivery, driverName }: DeliveryTimelineProps) {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-PE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
    });
  };

  const isFailed = delivery.status === 'FAILED';
  const isDelivered = delivery.status === 'DELIVERED';

  const steps: TimelineStep[] = [
    {
      label: 'Pedido creado',
      timestamp: delivery.created_at,
      icon: Clock,
      status: 'completed',
    },
    {
      label: driverName ? `Asignado a ${driverName}` : 'Motorizado asignado',
      timestamp: delivery.assigned_at,
      icon: MapPin,
      status: delivery.assigned_at ? 'completed' : 'pending',
    },
    {
      label: 'En camino',
      timestamp: delivery.dispatched_at,
      icon: Truck,
      status: delivery.dispatched_at 
        ? (delivery.status === 'DISPATCHED' ? 'current' : 'completed')
        : 'pending',
    },
  ];

  // Add final step based on outcome
  if (isFailed) {
    steps.push({
      label: 'No entregado',
      timestamp: delivery.failed_at,
      icon: X,
      status: 'failed',
    });
  } else {
    steps.push({
      label: 'Entregado',
      timestamp: delivery.delivered_at,
      icon: Check,
      status: isDelivered ? 'completed' : 'pending',
    });
  }

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">Línea de tiempo</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={index} className="flex gap-3">
            {/* Icon */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
              ${step.status === 'completed' ? 'bg-green-500/20 text-green-400' : ''}
              ${step.status === 'current' ? 'bg-purple-500/20 text-purple-400' : ''}
              ${step.status === 'pending' ? 'bg-zinc-700 text-zinc-500' : ''}
              ${step.status === 'failed' ? 'bg-red-500/20 text-red-400' : ''}
            `}>
              <step.icon className="w-4 h-4" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                step.status === 'pending' ? 'text-zinc-500' : 'text-white'
              }`}>
                {step.label}
              </p>
              {step.timestamp && (
                <p className="text-xs text-zinc-500">
                  {formatDate(step.timestamp)} {formatTime(step.timestamp)}
                </p>
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="absolute left-4 mt-8 w-0.5 h-4 bg-zinc-700" />
            )}
          </div>
        ))}
      </div>

      {/* Failure reason */}
      {isFailed && delivery.failure_reason && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-xs text-red-400 font-medium mb-1">Motivo:</p>
          <p className="text-sm text-red-300">{delivery.failure_reason}</p>
        </div>
      )}

      {/* Delivery time */}
      {isDelivered && delivery.delivery_time_mins !== null && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-xs text-green-400 font-medium">
            Tiempo de entrega: {delivery.delivery_time_mins} minutos
          </p>
        </div>
      )}

      {/* Photo proof */}
      {delivery.signature_url && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
            <Camera className="w-3 h-3" />
            <span>Foto de entrega</span>
          </div>
          <img
            src={delivery.signature_url}
            alt="Prueba de entrega"
            className="w-full h-32 object-cover rounded-lg"
          />
        </div>
      )}
    </div>
  );
}
