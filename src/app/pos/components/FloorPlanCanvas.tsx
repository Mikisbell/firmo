"use client";

import React, { useMemo, useState, useRef } from "react";
import { motion, useAnimation, useDragControls } from "framer-motion";
import { Utensils, Users, Clock, Link as LinkIcon, Merge } from "lucide-react";
import { Badge } from "@/src/components/ui";
import { toast } from "sonner";
import { POSActions } from "@/src/core/actions/pos.actions";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTerminal } from "@/src/contexts/TerminalContext";

export function FloorPlanCanvas({ 
    zones, 
    liveOrders, 
    onSelectTable 
}: { 
    zones: { id: string; name: string; tables: Record<string, unknown>[] }[], 
    liveOrders: Record<string, unknown>[],
    onSelectTable: (tableId: string, orderId: string | null, tableNumber: string) => void 
}) {
    const [draggingTable, setDraggingTable] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { session } = useAuth();
    const { terminalId } = useTerminal();

    const getTableOrder = (tableNumber: string): Record<string, unknown> | undefined => {
        return liveOrders.find((o: Record<string, unknown>) => 
            o.order_type === "DINE_IN" && 
            o.table_number === tableNumber
        );
    };

    const handleDragEnd = async (e: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number, y: number } }, draggedTable: Record<string, unknown>) => {
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
                    session!.tenant_id,
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
        <div ref={containerRef} className="relative w-full h-full min-h-[700px] bg-zinc-50 dark:bg-zinc-950/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-inner p-4">
            {zones.map(zone => {
                // Si la posición X e Y son 0, usamos un auto-layout en grilla visual dentro del canvas
                const autoLayout = zone.tables.every((t: Record<string, unknown>) => (t.position_x === 0 && t.position_y === 0));
                
                return (
                    <React.Fragment key={zone.id}>
                        {zone.tables.map((table: Record<string, unknown>, index: number) => {
                            const order = getTableOrder(table.number);
                            let richStatus: "FREE" | "SEATED" | "COOKING" | "BILL" = "FREE";
                            let elapsedMinutes = 0;

                            if (order) {
                                richStatus = "SEATED";
                                if (order.status === "COOKING" || order.status === "READY") richStatus = "COOKING";
                                if (order.status === "SERVED") richStatus = "BILL";
                                const startTime = new Date(order.created_at).getTime();
                                elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
                            } else if (table.status === "OCCUPIED") {
                                richStatus = "SEATED";
                            }

                            // Dynamic Styling
                            const bgColors = {
                                FREE: "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
                                SEATED: "bg-blue-500 text-white border-blue-600 shadow-blue-500/20",
                                COOKING: "bg-orange-500 text-white border-orange-600 shadow-orange-500/20",
                                BILL: "bg-red-500 text-white border-red-600 shadow-red-500/20",
                            };

                            const isWarning = elapsedMinutes > 30 && richStatus === "SEATED"; // Example warning

                            // Layout Fallback
                            const x = autoLayout ? (index % 5) * 120 + 20 : table.position_x;
                            const y = autoLayout ? Math.floor(index / 5) * 120 + 20 : table.position_y;
                            const w = table.width || 100;
                            const h = table.height || 100;

                            const isRound = table.shape === "ROUND";
                            const isBarStool = table.shape === "BAR_STOOL";

                            return (
                                <motion.div
                                    key={table.id}
                                    drag
                                    dragMomentum={false}
                                    onDragStart={() => setDraggingTable(table.id)}
                                    onDragEnd={(e, info) => handleDragEnd(e, info, table)}
                                    className={`absolute cursor-grab active:cursor-grabbing flex flex-col items-center justify-center border-2 transition-colors z-10 
                                        ${bgColors[richStatus]} 
                                        ${draggingTable === table.id ? "scale-110 shadow-2xl z-50 ring-4 ring-emerald-500/50" : "shadow-lg hover:ring-2 ring-emerald-500/30"}
                                        ${isRound ? "rounded-full" : isBarStool ? "rounded-t-full rounded-b-xl" : "rounded-2xl"}
                                        ${isWarning ? "animate-pulse ring-4 ring-red-500" : ""}
                                    `}
                                    style={{
                                        width: w,
                                        height: h,
                                        x,
                                        y,
                                        rotate: table.rotation || 0,
                                    }}
                                >
                                    <button 
                                        className="w-full h-full flex flex-col items-center justify-center p-2 outline-none"
                                        onClick={(e) => {
                                            // Prevenir click al arrastrar
                                            if (draggingTable) return;
                                            onSelectTable(table.id, order?.order_id || null, table.number);
                                        }}
                                    >
                                        <span className={`text-xl font-bold font-mono ${richStatus === "FREE" ? "text-zinc-800 dark:text-zinc-200" : "text-white"}`}>
                                            {table.number}
                                        </span>
                                        
                                        {richStatus !== "FREE" && (
                                            <div className="flex items-center gap-1 mt-1 bg-black/20 px-2 py-0.5 rounded-full text-xs font-medium">
                                                <Clock className="w-3 h-3" />
                                                <span>{elapsedMinutes}m</span>
                                            </div>
                                        )}

                                        {table.is_merged && (
                                            <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-1 shadow-md">
                                                <Merge className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
