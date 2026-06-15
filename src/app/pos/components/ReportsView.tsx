"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui";
import { LineChart, DollarSign, Receipt, TrendingUp, Clock } from "lucide-react";

export function ReportsView() {
    const { session } = useAuth();
    const [data, setData] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.tenant_id) return;
        
        fetch(`/api/data-sync/reports`)
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    setData(res);
                } else {
                    toast.error("Error cargando reportes");
                }
            })
            .catch(() => toast.error("Error de red cargando reportes"))
            .finally(() => setLoading(false));
    }, [session?.tenant_id]);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-zinc-200 border-t-emerald-500 rounded-full" />
            </div>
        );
    }

    if (!data) return null;

    const summary = data.summary;
    const orders = data.recent_orders;

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-zinc-100 dark:bg-zinc-900">
            <div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Reportes Diarios</h2>
                <p className="text-sm text-zinc-500">Resumen de ventas y operaciones del día de hoy</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex items-center gap-4">
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                        <DollarSign className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Ventas Totales</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {(summary.total_sales_cents / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                        </h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex items-center gap-4">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Receipt className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Órdenes Completadas</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {summary.total_orders}
                        </h3>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex items-center gap-4">
                    <div className="p-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl">
                        <TrendingUp className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Ticket Promedio</p>
                        <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                            {summary.total_orders > 0 
                                ? ((summary.total_sales_cents / summary.total_orders) / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })
                                : "S/ 0.00"
                            }
                        </h3>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mt-4">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Últimas 50 Órdenes Pagadas</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900/50">
                                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Orden #</th>
                                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mesa</th>
                                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo</th>
                                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hora</th>
                                <th className="p-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                            {orders.map((order: Record<string, any>) => (
                                <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="p-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        #{order.order_number}
                                    </td>
                                    <td className="p-4 text-sm text-zinc-600 dark:text-zinc-300">
                                        {order.table_number ? `Mesa ${order.table_number}` : "-"}
                                    </td>
                                    <td className="p-4">
                                        <Badge variant={order.order_type === "DINE_IN" ? "success" : "info"}>
                                            {order.order_type}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-sm text-zinc-500 flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4 text-sm font-bold text-zinc-900 dark:text-white text-right">
                                        {(order.total_cents / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                                        No hay órdenes pagadas el día de hoy.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
