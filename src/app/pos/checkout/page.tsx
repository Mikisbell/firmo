"use client";

/**
 * Recent Sales / Checkout Page
 * Shows the last completed orders with reprint option.
 * The actual checkout flow is integrated into the main POS view
 * (CheckDetail -> PaymentModal -> InvoiceModal).
 */

import { useState, useEffect, useCallback } from "react";
import { Receipt, RefreshCw, Printer } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/src/components/auth";

interface RecentOrder {
  id: string;
  order_number: number;
  order_type: string;
  total_cents: number;
  created_at: string;
  order_status: string;
}

function formatCents(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

const typeLabels: Record<string, string> = {
  DINE_IN: "Mesa",
  TAKEOUT: "Para llevar",
  DELIVERY: "Delivery",
};

export default function CheckoutPage() {
  const { terminal } = useAuth();
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/orders?status=CONFIRMED&limit=20&sort=desc", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || data || []);
      }
    } catch {
      toast.error("Error al cargar ventas recientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleReprint = async (orderId: string) => {
    try {
      const res = await fetch("/api/pos/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "receipt", orderId }),
      });
      if (res.ok) {
        toast.success("Ticket enviado a impresora");
      } else {
        toast.error("Error al reimprimir");
      }
    } catch {
      toast.error("Error de conexión");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-park-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-park-gray-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-park-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="w-7 h-7 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Ventas Recientes</h1>
              <p className="text-park-gray-400 text-sm">{orders.length} ventas completadas</p>
            </div>
          </div>
          <button
            onClick={fetchOrders}
            className="p-2 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
            title="Actualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-12 text-center">
            <Receipt className="w-12 h-12 text-park-gray-600 mx-auto mb-3" />
            <p className="text-park-gray-400">Sin ventas completadas hoy</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-park-gray-900 rounded-xl border border-park-gray-800 p-4 flex items-center justify-between hover:bg-park-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-park-gray-800 flex items-center justify-center font-mono font-bold text-lg">
                    #{order.order_number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatCents(order.total_cents)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-park-gray-800 text-park-gray-400">
                        {typeLabels[order.order_type] || order.order_type}
                      </span>
                    </div>
                    <p className="text-sm text-park-gray-500">{formatTime(order.created_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleReprint(order.id)}
                  className="p-2 rounded-lg bg-park-gray-800 hover:bg-park-gray-700 transition-colors"
                  title="Reimprimir ticket"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
