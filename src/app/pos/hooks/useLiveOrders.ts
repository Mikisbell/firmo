"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";
import type { PendingOrder } from "../components/PendingOrdersList";

interface LiveOrdersOptions {
    tenantId: string;
}

export function useLiveOrders({ tenantId }: LiveOrdersOptions) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    
    // El EventSyncClient se encarga de la conexión SSE y de mantener db.events actualizado.
    // Nosotros solo necesitamos observar db.events localmente para reaccionar a CUALQUIER cambio
    // (ya sea local o de red).
    const isConnected = true; 

    // Live query from IndexedDB events instead of projections
    const projections = useLiveQuery(async () => {
        if (!tenantId) return undefined;

        const dbInstance = getDb();
        if (!dbInstance) return undefined;

        // 1. Fetch all ORDER events for this tenant
        const orderEvents = await dbInstance.events
            .where("aggregate_type")
            .equals("ORDER")
            .toArray() as any[];

        // 2. Group by order_id
        const eventsByOrder = new Map<string, any[]>();
        for (const e of orderEvents) {
            // Filtrar por tenant localmente por seguridad
            if (e.tenant_id !== tenantId) continue;
            
            let list = eventsByOrder.get(e.aggregate_id);
            if (!list) {
                list = [];
                eventsByOrder.set(e.aggregate_id, list);
            }
            list.push(e);
        }

        // Import dinámico para no romper SSR en caso de que useLiveOrders sea importado
        const { applySaleEvent } = await import("@/src/core/projections/sale.reducer");
        const allProjections = [];

        // 3. Rebuild each order
        for (const [orderId, events] of eventsByOrder.entries()) {
            events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);
            let state = null;
            for (const e of events) {
                state = applySaleEvent(state, e).state;
            }
            if (state) {
                allProjections.push(state);
            }
        }

        return allProjections
            .filter((o): o is NonNullable<typeof o> => {
                if (!o) return false;
                // Solo órdenes OPEN que no estén completamente pagadas
                if (o.status !== "OPEN") return false;
                // Verificar si tiene checks sin pagar
                const checks = o.checks || [];
                const hasUnpaidCheck = checks.some((c: any) => {
                    const paid = (c.payment?.payments || []).reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0);
                    return paid < (c.total_cents || 0);
                });
                return hasUnpaidCheck || checks.length === 0;
            });
    }, [tenantId]);

    // Transform projections to PendingOrder format
    useEffect(() => {
        if (!projections) return;

        const pending: PendingOrder[] = projections.map(o => {
            const fulfillment = o.fulfillment || {};
            
            return {
                order_id: o.order_id,
                order_number: o.order_number || 0,
                order_type: (o.order_type as "DINE_IN" | "TAKEOUT" | "DELIVERY") || "DINE_IN",
                
                // DINE_IN fields
                table_number: fulfillment.table_number,
                waiter_name: undefined,
                guest_count: fulfillment.guest_count,
                
                // DELIVERY fields - basic info from fulfillment
                customer_name: fulfillment.pickup_name,
                customer_phone: fulfillment.pickup_phone,
                delivery_address: undefined, 
                delivery_reference: undefined, 
                delivery_fee_cents: undefined, 
                assigned_driver: undefined, 
                payment_expectation: undefined, 
                
                // TAKEOUT fields
                pickup_name: fulfillment.pickup_name,
                pickup_phone: fulfillment.pickup_phone,
                pickup_time: undefined, 
                
                // Common fields
                total_cents: o.total_cents || 0,
                items_count: Object.keys(o.lines || {}).length,
                created_at: o.lines && Object.values(o.lines).length > 0 
                    ? new Date((Object.values(o.lines)[0] as any).created_at) 
                    : new Date(),
                status: "PENDING",
                
                // External integrations
                external_source: undefined,
                external_order_id: undefined,
            };
        });

        // Sort by creation time (newest first)
        pending.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        setOrders(pending);
    }, [projections]);

    // Manual refresh function (ya no es necesario, pero mantenemos la API)
    const refresh = useCallback(() => {
        // useLiveQuery is reactive, no need to do anything here
    }, []);

    return {
        orders,
        isConnected,
        lastUpdate: new Date(),
        refresh,
        isLoading: projections === undefined,
    };
}
