'use client';

/**
 * Compras (Purchases) Page
 *
 * Purchase order management: list, create, update status.
 *
 * @module app/admin/compras/page
 */

import { useState, useCallback } from 'react';
import { ShoppingCart, Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { usePurchaseOrders } from '@/src/hooks/useSWRHooks';
import type { PurchaseOrderStatus } from '@/src/core/services/purchases.service';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-600 text-zinc-200',
  CONFIRMED: 'bg-blue-500/20 text-blue-400',
  RECEIVED: 'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  CONFIRMED: 'Confirmada',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
};

function formatCurrency(cents: number) {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

const DEFAULT_LOCATION = 'loc-default';

export default function ComprasPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, error, isLoading, mutate } = usePurchaseOrders(
    { locationId: DEFAULT_LOCATION, status: statusFilter || undefined },
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
      toast.success(`Orden actualizada a ${STATUS_LABELS[newStatus]}`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    }
  }, [mutate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-blue-400" />
            Compras
          </h1>
          <p className="text-zinc-400 mt-1">Órdenes de compra a proveedores</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <label className="text-sm text-zinc-400">Estado:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm min-h-[40px]"
        >
          <option value="">Todos</option>
          <option value="DRAFT">Borrador</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="RECEIVED">Recibida</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          Error al cargar órdenes de compra.
        </div>
      )}

      {/* Orders Table */}
      {data && data.orders.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-3 text-zinc-400">#</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Proveedor</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Estado</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Subtotal</th>
                  <th className="text-right px-4 py-3 text-zinc-400">IGV</th>
                  <th className="text-right px-4 py-3 text-zinc-400">Total</th>
                  <th className="text-left px-4 py-3 text-zinc-400">Fecha</th>
                  <th className="text-center px-4 py-3 text-zinc-400">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((po) => (
                  <tr key={po.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-mono text-zinc-500">
                      {po.orderNumber}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {po.supplierName || 'Sin proveedor'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] || ''}`}>
                        {STATUS_LABELS[po.status] || po.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatCurrency(po.subtotalCents)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">{formatCurrency(po.taxCents)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(po.totalCents)}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(po.createdAt).toLocaleDateString('es-PE')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {po.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(po.id, 'CONFIRMED')}
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                            >
                              Confirmar <ChevronRight className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(po.id, 'CANCELLED')}
                              className="text-xs text-red-400 hover:text-red-300 ml-2"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {po.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleUpdateStatus(po.id, 'RECEIVED')}
                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                          >
                            Recibida <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {(po.status === 'RECEIVED' || po.status === 'CANCELLED') && (
                          <span className="text-xs text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && data.orders.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No hay órdenes de compra</p>
          <p className="text-zinc-500 text-sm mt-1">
            {statusFilter ? 'Intenta cambiar el filtro' : 'Crea tu primera orden de compra'}
          </p>
        </div>
      )}
    </div>
  );
}
