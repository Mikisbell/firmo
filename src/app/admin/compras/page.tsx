'use client';

/**
 * Compras (Purchases) Page
 *
 * Purchase order management: list, create, update status.
 *
 * @module app/admin/compras/page
 */

import { useCallback } from 'react';
import { ShoppingCart, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { usePurchaseOrders, useLocations } from '@/src/hooks/useSWRHooks';
import type { PurchaseOrderStatus } from '@/src/core/services/purchases.service';
import { Button, Badge, Card, PageHeader, EmptyState } from '@/src/components/ui';
import { useQueryState } from '@/src/hooks/useQueryState';

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'info' | 'critical' | 'neutral'; label: string }> = {
  DRAFT: { variant: 'neutral', label: 'Borrador' },
  CONFIRMED: { variant: 'info', label: 'Confirmada' },
  RECEIVED: { variant: 'success', label: 'Recibida' },
  CANCELLED: { variant: 'critical', label: 'Cancelada' },
};

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

export default function ComprasPage() {
  const { data: locationsData } = useLocations();
  const locationId = locationsData?.locations[0]?.id ?? null;
  const [statusFilter, setStatusFilter] = useQueryState<string>('status', '');
  const { data, error, isLoading, mutate } = usePurchaseOrders(
    locationId ? { locationId, status: statusFilter || undefined } : null,
  );

  const handleUpdateStatus = useCallback(async (poId: string, newStatus: PurchaseOrderStatus) => {
    try {
      const res = await fetch(`/api/admin/purchases/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      toast.success(`Orden actualizada a ${STATUS_BADGE[newStatus]?.label ?? newStatus}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    }
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <div className="h-10 w-64 bg-park-gray-800 rounded-lg animate-pulse" />
        <Card padding="none">
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-park-gray-800 rounded animate-pulse" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <PageHeader
        title="Compras"
        description="Ordenes de compra a proveedores"
      />

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-4">
          <label className="text-sm text-park-gray-400">Estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-park-gray-800 border border-park-gray-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="RECEIVED">Recibida</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
      </Card>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar ordenes de compra.
        </div>
      )}

      {/* Orders Table */}
      {data && data.orders.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">#</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Proveedor</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Subtotal</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">IGV</th>
                  <th className="text-right px-4 py-3 text-park-gray-400 font-medium">Total</th>
                  <th className="text-left px-4 py-3 text-park-gray-400 font-medium">Fecha</th>
                  <th className="text-center px-4 py-3 text-park-gray-400 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((po) => {
                  const badge = STATUS_BADGE[po.status] || { variant: 'neutral' as const, label: po.status };
                  return (
                    <tr key={po.id} className="border-b border-park-gray-800/50 hover:bg-park-gray-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-park-gray-500">
                        {po.orderNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {po.supplierName || 'Sin proveedor'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(po.subtotalCents)}</td>
                      <td className="px-4 py-3 text-right text-park-gray-500">{formatCurrency(po.taxCents)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(po.totalCents)}</td>
                      <td className="px-4 py-3 text-park-gray-500">
                        {new Date(po.createdAt).toLocaleDateString('es-PE')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {po.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                iconRight={<ChevronRight className="w-3 h-3" />}
                                onClick={() => handleUpdateStatus(po.id, 'CONFIRMED')}
                              >
                                Confirmar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleUpdateStatus(po.id, 'CANCELLED')}
                              >
                                Cancelar
                              </Button>
                            </>
                          )}
                          {po.status === 'CONFIRMED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              iconRight={<ChevronRight className="w-3 h-3" />}
                              onClick={() => handleUpdateStatus(po.id, 'RECEIVED')}
                            >
                              Recibida
                            </Button>
                          )}
                          {(po.status === 'RECEIVED' || po.status === 'CANCELLED') && (
                            <span className="text-xs text-park-gray-600">&mdash;</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && data.orders.length === 0 && (
        <Card padding="none">
          <EmptyState
            icon={<ShoppingCart />}
            title="No hay ordenes de compra"
            description={statusFilter ? 'Intenta cambiar el filtro' : 'Crea tu primera orden de compra'}
          />
        </Card>
      )}
    </div>
  );
}
