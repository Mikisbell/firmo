import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";

export type TableStatus = "FREE" | "OCCUPIED" | "BILL_PRINTED" | "PAID";

export type TableInfo = {
    id: string; // "M1", "M2"
    name: string;
    status: TableStatus;
    orderId?: string;
    waiterName?: string;
    totalCents?: number;
    time?: string;
};

export function useTableStatus() {
    const tables = useLiveQuery(async () => {
        // 1. Get all relevant events
        // Optimization: In real app, we might query 'active_orders' projection.
        // For Pilot: Query all ORDER_CREATED and filter status dynamically.

        // We fetch ALL events for now? No, just ORDER type events.
        // Dexie doesn't allow easy "OR" on index unless we gather.
        const events = await db.events
            .where("aggregate_type")
            .equals("ORDER")
            .toArray() as ParkEvent[];

        // 2. Rebuild state of Open Orders
        const ordersMap = new Map<string, {
            orderId: string,
            table?: string,
            status: string,
            total: number,
            waiter?: string // Need actor_id to name? OR just use terminal_id as proxy
        }>();

        // Sort by sequence to replay correctly
        events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);

        for (const ev of events) {
            if (ev.event_type === "ORDER_CREATED") {
                const p = ev.payload as any;
                ordersMap.set(p.order_id, {
                    orderId: p.order_id,
                    table: p.fulfillment?.table_number,
                    status: p.order_status || "OPEN",
                    total: 0,
                    waiter: ev.actor_id || "Mozo"
                });
            } else if (ev.event_type === "ORDER_CANCELLED") {
                const p = ev.payload as any;
                ordersMap.delete(p.order_id); // Remove from tracking
            } else if (ev.event_type === "CHECK_MARKED_PAID") {
                // Needs loop to check if ALL checks are paid.
                // MVP Simplification: If check paid, assume order might be closing.
                // Real logic requires counting unpaid checks.
            } else if (ev.event_type === "ORDER_ITEM_ADDED") {
                const p = ev.payload as any;
                const ord = ordersMap.get(p.order_id);
                if (ord) {
                    ord.total += (p.line.qty * p.line.unit_price_cents);
                }
            }
        }

        // 3. Map to Tables
        const tableState: Record<string, TableInfo> = {};

        // Default Tables (Can be config later)
        const ALL_TABLES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

        // Initialize Free
        ALL_TABLES.forEach(t => {
            tableState[`M${t}`] = {
                id: `M${t}`,
                name: `Mesa ${t}`,
                status: "FREE"
            };
        });

        // Fill Occupied
        ordersMap.forEach((ord) => {
            if (ord.table) { // Table might be "M1" or "1"
                // Normalize table ID
                const tId = ord.table.startsWith("M") ? ord.table : `M${ord.table}`;

                if (tableState[tId]) {
                    tableState[tId].status = "OCCUPIED";
                    tableState[tId].orderId = ord.orderId;
                    tableState[tId].totalCents = ord.total;
                }
            }
        });

        return Object.values(tableState);
    }, []);

    return tables || [];
}
