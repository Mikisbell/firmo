/**
 * Order List Component
 * 
 * Displays list of orders pending payment.
 */

'use client';

import { Receipt, Clock, ChevronRight } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: number;
  tableNumber?: string;
  customerName?: string;
  items: any[];
  total: number;
  status: string;
  createdAt: string;
}

interface OrderListProps {
  orders: Order[];
  loading: boolean;
  onSelect: (order: Order) => void;
}

export default function OrderList({ orders, loading, onSelect }: OrderListProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-zinc-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-zinc-400" />
          </div>
          <p className="text-zinc-400">No hay órdenes pendientes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="font-semibold">Órdenes Pendientes ({orders.length})</h3>
      </div>
      
      <div className="divide-y divide-zinc-800">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => onSelect(order)}
            className="w-full p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors text-left"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold">Orden #{order.orderNumber}</span>
                {order.tableNumber && (
                  <span className="text-sm text-zinc-400">• Mesa {order.tableNumber}</span>
                )}
              </div>
              <div className="text-sm text-zinc-400">
                {order.items.length} items • {new Date(order.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold">S/{order.total.toFixed(2)}</span>
              <ChevronRight className="w-5 h-5 text-zinc-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
