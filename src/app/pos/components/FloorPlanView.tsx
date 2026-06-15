"use client";

import React, { useMemo } from "react";
import { useTables } from "@/src/hooks/useSWRHooks";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { motion } from "framer-motion";
import { Utensils, Users, Clock, AlertCircle } from "lucide-react";
import { Badge } from "@/src/components/ui";

interface FloorPlanViewProps {
    tenantId: string;
    onSelectTable: (tableId: string, orderId: string | null, tableNumber: string) => void;
}

export function FloorPlanView({ tenantId, onSelectTable }: FloorPlanViewProps) {
    const { data: tablesData, isLoading: tablesLoading } = useTables();
    const { orders: liveOrders } = useLiveOrders({ tenantId });

    // Agrupar mesas por zona
    const zones = useMemo(() => {
        const tables = tablesData?.items || [];
        const map = new Map<string, { id: string; name: string; tables: typeof tables }>();
        
        tables.forEach((t) => {
            const zoneId = t.zone_id || "unassigned";
            const zoneName = t.zone?.name || "Salón Principal";
            
            if (!map.has(zoneId)) {
                map.set(zoneId, { id: zoneId, name: zoneName, tables: [] });
            }
            map.get(zoneId)!.tables.push(t);
        });

        // Ordenar mesas por número dentro de cada zona
        Array.from(map.values()).forEach(z => {
            z.tables.sort((a, b) => {
                const numA = parseInt(a.number.replace(/\D/g, '') || '0');
                const numB = parseInt(b.number.replace(/\D/g, '') || '0');
                return numA - numB;
            });
        });

        return Array.from(map.values());
    }, [tablesData]);

    const getTableOrder = (tableNumber: string) => {
        // En un mundo ideal usamos current_order_id de la tabla,
        // pero buscamos en liveOrders para tener la info en tiempo real offline-first
        return liveOrders.find(o => 
            o.order_type === "DINE_IN" && 
            o.table_number === tableNumber
        );
    };

    if (tablesLoading) {
        return (
            <div className="flex h-full items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4 text-zinc-500">
                    <div className="w-8 h-8 border-4 border-zinc-200 border-t-emerald-500 rounded-full animate-spin" />
                    <p>Cargando salón...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 p-6 overflow-y-auto h-full">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Vista de Salón</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Estado de mesas en tiempo real</p>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                        <span className="text-zinc-600 dark:text-zinc-400">Libre</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Sentados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Comiendo</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-zinc-600 dark:text-zinc-400">Cuenta pedida</span>
                    </div>
                </div>
            </div>

            {zones.map(zone => (
                <div key={zone.id} className="space-y-4">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                        {zone.name}
                        <Badge variant="neutral" className="ml-2 font-mono">{zone.tables.length} mesas</Badge>
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {zone.tables.map((table) => {
                            const order = getTableOrder(table.number);
                            
                            // Determinar estado enriquecido
                            let richStatus: "FREE" | "SEATED" | "COOKING" | "BILL" = "FREE";
                            let elapsedMinutes = 0;

                            if (order) {
                                richStatus = "SEATED";
                                if (order.status === "COOKING" || order.status === "READY") {
                                    richStatus = "COOKING";
                                }
                                if (order.status === "SERVED") {
                                    richStatus = "BILL";
                                }

                                const startTime = new Date(order.created_at).getTime();
                                elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
                            } else if (table.status === "OCCUPIED") {
                                // Fallback a estado de BD si no tenemos la orden en local
                                richStatus = "SEATED";
                            }

                            // Colores según status
                            const bgColors = {
                                FREE: "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500",
                                SEATED: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
                                COOKING: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900",
                                BILL: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
                            };

                            return (
                                <motion.button
                                    key={table.id}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => onSelectTable(table.id, order?.order_id || null, table.number)}
                                    className={`
                                        relative flex flex-col p-4 rounded-2xl border-2 transition-all shadow-sm
                                        text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                                        ${bgColors[richStatus]}
                                    `}
                                >
                                    {/* Indicador de cuenta pedida */}
                                    {richStatus === "BILL" && (
                                        <span className="absolute -top-2 -right-2 flex h-5 w-5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 items-center justify-center text-[10px] text-white font-bold">!</span>
                                        </span>
                                    )}

                                    <div className="flex justify-between items-start mb-3">
                                        <span className="text-xl font-bold font-mono text-zinc-900 dark:text-white">
                                            {table.number}
                                        </span>
                                        <div className="flex items-center gap-1 text-zinc-400">
                                            <Users className="w-3 h-3" />
                                            <span className="text-xs font-medium">{table.capacity}</span>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/5">
                                        {richStatus === "FREE" ? (
                                            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                                Disponible
                                            </span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-xs font-medium">
                                                    <span className={
                                                        richStatus === "SEATED" ? "text-blue-600 dark:text-blue-400" :
                                                        richStatus === "COOKING" ? "text-orange-600 dark:text-orange-400" :
                                                        "text-red-600 dark:text-red-400"
                                                    }>
                                                        {richStatus === "SEATED" && "Sentados"}
                                                        {richStatus === "COOKING" && "Cocinando"}
                                                        {richStatus === "BILL" && "Cuenta"}
                                                    </span>
                                                    <div className="flex items-center gap-1 text-zinc-500">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{elapsedMinutes}m</span>
                                                    </div>
                                                </div>
                                                {order && (
                                                    <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">
                                                        {(order.total_cents / 100).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            ))}
            
            {zones.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                    <Utensils className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">Sin mesas configuradas</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                        Agrega mesas desde el panel de administración para ver el plano del salón.
                    </p>
                </div>
            )}
        </div>
    );
}
