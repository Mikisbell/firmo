import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect } from "react";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";

export type TableStatus = "FREE" | "OCCUPIED" | "BILL_REQUESTED" | "PAID";

export interface Zone {
    id: string;
    code: string;
    name: string;
    color: string;
}

export interface TableInfo {
    id: string;
    number: string;
    name: string;
    status: TableStatus;
    orderId?: string;
    waiterName?: string;
    totalCents?: number;
    elapsedMinutes?: number;
    readyItemsCount?: number;
    createdAt?: string;
    zone?: Zone;
}

// Fetch tables from API
async function fetchTablesFromAPI(): Promise<Array<{
    id: string;
    number: string;
    display_name: string | null;
    zone: Zone | null;
    is_active: boolean;
}>> {
    try {
        const res = await fetch('/api/pos/tables?active=true');
        if (!res.ok) return [];
        return await res.json();
    } catch {
        return [];
    }
}

export function useTableStatus(zoneId?: string) {
    const [apiTables, setApiTables] = useState<Array<{
        id: string;
        number: string;
        display_name: string | null;
        zone: Zone | null;
    }>>([]);

    // Load tables from API on mount
    useEffect(() => {
        fetchTablesFromAPI().then(setApiTables);
    }, []);

    const tables = useLiveQuery(async () => {
        // 1. Get all ORDER events from IndexedDB
        const events = await db.events
            .where("aggregate_type")
            .equals("ORDER")
            .toArray() as ParkEvent[];

        // 2. Rebuild state of Open Orders
        const ordersMap = new Map<string, {
            orderId: string;
            table?: string;
            status: string;
            total: number;
            waiter?: string;
            createdAt?: string;
            billRequested?: boolean;
            readyItems: number;
        }>();

        // Sort by sequence to replay correctly
        events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);

        for (const ev of events) {
            if (ev.event_type === "ORDER_CREATED") {
                const p = ev.payload as Record<string, unknown>;
                const fulfillment = p.fulfillment as Record<string, unknown> | undefined;
                ordersMap.set(p.order_id as string, {
                    orderId: p.order_id as string,
                    table: fulfillment?.table_number as string | undefined,
                    status: (p.order_status as string) || "OPEN",
                    total: 0,
                    waiter: ev.actor_id || "Mozo",
                    createdAt: ev.occurred_at,
                    readyItems: 0,
                });
            } else if (ev.event_type === "ORDER_CANCELLED") {
                const p = ev.payload as Record<string, unknown>;
                ordersMap.delete(p.order_id as string);
            } else if (ev.event_type === "CHECK_MARKED_PAID") {
                const p = ev.payload as Record<string, unknown>;
                const ord = ordersMap.get(p.order_id as string);
                if (ord) {
                    ord.status = "PAID";
                }
            } else if (ev.event_type === "ORDER_ITEM_ADDED") {
                const p = ev.payload as Record<string, unknown>;
                const line = p.line as Record<string, unknown>;
                const ord = ordersMap.get(p.order_id as string);
                if (ord && line) {
                    ord.total += ((line.qty as number) * (line.unit_price_cents as number));
                }
            } else if (ev.event_type === "ORDER_ITEM_STATUS_CHANGED") {
                const p = ev.payload as Record<string, unknown>;
                const ord = ordersMap.get(p.order_id as string);
                if (ord && p.to === "READY") {
                    ord.readyItems++;
                }
            } else if (ev.event_type === "REQUEST_CHECK") {
                // Mark order as bill requested
                const p = ev.payload as Record<string, unknown>;
                const ord = ordersMap.get(p.order_id as string);
                if (ord) {
                    ord.billRequested = true;
                }
            }
        }

        // 3. Map to Tables
        const tableState: Record<string, TableInfo> = {};
        const now = Date.now();

        // Use API tables if available, fallback to default
        const tablesToUse = apiTables.length > 0 ? apiTables : [
            { id: "1", number: "1", display_name: "Mesa 1", zone: { id: "salon", code: "SAL", name: "Salón", color: "#8b5cf6" } },
            { id: "2", number: "2", display_name: "Mesa 2", zone: { id: "salon", code: "SAL", name: "Salón", color: "#8b5cf6" } },
            { id: "3", number: "3", display_name: "Mesa 3", zone: { id: "salon", code: "SAL", name: "Salón", color: "#8b5cf6" } },
            { id: "4", number: "4", display_name: "Mesa 4", zone: { id: "terraza", code: "TER", name: "Terraza", color: "#10b981" } },
            { id: "5", number: "5", display_name: "Mesa 5", zone: { id: "terraza", code: "TER", name: "Terraza", color: "#10b981" } },
            { id: "6", number: "6", display_name: "Mesa 6", zone: { id: "terraza", code: "TER", name: "Terraza", color: "#10b981" } },
            { id: "7", number: "7", display_name: "Mesa 7", zone: { id: "vip", code: "VIP", name: "VIP", color: "#f59e0b" } },
            { id: "8", number: "8", display_name: "Mesa 8", zone: { id: "vip", code: "VIP", name: "VIP", color: "#f59e0b" } },
            { id: "9", number: "9", display_name: "Mesa 9", zone: { id: "vip", code: "VIP", name: "VIP", color: "#f59e0b" } },
        ];

        // Initialize all tables as FREE
        tablesToUse.forEach(t => {
            // Filter by zone if specified
            if (zoneId && t.zone?.id !== zoneId) return;
            
            const tableId = t.number.startsWith("M") || t.number.startsWith("B") 
                ? t.number 
                : `M${t.number}`;
            
            tableState[tableId] = {
                id: tableId,
                number: t.number,
                name: t.display_name || `Mesa ${t.number}`,
                status: "FREE",
                zone: t.zone || undefined,
            };
        });

        // Fill with order data
        ordersMap.forEach((ord) => {
            if (!ord.table || ord.status === "PAID") return;
            
            // Normalize table ID
            const tId = ord.table.startsWith("M") || ord.table.startsWith("B") 
                ? ord.table 
                : `M${ord.table}`;

            if (tableState[tId]) {
                // Calculate elapsed time
                let elapsedMinutes: number | undefined;
                if (ord.createdAt) {
                    const created = new Date(ord.createdAt).getTime();
                    elapsedMinutes = Math.floor((now - created) / 60000);
                }

                // Determine status
                let status: TableStatus = "OCCUPIED";
                if (ord.billRequested) {
                    status = "BILL_REQUESTED";
                }

                tableState[tId] = {
                    ...tableState[tId],
                    status,
                    orderId: ord.orderId,
                    totalCents: ord.total,
                    waiterName: ord.waiter,
                    elapsedMinutes,
                    readyItemsCount: ord.readyItems > 0 ? ord.readyItems : undefined,
                    createdAt: ord.createdAt,
                };
            }
        });

        return Object.values(tableState);
    }, [apiTables, zoneId]);

    return tables || [];
}

// Hook to get zones
export function useZones() {
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/pos/zones')
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setZones(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return { zones, loading };
}
