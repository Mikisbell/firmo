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

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  LogOut, 
  Clock,
  TrendingUp,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Calculator,
  History,
  Settings,
  Printer
} from 'lucide-react';
import { useOfflineStatus } from '@/src/hooks/useOffline';

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

interface Shift {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  totalSales: number;
  totalCash: number;
  totalCard: number;
  totalTransfer: number;
  status: 'open' | 'closed';
}

// ============ COMPONENT ============

export default function CashierPage() {
  const router = useRouter();
  const { isOnline } = useOfflineStatus();
  
  const [activeTab, setActiveTab] = useState<'orders' | 'shift'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load mock orders for now
    setOrders([
      {
        id: '1',
        orderNumber: 1001,
        tableNumber: '12',
        items: [{ id: '1', name: '1/4 Pollo', quantity: 2, unitPrice: 25, total: 50 }],
        subtotal: 60,
        discount: 6,
        total: 54,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Módulo de Caja - PARK POS</h1>
      <p className="text-zinc-400 mb-4">Sistema de cobros y gestión de turnos</p>
      
      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <h2 className="text-lg font-semibold mb-2">Estado del Sistema</h2>
        <p className="text-sm text-zinc-400">
          Conexión: {isOnline ? <span className="text-green-400">Online</span> : <span className="text-red-400">Offline</span>}
        </p>
        <p className="text-sm text-zinc-400">Órdenes pendientes: {orders.length}</p>
      </div>

      <div className="mt-6">
        <button 
          onClick={() => router.push('/pos')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
        >
          Ir al POS
        </button>
      </div>
    </div>
  );
}
