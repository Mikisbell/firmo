'use client';

/**
 * Public Delivery Tracking Page
 *
 * Customer-facing, no auth required.
 * Mobile-first design with status timeline.
 * Auto-refreshes every 15 seconds.
 */

import { useState, useEffect, use } from 'react';
import {
  Package,
  Truck,
  MapPin,
  CheckCircle,
  Clock,
  User,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface TrackingData {
  trackingCode: string;
  status: string;
  address: string;
  driverName: string | null;
  restaurantName: string;
  createdAt: string;
  assignedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  estimatedDeliveryAt: string | null;
}

type DeliveryStep = 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED';

const STEPS: { key: DeliveryStep; label: string; icon: typeof Package }[] = [
  { key: 'PENDING', label: 'Pedido recibido', icon: Package },
  { key: 'ASSIGNED', label: 'Motorizado asignado', icon: User },
  { key: 'DISPATCHED', label: 'En camino', icon: Truck },
  { key: 'DELIVERED', label: 'Entregado', icon: CheckCircle },
];

const STEP_ORDER: Record<string, number> = {
  PENDING: 0,
  ASSIGNED: 1,
  DISPATCHED: 2,
  DELIVERED: 3,
};

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface PageParams {
  code: string;
}

export default function TrackingPage({ params }: { params: Promise<PageParams> }) {
  const { code } = use(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTracking = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/track/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'No se pudo obtener el estado del pedido');
        setData(null);
        return;
      }
      const trackingData: TrackingData = await res.json();
      setData(trackingData);
      setError(null);
      setLastUpdated(new Date());
    } catch {
      setError('Error de conexión. Verifica tu internet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking(true);
  }, [code]);

  // Auto-refresh every 15 seconds (only if not in terminal state)
  useEffect(() => {
    if (!data) return;
    const isTerminal = data.status === 'DELIVERED' || data.status === 'FAILED' || data.status === 'CANCELLED';
    if (isTerminal) return;

    const interval = setInterval(() => fetchTracking(false), 15_000);
    return () => clearInterval(interval);
  }, [data?.status, code]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="mt-3 text-gray-500 text-sm">Buscando tu pedido...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white px-6">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Pedido no encontrado</h1>
        <p className="text-gray-500 text-sm text-center mb-6">{error ?? 'No se pudo cargar el seguimiento'}</p>
        <button
          onClick={() => fetchTracking(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  const isFailed = data.status === 'FAILED';
  const isCancelled = data.status === 'CANCELLED';
  const currentStepIndex = STEP_ORDER[data.status] ?? -1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">
            Seguimiento de pedido
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {data.trackingCode}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{data.restaurantName}</p>
        </div>
      </div>

      {/* Failed / Cancelled Banner */}
      {(isFailed || isCancelled) && (
        <div className="max-w-lg mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">
                {isFailed ? 'No se pudo completar la entrega' : 'Pedido cancelado'}
              </p>
              <p className="text-red-600 text-xs mt-1">
                Contacte al restaurante para más información.
              </p>
              {data.failedAt && (
                <p className="text-red-400 text-xs mt-2">{formatDateTime(data.failedAt)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="space-y-0">
              {STEPS.map((step, index) => {
                const isCompleted = !isFailed && currentStepIndex >= index;
                const isCurrent = !isFailed && currentStepIndex === index;
                const isPending = !isCompleted;
                const isLast = index === STEPS.length - 1;
                const Icon = step.icon;

                // Get timestamp for this step
                let timestamp: string | null = null;
                if (step.key === 'PENDING') timestamp = formatTime(data.createdAt);
                if (step.key === 'ASSIGNED') timestamp = formatTime(data.assignedAt);
                if (step.key === 'DISPATCHED') timestamp = formatTime(data.dispatchedAt);
                if (step.key === 'DELIVERED') timestamp = formatTime(data.deliveredAt);

                return (
                  <div key={step.key} className="flex gap-4">
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isCurrent
                            ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                            : isCompleted
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {!isLast && (
                        <div
                          className={`w-0.5 h-12 my-1 ${
                            isCompleted && currentStepIndex > index
                              ? 'bg-green-300'
                              : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="pt-2 pb-4 min-w-0">
                      <p
                        className={`font-semibold text-sm ${
                          isCurrent
                            ? 'text-blue-700'
                            : isCompleted
                              ? 'text-green-700'
                              : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>

                      {/* Extra info per step */}
                      {step.key === 'ASSIGNED' && data.driverName && isCompleted && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Motorizado: {data.driverName}
                        </p>
                      )}

                      {timestamp && isCompleted && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timestamp}
                        </p>
                      )}

                      {isCurrent && step.key === 'DISPATCHED' && data.estimatedDeliveryAt && (
                        <p className="text-xs text-blue-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Llegada estimada: {formatTime(data.estimatedDeliveryAt)}
                        </p>
                      )}

                      {isPending && !isFailed && step.key !== 'PENDING' && (
                        <p className="text-xs text-gray-300 mt-0.5">Pendiente</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Address */}
      <div className="max-w-lg mx-auto px-4 pb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              Dirección de entrega
            </p>
            <p className="text-sm text-gray-700 mt-1">{data.address}</p>
          </div>
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <div className="max-w-lg mx-auto px-4 pb-8 text-center">
          <p className="text-xs text-gray-300">
            Actualizado: {lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
          {data.status !== 'DELIVERED' && data.status !== 'FAILED' && data.status !== 'CANCELLED' && (
            <p className="text-xs text-gray-300 mt-0.5">Se actualiza cada 15 segundos</p>
          )}
        </div>
      )}
    </div>
  );
}
