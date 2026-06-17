"use client";

import React, { useMemo, useState, useRef } from "react";
import { motion, useAnimation, useDragControls } from "framer-motion";
import { Utensils, Users, Clock, Link as LinkIcon, Merge } from "lucide-react";
import { Badge, PremiumTable } from "@/src/components/ui";
import type { TableStatus } from "@/src/components/ui/table-theme";
import { compareTablesByPriority } from "@/src/core/utils/table-sort.utils";
import { toast } from "sonner";
import { POSActions } from "@/src/core/actions/pos.actions";
import { useAuth } from "@/src/components/auth";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";

export function FloorPlanCanvas({ 
    zones, 
    liveOrders, 
    shiftOpen = true,
    onSelectTable,
    zoom = 1,
    filter = "ALL"
}: { 
    zones: { id: string; name: string; tables: any[] }[], 
    liveOrders: any[],
    shiftOpen?: boolean,
    onSelectTable: (tableId: string, orderId: string | null, tableNumber: string) => void,
    zoom?: number,
    filter?: "ALL" | "AVAILABLE" | "OCCUPIED"
}) {
    const [draggingTable, setDraggingTable] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { session, terminal } = useAuth();
    const terminalId = terminal?.terminal_id;

    const tenantSettings = useLiveQuery(
        () => terminal ? db.tenant_settings.get(terminal.tenant_id) : undefined,
        [terminal?.tenant_id]
    );
    const inactivityThresholdMin = tenantSettings?.table_inactivity_threshold_min ?? 15;

    const getTableOrder = (tableNumber: string): any | undefined => {
        return liveOrders.find((o: any) => {
            if (o.order_type !== "DINE_IN") return false;
            // Support both flat table_number and nested fulfillment.table_number
            const tNum = (o.table_number as string | undefined)
                ?? ((o.fulfillment as Record<string, unknown> | undefined)?.table_number as string | undefined);
            return tNum === tableNumber;
        });
    };

    const handleDragEnd = async (e: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number, y: number } }, draggedTable: any) => {
        setDraggingTable(null);
        if (!containerRef.current) return;

        // Calculate drop point relative to container
        const rect = containerRef.current.getBoundingClientRect();
        const dropX = info.point.x - rect.left;
        const dropY = info.point.y - rect.top;

        // Find if dropped over another table (radius < 50px)
        let targetTable = null;
        for (const zone of zones) {
            for (const table of zone.tables) {
                if (table.id === draggedTable.id) continue;
                
                const tx = table.position_x || 0;
                const ty = table.position_y || 0;
                const tw = table.width || 80;
                const th = table.height || 80;
                const centerX = tx + tw / 2;
                const centerY = ty + th / 2;

                const dist = Math.sqrt(Math.pow(centerX - dropX, 2) + Math.pow(centerY - dropY, 2));
                if (dist < Math.max(tw, th)) {
                    targetTable = table;
                    break;
                }
            }
        }

        if (targetTable) {
            const draggedOrder = getTableOrder(draggedTable.number);
            const targetOrder = getTableOrder(targetTable.number);

            if (draggedTable.status === "AVAILABLE" && targetTable.status === "AVAILABLE") {
                toast.error("No se pueden unir dos mesas vacías.");
                return;
            }

            if (draggedOrder && targetOrder && draggedOrder.order_id !== targetOrder.order_id) {
                toast.error("No se pueden unir dos mesas con órdenes diferentes. Usa traspaso de ítems.");
                return;
            }

            const primaryTable = targetOrder ? targetTable : draggedTable;
            const secondaryTable = targetOrder ? draggedTable : targetTable;
            const orderToAttachTo = targetOrder || draggedOrder;

            if (!orderToAttachTo) return;

            try {
                await POSActions.attachTable(
                    terminal!.tenant_id,
                    terminalId!,
                    session!.employee_id,
                    orderToAttachTo.order_id,
                    primaryTable.id,
                    secondaryTable.id
                );
                toast.success(`Mesa ${secondaryTable.number} unida a Mesa ${primaryTable.number}`);
            } catch (error) {
                toast.error("Error al unir mesas");
            }
        }
    };

    return (
        <div ref={containerRef} className="relative w-full h-full min-h-[700px] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-auto shadow-inner bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-zinc-950 to-zinc-950 p-6">
            <div 
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 origin-top-left" 
                style={{ 
                    transform: `scale(${zoom || 1})`,
                    width: '100%'
                }}
            >
                {zones.flatMap(z => z.tables)
                    .map((table: any) => {
                        const order = getTableOrder(table.number);
                        let richStatus: "FREE" | "SEATED" | "COOKING" | "BILL" = "FREE";
                        let elapsedMinutes = 0;

                        if (order) {
                            richStatus = "SEATED";
                            if (order.status === "COOKING" || order.status === "READY") richStatus = "COOKING";
                            if (order.status === "SERVED") richStatus = "BILL";
                            const startTime = new Date(order.created_at).getTime();
                            elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
                        }
                        let mappedStatus: "FREE" | "AVAILABLE" | "OCCUPIED" | "COOKING" | "BILL_REQUESTED" = "FREE";
                        if (richStatus === "SEATED") mappedStatus = "OCCUPIED";
                        else if (richStatus === "COOKING") mappedStatus = "COOKING";
                        else if (richStatus === "BILL") mappedStatus = "BILL_REQUESTED";
                        else mappedStatus = table.status as any;

                        const isOccupied = mappedStatus !== "FREE" && mappedStatus !== "AVAILABLE";
                        return { table, order, mappedStatus, elapsedMinutes, isOccupied };
                    })
                    .filter(item => {
                        if (filter === "AVAILABLE") return !item.isOccupied;
                        if (filter === "OCCUPIED") return item.isOccupied;
                        return true;
                    })
                    .sort((a, b) => compareTablesByPriority(
                        { status: a.mappedStatus, number: a.table.number },
                        { status: b.mappedStatus, number: b.table.number }
                    ))
                    .map(({ table, order, mappedStatus, elapsedMinutes }, globalIndex) => {
                        // Remover grilla matemática absoluta, el contenedor maneja la grilla responsiva.

                    return (
                        <PremiumTable
                            key={table.id}
                            id={table.id}
                            number={table.number}
                            status={mappedStatus as any}
                            elapsedMinutes={elapsedMinutes}
                            inactivityThresholdMin={inactivityThresholdMin}
                            totalCents={order?.total_cents}
                            isMerged={table.is_merged}
                            mode="grid"
                            isDraggable={false}
                            isDragging={false}
                            onClick={() => {
                                if (!shiftOpen) return;
                                onSelectTable(table.id, order?.order_id || null, table.number);
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
