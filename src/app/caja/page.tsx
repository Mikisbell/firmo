/**
 * Cashier Module (Caja) - Main Page
 * 
 * Complete POS interface for processing payments, managing shifts,
 * and handling cash operations.
 * 
 * Features:
 * - Order selection and payment processing
 * - Multiple payment methods (cash, card, transfer, Yape, Plin)
 * - Change calculation
 * - Shift management (open/close)
 * - Cash drawer control
 * - Daily reports
 * 
 * @module app/caja
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOfflineStatus } from '@/src/hooks/useOffline';
import PaymentTerminal from './components/PaymentTerminal';

// ============ TYPES ============

interface Order {
  id: string;
  orderNumber: number;
  tableNumber?: string;
  customerName?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============ COMPONENT ============

export default function CashierPage() {
  const router = useRouter();
  const { isOnline } = useOfflineStatus();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPaymentTerminal, setShowPaymentTerminal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock orders for testing
    setOrders([
      {
        id: 'order-1',
        orderNumber: 1001,
        tableNumber: '12',
        customerName: undefined,
        items: [
          { id: 'item-1', name: '1/4 Pollo', quantity: 2, unitPrice: 25, total: 50 },
          { id: 'item-2', name: 'Papas Fritas', quantity: 1, unitPrice: 4, total: 4 },
        ],
        subtotal: 54,
        discount: 0,
        total: 54,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(false);
  }, []);

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowPaymentTerminal(true);
  };

  const handlePaymentComplete = async (payment: any) => {
    // Update order status
    setOrders(orders.map(o => 
      o.id === selectedOrder?.id 
        ? { ...o, status: 'paid' as const }
        : o
    ));
    
    // Close modal
    setShowPaymentTerminal(false);
    setSelectedOrder(null);
  };

  const handleClosePaymentTerminal = () => {
    setShowPaymentTerminal(false);
    setSelectedOrder(null);
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Módulo de Caja - PARK POS</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>
            Conexión: {isOnline ? (
              <span className="text-green-400">Online</span>
            ) : (
              <span className="text-red-400">Offline</span>
            )}
          </span>
          <span>Órdenes pendientes: {pendingOrders.length}</span>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-zinc-400">
            Cargando órdenes...
          </div>
        ) : pendingOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            No hay órdenes pendientes
          </div>
        ) : (
          pendingOrders.map(order => (
            <div 
              key={order.id}
              className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              onClick={() => handleSelectOrder(order)}
              data-testid={`order-card-${order.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold">Orden #{order.orderNumber}</h3>
                  {order.tableNumber && (
                    <p className="text-sm text-zinc-400">Mesa {order.tableNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">S/{order.total.toFixed(2)}</p>
                  <p className="text-xs text-zinc-400">{order.items.length} items</p>
                </div>
              </div>
              
              <div className="space-y-1">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm text-zinc-400">
                    <span>{item.quantity}x {item.name}</span>
                    <span>S/{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Terminal Modal */}
      {showPaymentTerminal && selectedOrder && (
        <PaymentTerminal
          order={selectedOrder}
          onClose={handleClosePaymentTerminal}
          onComplete={handlePaymentComplete}
        />
      )}
    </div>
  );
}
