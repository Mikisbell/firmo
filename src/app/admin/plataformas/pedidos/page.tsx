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
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'critical' | 'info' | 'neutral'; label: string }> = {
  RECEIVED: { variant: 'warning', label: 'Recibido' },
  ACCEPTED: { variant: 'success', label: 'Aceptado' },
  REJECTED: { variant: 'critical', label: 'Rechazado' },
  PREPARING: { variant: 'info', label: 'Preparando' },
  READY: { variant: 'info', label: 'Listo' },
  DISPATCHED: { variant: 'info', label: 'Despachado' },
  DELIVERED: { variant: 'success', label: 'Entregado' },
  CANCELLED: { variant: 'neutral', label: 'Cancelado' },
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
      <PageHeader
        title="Pedidos App"
        description="Pedidos de PedidosYa, LlamaFood, Rappi"
        actions={
          <div className="flex items-center gap-2">
            {receivedCount > 0 && (
              <Badge variant="warning" dot>{receivedCount} nuevo{receivedCount > 1 ? 's' : ''}</Badge>
            )}
            <Button
              variant="secondary"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={() => mutate()}
            >
              Actualizar
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
        >
          <option value="">Todas las apps</option>
          <option value="PEDIDOSYA">PedidosYa</option>
          <option value="LLAMAFOOD">LlamaFood</option>
          <option value="RAPPI">Rappi</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px] text-white"
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
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-park-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          Error al cargar pedidos.
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3">
        {orders.map((order) => {
          const statusCfg = STATUS_BADGE[order.status] || STATUS_BADGE.RECEIVED;
          const platformColor = PLATFORM_COLORS[order.platform] || 'bg-zinc-500';

          return (
            <Card key={order.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${platformColor}`} />
                    <span className="text-sm font-bold">{order.platform}</span>
                    <span className="text-xs text-zinc-500">#{order.platformOrderId}</span>
                    <Badge variant={statusCfg.variant} dot>{statusCfg.label}</Badge>
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
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle className="w-3.5 h-3.5" />}
                        onClick={() => handleAccept(order.id)}
                      >
                        Aceptar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        icon={<XCircle className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setRejectingId(order.id);
                          setRejectReason('');
                        }}
                      >
                        Rechazar
                      </Button>
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
                <div className="mt-3 flex items-center gap-2 border-t border-park-gray-800 pt-3">
                  <input
                    type="text"
                    placeholder="Razón del rechazo..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="flex-1 bg-park-gray-800 border border-park-gray-700 rounded px-3 py-1.5 text-sm min-h-[36px] text-white"
                    autoFocus
                  />
                  <Button variant="destructive" size="sm" onClick={() => handleReject(order.id)} disabled={!rejectReason.trim()}>
                    Confirmar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectingId(null)}>
                    Cancelar
                  </Button>
                </div>
              )}

              {/* Rejection reason shown */}
              {order.rejectionReason && (
                <p className="text-xs text-red-400 mt-2 border-t border-park-gray-800 pt-2">
                  Rechazado: {order.rejectionReason}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {!isLoading && orders.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<Smartphone />}
            title="No hay pedidos de plataformas"
            description="Los pedidos aparecerán aquí automáticamente"
          />
        </Card>
      )}
    </div>
  );
}
