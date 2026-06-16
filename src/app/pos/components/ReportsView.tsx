"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/src/components/auth";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui";
import { DollarSign, Receipt, TrendingUp, Clock, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";

interface ReportSummary {
    total_sales_cents: number;
    total_orders: number;
    by_type: Record<string, number>;
}

interface ReportOrder {
    id: string;
    order_number: number;
    order_type: string;
    total_cents: number;
    created_at: string | Date;
    table_number?: string | null;
}

interface ReportData {
    summary: ReportSummary;
    recent_orders: ReportOrder[];
    source: "server" | "local";
}

// Build reports locally from IndexedDB event projections (offline-first)
async function buildLocalReport(): Promise<ReportData> {
    const db = getDb();
    if (!db) throw new Error("DB not available");

    const { applySaleEvent } = await import("@/src/core/projections/sale.reducer");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orderEvents = await db.events
        .where("aggregate_type")
        .equals("ORDER")
        .toArray() as any[];

    // Group by order_id
    const eventsByOrder = new Map<string, any[]>();
    for (const e of orderEvents) {
        let list = eventsByOrder.get(e.aggregate_id);
        if (!list) { list = []; eventsByOrder.set(e.aggregate_id, list); }
        list.push(e);
    }

    const paidOrders: ReportOrder[] = [];
    let total_sales_cents = 0;
    const by_type: Record<string, number> = {};

    for (const [orderId, events] of eventsByOrder.entries()) {
        events.sort((a: any, b: any) => a.terminal_sequence - b.terminal_sequence);
        let state: any = null;
        for (const e of events) {
            state = applySaleEvent(state, e).state;
        }
        if (!state) continue;

        // Check if all checks are fully paid
        const allChecksPaid = (state.checks || []).length > 0 &&
            (state.checks || []).every((c: any) => {
                const paid = (c.payment?.payments || []).reduce((s: number, p: any) => s + p.amount_cents, 0);
                return paid >= c.total_cents && c.total_cents > 0;
            });

        if (!allChecksPaid) continue;

        // Get the timestamp of the last event (when it was paid)
        const lastEvent = events[events.length - 1];
        const paidAt = new Date(lastEvent.occurred_at);
        if (paidAt < today) continue; // Only today

        const orderTotal = (state.checks || []).reduce((s: number, c: any) => s + c.total_cents, 0);
        total_sales_cents += orderTotal;
        by_type[state.order_type] = (by_type[state.order_type] || 0) + orderTotal;

        paidOrders.push({
            id: orderId,
            order_number: state.order_number,
            order_type: state.order_type,
            total_cents: orderTotal,
            created_at: paidAt.toISOString(),
            table_number: state.fulfillment?.table_number,
        });
    }

    paidOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
        summary: { total_sales_cents, total_orders: paidOrders.length, by_type },
        recent_orders: paidOrders.slice(0, 50),
        source: "local",
    };
}

export function ReportsView() {
    const { session } = useAuth();
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const loadReports = async () => {
        setLoading(true);
        try {
            // Try server first
            const res = await fetch("/api/data-sync/reports", { signal: AbortSignal.timeout(5000) });
            const json = await res.json();
            if (json.success) {
                setData({ ...json, source: "server" });
                return;
            }
        } catch {
            // Server unavailable — fall through to local
        }

        // Fallback: build from local IndexedDB
        try {
            const local = await buildLocalReport();
            setData(local);
        } catch (err) {
            toast.error("No se pudo cargar el reporte");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        loadReports().finally(() => setLoading(false));
    }, [session?.employee_id, refreshKey]);

    const formatMoney = (cents: number) =>
        (cents / 100).toLocaleString("es-PE", { style: "currency", currency: "PEN" });

    const formatTime = (d: string | Date) =>
        new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const orderTypeLabel: Record<string, string> = {
        DINE_IN: "Mesa",
        TAKEOUT: "Para llevar",
        DELIVERY: "Delivery",
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full" />
                    <p className="text-zinc-500 text-sm">Cargando reportes...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                    <WifiOff className="w-12 h-12 text-zinc-700" />
                    <p className="text-zinc-400 text-sm">No se pudo cargar el reporte</p>
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const { summary, recent_orders } = data;

    return (
        <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-zinc-950">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Reportes del Día</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                        {new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {data.source === "local" ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full">
                            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-400 text-xs font-medium">Datos locales</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 text-xs font-medium">Sincronizado</span>
                        </div>
                    )}
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                        title="Actualizar"
                    >
                        <RefreshCw className="w-4 h-4 text-zinc-400" />
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-500/30 transition-colors">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                        <DollarSign className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ventas Totales</p>
                        <h3 className="text-2xl font-bold text-white mt-0.5">
                            {formatMoney(summary.total_sales_cents)}
                        </h3>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-blue-500/30 transition-colors">
                    <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                        <Receipt className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Órdenes Completadas</p>
                        <h3 className="text-2xl font-bold text-white mt-0.5">
                            {summary.total_orders}
                        </h3>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4 hover:border-purple-500/30 transition-colors">
                    <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                        <TrendingUp className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ticket Promedio</p>
                        <h3 className="text-2xl font-bold text-white mt-0.5">
                            {summary.total_orders > 0
                                ? formatMoney(Math.round(summary.total_sales_cents / summary.total_orders))
                                : "S/ 0.00"
                            }
                        </h3>
                    </div>
                </div>
            </div>

            {/* By Type breakdown */}
            {Object.keys(summary.by_type).length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {Object.entries(summary.by_type).map(([type, cents]) => (
                        <div key={type} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center">
                            <p className="text-xs text-zinc-500 mb-1">{orderTypeLabel[type] ?? type}</p>
                            <p className="text-lg font-bold text-white">{formatMoney(cents)}</p>
                            <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${summary.total_sales_cents > 0 ? Math.round((cents / summary.total_sales_cents) * 100) : 0}%` }}
                                />
                            </div>
                            <p className="text-xs text-zinc-600 mt-1">
                                {summary.total_sales_cents > 0 ? Math.round((cents / summary.total_sales_cents) * 100) : 0}%
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Orders Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex-1">
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">Últimas Órdenes Pagadas</h3>
                    <span className="text-xs text-zinc-500">{recent_orders.length} registros</span>
                </div>

                {recent_orders.length === 0 ? (
                    <div className="py-16 text-center">
                        <Receipt className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                        <p className="text-zinc-500 text-sm">No hay órdenes pagadas hoy</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-zinc-800/50">
                                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Orden #</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mesa</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Hora</th>
                                    <th className="px-5 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {recent_orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-5 py-3.5 text-sm font-bold text-zinc-100">
                                            #{order.order_number}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-zinc-400">
                                            {order.table_number ? `Mesa ${order.table_number}` : "—"}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                order.order_type === "DINE_IN"
                                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                    : order.order_type === "DELIVERY"
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            }`}>
                                                {orderTypeLabel[order.order_type] ?? order.order_type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm text-zinc-500">
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(order.created_at)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-bold text-emerald-400 text-right">
                                            {formatMoney(order.total_cents)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
