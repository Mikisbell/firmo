"use client";

import { useState, useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";
import type { PendingOrder } from "../components/PendingOrdersList";

interface LiveOrdersOptions {
    tenantId: string;
}

/**
 * Hook para obtener órdenes en tiempo real
 * Combina:
 * 1. Dexie LiveQuery para reactividad local
 * 2. SSE para actualizaciones del servidor
 * 3. Polling como fallback
 */
export function useLiveOrders({ tenantId }: LiveOrdersOptions) {
    const [orders, setOrders] = useState<PendingOrder[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    // Live query from IndexedDB projections
    const projections = useLiveQuery(async () => {
        const dbInstance = getDb();
        if (!dbInstance) return [];

        const allProjections = await dbInstance.projections
            .where("key")
            .startsWith("order:")
            .toArray();

        return allProjections
            .map(p => p.data)
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
            const delivery = o.delivery || {};
            
            return {
                order_id: o.order_id,
                order_number: o.order_number || 0,
                order_type: (o.order_type as "DINE_IN" | "TAKEOUT" | "DELIVERY") || "DINE_IN",
                
                // DINE_IN fields
                table_number: fulfillment.table_number || o.table_id,
                waiter_name: o.waiter_name || o.actor_name,
                guest_count: fulfillment.guest_count,
                
                // DELIVERY fields
                customer_name: delivery.customer_name || fulfillment.pickup_name,
                customer_phone: delivery.customer_phone || fulfillment.pickup_phone,
                delivery_address: delivery.address_snapshot?.address_text,
                delivery_reference: delivery.address_snapshot?.reference,
                delivery_fee_cents: delivery.delivery_fee_cents,
                assigned_driver: delivery.assigned_driver_name,
                payment_expectation: delivery.payment_expectation,
                
                // TAKEOUT fields
                pickup_name: fulfillment.pickup_name,
                pickup_phone: fulfillment.pickup_phone,
                pickup_time: fulfillment.pickup_time ? new Date(fulfillment.pickup_time) : undefined,
                
                // Common fields
                total_cents: o.total_cents || 0,
                items_count: Object.keys(o.lines || {}).length,
                created_at: new Date(o.created_at || Date.now()),
                status: mapFulfillmentStatus(o.fulfillment_status, o.delivery_status),
                
                // External integrations
                external_source: o.external_source,
                external_order_id: o.external_order_id,
            };
        });

        // Sort by creation time (newest first)
        pending.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

        setOrders(pending);
        setLastUpdate(new Date());
    }, [projections]);

    // SSE Connection for real-time updates
    useEffect(() => {
        if (!tenantId || typeof window === "undefined") return;

        let eventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout | null = null;

        const connect = () => {
            eventSource = new EventSource(`/api/events/stream?tenant_id=${tenantId}`);

            eventSource.onopen = () => {
                setIsConnected(true);
                console.log("[LiveOrders] SSE Connected");
            };

            eventSource.onmessage = (msg) => {
                try {
                    const event = JSON.parse(msg.data);
                    if (event.type === "CONNECTED") return;

                    // Trigger refresh on order-related events
                    const orderEvents = [
                        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_VOIDED",
                        "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID", "ORDER_CLOSED",
                        "ORDER_CANCELLED", "CHECK_CREATED"
                    ];

                    if (orderEvents.includes(event.event_type)) {
                        setLastUpdate(new Date());
                    }
                } catch (e) {
                    console.error("[LiveOrders] SSE parse error:", e);
                }
            };

            eventSource.onerror = () => {
                setIsConnected(false);
                eventSource?.close();
                // Reconnect after 5 seconds
                reconnectTimeout = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            eventSource?.close();
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [tenantId]);

    // Manual refresh function
    const refresh = useCallback(() => {
        setLastUpdate(new Date());
    }, []);

    return {
        orders,
        isConnected,
        lastUpdate,
        refresh,
        isLoading: projections === undefined,
    };
}

function mapFulfillmentStatus(
    fulfillmentStatus: string | undefined, 
    deliveryStatus?: string
): "COOKING" | "READY" | "SERVED" | "DISPATCHED" | "DELIVERED" {
    // Delivery-specific statuses take priority
    if (deliveryStatus) {
        switch (deliveryStatus) {
            case "DISPATCHED":
            case "ON_THE_WAY":
                return "DISPATCHED";
            case "DELIVERED":
            case "COMPLETED":
                return "DELIVERED";
        }
    }
    
    switch (fulfillmentStatus) {
        case "READY":
        case "READY_FOR_PICKUP":
        case "ALL_READY":
            return "READY";
        case "SERVED":
        case "PICKED_UP":
            return "SERVED";
        default:
            return "COOKING";
    }
}
