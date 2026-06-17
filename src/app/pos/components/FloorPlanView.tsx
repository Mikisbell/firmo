"use client";

import React, { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { Utensils, LockKeyhole } from "lucide-react";

import { FloorPlanCanvas } from "./FloorPlanCanvas";
import type { ShiftProjection } from "@/src/core/projections/types";


interface FloorPlanViewProps {
    tenantId: string;
    shift: ShiftProjection | null;
    onSelectTable: (tableId: string, orderId: string | null, tableNumber: string) => void;
}

export function FloorPlanView({ tenantId, shift, onSelectTable }: FloorPlanViewProps) {
    // Lectura O(1) desde IndexedDB local. Cero red.
    const masterTables = useLiveQuery(
        () => db.master_tables.where('tenant_id').equals(tenantId).toArray(),
        [tenantId]
    );

    const tablesLoading = masterTables === undefined;
    const tablesData = useMemo(() => ({
        items: masterTables ?? []
    }), [masterTables]);

    const { orders: liveOrders } = useLiveOrders({ tenantId });
    
    // Zoom control state
    const [zoom, setZoom] = useState(1);
    
    // Filter state
    const [filter, setFilter] = useState<"ALL" | "AVAILABLE" | "OCCUPIED">("ALL");

    // ── Turno abierto = mesas interactivas ──────────────────────────
    const isShiftOpen = shift?.status === "OPEN";

    // Agrupar mesas por zona
    const zones = useMemo(() => {
        const tables = tablesData?.items || [];
        const map = new Map<string, { id: string; name: string; tables: typeof tables }>();
        
        tables.forEach((t: any) => {
            const zoneId = t.zone_id || "unassigned";
            const zoneName = t.zone?.name || "Salón Principal";
            
            if (!map.has(zoneId)) {
                map.set(zoneId, { id: zoneId, name: zoneName, tables: [] });
            }
            map.get(zoneId)!.tables.push(t);
        });

        // Ordenar mesas por número dentro de cada zona
        Array.from(map.values()).forEach(z => {
            z.tables.sort((a: any, b: any) => {
                const numA = parseInt(a.number.replace(/\D/g, '') || '0');
                const numB = parseInt(b.number.replace(/\D/g, '') || '0');
                return numA - numB;
            });
        });

        return Array.from(map.values());
    }, [tablesData]);

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
        <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full bg-zinc-100 dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Centro de Comando 2D</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {isShiftOpen
                            ? "Arrastra una mesa sobre otra para unirlas"
                            : "Abre un turno para interactuar con las mesas"
                        }
                    </p>
                </div>
                <div className="flex gap-6 items-center">
                    {/* Filter Controls */}
                    <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                        <button 
                            onClick={() => setFilter("ALL")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "ALL" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
                        >
                            Todas
                        </button>
                        <button 
                            onClick={() => setFilter("AVAILABLE")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "AVAILABLE" ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"}`}
                        >
                            Libres
                        </button>
                        <button 
                            onClick={() => setFilter("OCCUPIED")}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${filter === "OCCUPIED" ? "bg-white dark:bg-zinc-700 text-rose-600 dark:text-rose-400 shadow-sm" : "text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"}`}
                        >
                            Ocupadas
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-3 bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                        <button 
                            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors font-bold"
                        >
                            -
                        </button>
                        <span className="text-xs font-mono font-bold w-12 text-center text-zinc-700 dark:text-zinc-300">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button 
                            onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}
                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors font-bold"
                        >
                            +
                        </button>
                    </div>

                    {/* Leyenda */}
                    <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-zinc-600 dark:text-zinc-400">Disponible</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                        <span className="text-zinc-600 dark:text-zinc-400">Ocupada</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                        <span className="text-zinc-600 dark:text-zinc-400">Cocinando</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                        <span className="text-zinc-600 dark:text-zinc-400">Pidiendo Cuenta</span>
                    </div>
                </div>
                </div>
            </div>

            {zones.length > 0 ? (
                <div className="relative flex-1 overflow-hidden">
                    <FloorPlanCanvas 
                        zones={zones} 
                        liveOrders={liveOrders} 
                        shiftOpen={isShiftOpen}
                        onSelectTable={onSelectTable} 
                        zoom={zoom}
                        filter={filter}
                    />

                    {/* ── OVERLAY: Turno Cerrado ─────────────────── */}
                    {!isShiftOpen && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-3xl backdrop-blur-sm bg-zinc-950/60 pointer-events-none">
                            <div className="flex flex-col items-center gap-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl px-8 py-6 shadow-2xl pointer-events-auto">
                                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                                    <LockKeyhole className="w-7 h-7 text-zinc-400" />
                                </div>
                                <h3 className="text-lg font-bold text-zinc-100">Turno Cerrado</h3>
                                <p className="text-sm text-zinc-400 text-center max-w-xs">
                                    Abrí un turno desde el panel inferior para habilitar las mesas y empezar a tomar pedidos.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
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
