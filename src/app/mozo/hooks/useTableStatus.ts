import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect } from "react";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { getStoredTerminalConfig } from "@/src/core/auth/fingerprint";

/**
 * TableStatus — offline-first vocabulary used by the mozo-app.
 *
 * VOCABULARY NOTE: 'FREE' here is the offline-first initial state for a table
 * with no active order in IndexedDB. The database (admin-side) uses 'AVAILABLE'
 * for the same concept in the tables.status column. These are intentionally kept
 * separate: the mozo-app reconstructs state from local IndexedDB events and never
 * reads table status directly from the DB. Changing 'FREE' to 'AVAILABLE' here
 * would break the mozo reducer without a full sync-pipeline migration.
 * See: src/app/admin/mesas/page.tsx for the DB-side 'AVAILABLE' vocabulary.
 */
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
        const config = getStoredTerminalConfig();
        const tenantId = config?.tenant_id;
        if (!tenantId) return [];
        const res = await fetch('/api/pos/tables?active=true', {
            headers: { 'x-tenant-id': tenantId },
        });
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
        // Fallback mirrors DB: 23 tables across 4 zones (SALON 1-10, TERRAZA 11-16, BAR 17-20, VIP 21-22+24)
        const SALON    = { id: "salon",   code: "SALON",   name: "Salón Principal", color: "#4CAF50" };
        const TERRAZA  = { id: "terraza", code: "TERRAZA", name: "Terraza",          color: "#2196F3" };
        const BAR      = { id: "bar",     code: "BAR",     name: "Barra",            color: "#FF9800" };
        const VIP      = { id: "vip",     code: "VIP",     name: "Zona VIP",         color: "#9C27B0" };
        const tablesToUse = apiTables.length > 0 ? apiTables : [
            { id: "1",  number: "1",  display_name: null, zone: SALON   },
            { id: "2",  number: "2",  display_name: null, zone: SALON   },
            { id: "3",  number: "3",  display_name: null, zone: SALON   },
            { id: "4",  number: "4",  display_name: null, zone: SALON   },
            { id: "5",  number: "5",  display_name: null, zone: SALON   },
            { id: "6",  number: "6",  display_name: null, zone: SALON   },
            { id: "7",  number: "7",  display_name: null, zone: SALON   },
            { id: "8",  number: "8",  display_name: null, zone: SALON   },
            { id: "9",  number: "9",  display_name: null, zone: SALON   },
            { id: "10", number: "10", display_name: null, zone: SALON   },
            { id: "11", number: "11", display_name: null, zone: TERRAZA },
            { id: "12", number: "12", display_name: null, zone: TERRAZA },
            { id: "13", number: "13", display_name: null, zone: TERRAZA },
            { id: "14", number: "14", display_name: null, zone: TERRAZA },
            { id: "15", number: "15", display_name: null, zone: TERRAZA },
            { id: "16", number: "16", display_name: null, zone: TERRAZA },
            { id: "17", number: "17", display_name: null, zone: BAR     },
            { id: "18", number: "18", display_name: null, zone: BAR     },
            { id: "19", number: "19", display_name: null, zone: BAR     },
            { id: "20", number: "20", display_name: null, zone: BAR     },
            { id: "21", number: "21", display_name: null, zone: VIP     },
            { id: "22", number: "22", display_name: null, zone: VIP     },
            { id: "24", number: "24", display_name: null, zone: VIP     },
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
        const config = getStoredTerminalConfig();
        const tenantId = config?.tenant_id;
        if (!tenantId) { setLoading(false); return; }
        fetch('/api/pos/zones', { headers: { 'x-tenant-id': tenantId } })
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setZones(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return { zones, loading };
}
