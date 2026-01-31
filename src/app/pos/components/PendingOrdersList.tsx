"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, MapPin, ChefHat, CreditCard, Truck, Search, ArrowUpDown, Phone, Banknote } from "lucide-react";

export interface PendingOrder {
    order_id: string;
    order_number: number;
    order_type: "DINE_IN" | "TAKEOUT" | "DELIVERY";
    
    // DINE_IN fields
    table_number?: string;
    waiter_name?: string;
    guest_count?: number;
    
    // DELIVERY fields
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;
    delivery_reference?: string;
    delivery_fee_cents?: number;
    assigned_driver?: string;
    payment_expectation?: "PREPAID" | "COD"; // Cash on Delivery
    
    // TAKEOUT fields
    pickup_name?: string;
    pickup_phone?: string;
    pickup_time?: Date;
    
    // Common fields
    total_cents: number;
    items_count: number;
    created_at: Date;
    status: "COOKING" | "READY" | "SERVED" | "DISPATCHED" | "DELIVERED";
    
    // External integrations (Rappi, PedidosYa, etc.)
    external_source?: "RAPPI" | "PEDIDOSYA" | "UBEREATS" | "WHATSAPP" | "PHONE";
    external_order_id?: string;
}

interface PendingOrdersListProps {
    orders: PendingOrder[];
    onSelectOrder: (orderId: string) => void;
    selectedOrderId?: string;
}

type SortBy = "time" | "total" | "number";
type FilterType = "ALL" | "DINE_IN" | "DELIVERY";

export function PendingOrdersList({ orders, onSelectOrder, selectedOrderId }: PendingOrdersListProps) {
    const [filter, setFilter] = useState<FilterType>("ALL");
    const [sortBy, setSortBy] = useState<SortBy>("time");
    const [searchQuery, setSearchQuery] = useState("");

    const filteredAndSortedOrders = useMemo(() => {
        let result = [...orders];

        // Filter by type
        if (filter === "DINE_IN") {
            result = result.filter(o => o.order_type === "DINE_IN");
        } else if (filter === "DELIVERY") {
            result = result.filter(o => o.order_type === "DELIVERY" || o.order_type === "TAKEOUT");
        }

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(o => 
                o.order_number.toString().includes(query) ||
                o.table_number?.toLowerCase().includes(query) ||
                o.waiter_name?.toLowerCase().includes(query) ||
                o.customer_name?.toLowerCase().includes(query) ||
                o.customer_phone?.includes(query) ||
                o.pickup_name?.toLowerCase().includes(query) ||
                o.delivery_address?.toLowerCase().includes(query) ||
                o.external_order_id?.toLowerCase().includes(query)
            );
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case "total":
                    return b.total_cents - a.total_cents;
                case "number":
                    return b.order_number - a.order_number;
                case "time":
                default:
                    return b.created_at.getTime() - a.created_at.getTime();
            }
        });

        return result;
    }, [orders, filter, sortBy, searchQuery]);

    const formatTime = (date: Date) => {
        const mins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (mins < 1) return "Ahora";
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    const formatMoney = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

    const getStatusColor = (status: string) => {
        switch (status) {
            case "COOKING": return "text-amber-400 bg-amber-500/10 border-amber-500/30";
            case "READY": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
            case "SERVED": return "text-blue-400 bg-blue-500/10 border-blue-500/30";
            case "DISPATCHED": return "text-purple-400 bg-purple-500/10 border-purple-500/30";
            case "DELIVERED": return "text-green-400 bg-green-500/10 border-green-500/30";
            default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "COOKING": return "Preparando";
            case "READY": return "Listo";
            case "SERVED": return "Servido";
            case "DISPATCHED": return "En camino";
            case "DELIVERED": return "Entregado";
            default: return status;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "DELIVERY": return <Truck size={14} />;
            case "TAKEOUT": return <ChefHat size={14} />;
            default: return <Users size={14} />;
        }
    };

    const counts = {
        all: orders.length,
        dineIn: orders.filter(o => o.order_type === "DINE_IN").length,
        delivery: orders.filter(o => o.order_type === "DELIVERY" || o.order_type === "TAKEOUT").length,
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Search & Filters */}
            <div className="p-4 space-y-3 border-b border-zinc-800">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar por # orden, mesa, mozo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2">
                    {[
                        { key: "ALL" as FilterType, label: "Todas", count: counts.all },
                        { key: "DINE_IN" as FilterType, label: "Mesas", count: counts.dineIn },
                        { key: "DELIVERY" as FilterType, label: "Delivery", count: counts.delivery },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                filter === tab.key
                                    ? "bg-indigo-600 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs ${
                                filter === tab.key ? "bg-white/20" : "bg-zinc-700"
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2 text-xs">
                    <ArrowUpDown size={12} className="text-zinc-500" />
                    <span className="text-zinc-500">Ordenar:</span>
                    {[
                        { key: "time" as SortBy, label: "Recientes" },
                        { key: "total" as SortBy, label: "Monto" },
                        { key: "number" as SortBy, label: "# Orden" },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setSortBy(opt.key)}
                            className={`px-2 py-1 rounded ${
                                sortBy === opt.key
                                    ? "bg-zinc-700 text-white"
                                    : "text-zinc-500 hover:text-white"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence mode="popLayout">
                    {filteredAndSortedOrders.length === 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full text-center py-12"
                        >
                            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                <CreditCard className="text-zinc-600 w-8 h-8" />
                            </div>
                            <p className="text-zinc-500 text-sm">No hay órdenes pendientes</p>
                            <p className="text-zinc-600 text-xs mt-1">Las órdenes de los mozos aparecerán aquí</p>
                        </motion.div>
                    ) : (
                        filteredAndSortedOrders.map((order, index) => (
                            <motion.button
                                key={order.order_id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.05 }}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => onSelectOrder(order.order_id)}
                                className={`w-full p-4 rounded-xl border transition-all text-left ${
                                    selectedOrderId === order.order_id
                                        ? "bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/50"
                                        : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"
                                }`}
                            >
                                {/* Header: Order number, status, total */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl font-bold text-white">
                                            #{order.order_number}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                            {getStatusLabel(order.status)}
                                        </span>
                                        {/* External source badge */}
                                        {order.external_source && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                {order.external_source}
                                            </span>
                                        )}
                                        {/* Payment expectation for delivery */}
                                        {order.order_type === "DELIVERY" && order.payment_expectation === "COD" && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                                                <Banknote size={10} />
                                                Contra-entrega
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xl font-bold text-emerald-400">
                                        {formatMoney(order.total_cents)}
                                    </span>
                                </div>

                                {/* Order type specific info */}
                                <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400 mb-2">
                                    {/* Type icon and location */}
                                    <span className="flex items-center gap-1.5">
                                        {getTypeIcon(order.order_type)}
                                        {order.order_type === "DINE_IN" && order.table_number && `Mesa ${order.table_number}`}
                                        {order.order_type === "TAKEOUT" && (order.pickup_name || "Para llevar")}
                                        {order.order_type === "DELIVERY" && (order.customer_name || "Delivery")}
                                    </span>
                                    
                                    {/* Waiter for DINE_IN */}
                                    {order.order_type === "DINE_IN" && order.waiter_name && (
                                        <span className="flex items-center gap-1.5">
                                            <Users size={14} />
                                            {order.waiter_name}
                                        </span>
                                    )}
                                    
                                    {/* Phone for DELIVERY/TAKEOUT */}
                                    {(order.customer_phone || order.pickup_phone) && (
                                        <span className="flex items-center gap-1.5">
                                            <Phone size={14} />
                                            {order.customer_phone || order.pickup_phone}
                                        </span>
                                    )}
                                    
                                    {/* Driver for DELIVERY */}
                                    {order.assigned_driver && (
                                        <span className="flex items-center gap-1.5 text-purple-400">
                                            <Truck size={14} />
                                            {order.assigned_driver}
                                        </span>
                                    )}
                                    
                                    {/* Time */}
                                    <span className="flex items-center gap-1.5 ml-auto">
                                        <Clock size={14} />
                                        {formatTime(order.created_at)}
                                    </span>
                                </div>

                                {/* Delivery address */}
                                {order.order_type === "DELIVERY" && order.delivery_address && (
                                    <div className="flex items-start gap-1.5 text-xs text-zinc-500 mb-2">
                                        <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                                        <span className="line-clamp-1">
                                            {order.delivery_address}
                                            {order.delivery_reference && ` (${order.delivery_reference})`}
                                        </span>
                                    </div>
                                )}

                                {/* Footer: items count and delivery fee */}
                                <div className="flex items-center justify-between text-xs text-zinc-500">
                                    <span>{order.items_count} {order.items_count === 1 ? "item" : "items"}</span>
                                    {order.delivery_fee_cents && order.delivery_fee_cents > 0 && (
                                        <span className="text-zinc-400">
                                            Delivery: {formatMoney(order.delivery_fee_cents)}
                                        </span>
                                    )}
                                </div>
                            </motion.button>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Summary Footer */}
            {filteredAndSortedOrders.length > 0 && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">{filteredAndSortedOrders.length} órdenes pendientes</span>
                        <span className="text-white font-bold">
                            Total: {formatMoney(filteredAndSortedOrders.reduce((sum, o) => sum + o.total_cents, 0))}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
