'use client';

/**
 * Pedidos de Plataformas - Real-time Orders Page
 *
 * Shows incoming orders from external platforms with accept/reject actions.
 * Auto-refreshes every 15 seconds.
 *
 * @module app/admin/plataformas/pedidos/page
 */

import { useState, useCallback } from 'react';
import { Smartphone, CheckCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { usePlatformOrders } from '@/src/hooks/useSWRHooks';
import type { PlatformOrderStatus } from '@/src/core/types/platform';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  RECEIVED: { label: 'Recibido', color: 'bg-amber-500/20 text-amber-400' },
  ACCEPTED: { label: 'Aceptado', color: 'bg-emerald-500/20 text-emerald-400' },
  REJECTED: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400' },
  PREPARING: { label: 'Preparando', color: 'bg-blue-500/20 text-blue-400' },
  READY: { label: 'Listo', color: 'bg-cyan-500/20 text-cyan-400' },
  DISPATCHED: { label: 'Despachado', color: 'bg-purple-500/20 text-purple-400' },
  DELIVERED: { label: 'Entregado', color: 'bg-emerald-500/20 text-emerald-400' },
  CANCELLED: { label: 'Cancelado', color: 'bg-zinc-500/20 text-zinc-400' },
};

const PLATFORM_COLORS: Record<string, string> = {
  PEDIDOSYA: 'bg-red-500',
  LLAMAFOOD: 'bg-green-500',
  RAPPI: 'bg-orange-500',
};

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PedidosPlataformaPage() {
  const [statusFilter, setStatusFilter] = useState<PlatformOrderStatus | ''>('');
  const [platformFilter, setPlatformFilter] = useState('');
  const { data, error, isLoading, mutate } = usePlatformOrders({
    platform: (platformFilter as any) || undefined,
    status: (statusFilter as any) || undefined,
    limit: 50,
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleAccept = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/platform-orders/${id}/accept`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success('Pedido aceptado');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al aceptar');
    }
  }, [mutate]);

  const handleReject = useCallback(async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Ingresa una razón');
      return;
    }
    try {
      const res = await fetch(`/api/admin/platform-orders/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success('Pedido rechazado');
      setRejectingId(null);
      setRejectReason('');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al rechazar');
    }
  }, [rejectReason, mutate]);

  const orders = data?.orders ?? [];
  const receivedCount = orders.filter((o) => o.status === 'RECEIVED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-cyan-400" />
            Pedidos de Apps
            {receivedCount > 0 && (
              <span className="bg-amber-500 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                {receivedCount} nuevo{receivedCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-zinc-400 mt-1">Pedidos de PedidosYa, LlamaFood, Rappi</p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm min-h-[40px]"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
        >
          <option value="">Todas las apps</option>
          <option value="PEDIDOSYA">PedidosYa</option>
          <option value="LLAMAFOOD">LlamaFood</option>
          <option value="RAPPI">Rappi</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
        >
          <option value="">Todos los estados</option>
          <option value="RECEIVED">Recibido</option>
          <option value="ACCEPTED">Aceptado</option>
          <option value="REJECTED">Rechazado</option>
          <option value="PREPARING">Preparando</option>
          <option value="READY">Listo</option>
        </select>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar pedidos.
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3">
        {orders.map((order) => {
          const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.RECEIVED;
          const platformColor = PLATFORM_COLORS[order.platform] || 'bg-zinc-500';

          return (
            <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${platformColor}`} />
                    <span className="text-sm font-bold">{order.platform}</span>
                    <span className="text-xs text-zinc-500">#{order.platformOrderId}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {order.customerName && (
                    <p className="text-sm text-zinc-300">{order.customerName}</p>
                  )}
                  {order.deliveryAddress && (
                    <p className="text-xs text-zinc-500 mt-0.5">{order.deliveryAddress}</p>
                  )}

                  {/* Items */}
                  <div className="mt-2 space-y-0.5">
                    {order.items.map((item, i) => (
                      <div key={i} className="text-xs text-zinc-400">
                        {item.quantity}x {item.name}
                        {item.notes && <span className="text-zinc-500 ml-1">({item.notes})</span>}
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <p className="text-xs text-amber-400 mt-1">Nota: {order.notes}</p>
                  )}
                </div>

                {/* Right side: amounts + actions */}
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold">{formatCurrency(order.platformTotalCents)}</p>
                  <p className="text-xs text-zinc-500">
                    Restaurante: {formatCurrency(order.restaurantTotalCents)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Comisión: {formatCurrency(order.commissionCents)}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">
                    <Clock className="w-3 h-3 inline mr-0.5" />
                    {formatTime(order.createdAt)}
                  </p>

                  {order.status === 'RECEIVED' && (
                    <div className="mt-3 flex gap-2 justify-end">
                      <button
                        onClick={() => handleAccept(order.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-medium min-h-[32px]"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Aceptar
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(order.id);
                          setRejectReason('');
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium min-h-[32px]"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Rechazar
                      </button>
                    </div>
                  )}

                  {order.orderId && (
                    <p className="text-xs text-cyan-400 mt-1 flex items-center gap-1 justify-end">
                      <ExternalLink className="w-3 h-3" /> Orden interna
                    </p>
                  )}
                </div>
              </div>

              {/* Rejection form */}
              {rejectingId === order.id && (
                <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
                  <input
                    type="text"
                    placeholder="Razón del rechazo..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm min-h-[36px]"
                    autoFocus
                  />
                  <button
                    onClick={() => handleReject(order.id)}
                    disabled={!rejectReason.trim()}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs font-medium min-h-[36px] disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs min-h-[36px]"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Rejection reason shown */}
              {order.rejectionReason && (
                <p className="text-xs text-red-400 mt-2 border-t border-zinc-800 pt-2">
                  Rechazado: {order.rejectionReason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && orders.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <Smartphone className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No hay pedidos de plataformas</p>
          <p className="text-zinc-500 text-sm mt-1">Los pedidos aparecerán aquí automáticamente</p>
        </div>
      )}
    </div>
  );
}
