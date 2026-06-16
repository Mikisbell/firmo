"use client";

import React, { useMemo } from "react";
import useSWR from "swr";
import { useLiveOrders } from "../hooks/useLiveOrders";
import { Utensils, LockKeyhole } from "lucide-react";

import { FloorPlanCanvas } from "./FloorPlanCanvas";
import type { ShiftProjection } from "@/src/core/projections/types";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface FloorPlanViewProps {
    tenantId: string;
    shift: ShiftProjection | null;
    onSelectTable: (tableId: string, orderId: string | null, tableNumber: string) => void;
}

export function FloorPlanView({ tenantId, shift, onSelectTable }: FloorPlanViewProps) {
    // Usar endpoint POS (no admin) para no requerir cookie JWT de admin
    const { data: tablesRaw, isLoading: tablesLoading } = useSWR(
        tenantId ? `/api/pos/tables?tenant_id=${tenantId}` : null,
        fetcher,
        { revalidateOnFocus: false }
    );
    // El endpoint POS devuelve array directo; el admin devuelve { items }
    const tablesData = useMemo(() => ({
        items: Array.isArray(tablesRaw) ? tablesRaw : (tablesRaw?.items ?? [])
    }), [tablesRaw]);
    const { orders: liveOrders } = useLiveOrders({ tenantId });

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
                <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white border border-zinc-300" />
                        <span className="text-zinc-600 dark:text-zinc-400">Libre</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Sentados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Cocinando</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-zinc-600 dark:text-zinc-400">Pidiendo Cuenta</span>
                    </div>
                </div>
            </div>

            {zones.length > 0 ? (
                <div className="relative">
                    <FloorPlanCanvas 
                        zones={zones} 
                        liveOrders={liveOrders} 
                        shiftOpen={isShiftOpen}
                        onSelectTable={onSelectTable} 
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
