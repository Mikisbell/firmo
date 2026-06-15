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
export type TableStatus = "FREE" | "OCCUPIED" | "COOKING" | "BILL_REQUESTED" | "PAID";

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

// Fetch tables from API and sync to IndexedDB
async function fetchTablesFromAPI(): Promise<Array<{
    id: string;
    number: string;
    display_name: string | null;
    zone: Zone | null;
    is_active: boolean;
    capacity: number;
}>> {
    const config = getStoredTerminalConfig();
    const tenantId = config?.tenant_id;
    if (!tenantId) return [];

    try {
        const res = await fetch('/api/pos/tables?active=true', {
            headers: { 'x-tenant-id': tenantId },
        });
        
        if (!res.ok) {
            throw new Error("API not ok");
        }
        
        const tables = await res.json();
        
        // Cache in IndexedDB
        if (tables && tables.length > 0) {
            try {
                await db.master_tables.bulkPut(
                    tables.map((t: any) => ({
                        id: t.id,
                        tenant_id: tenantId,
                        number: t.number,
                        display_name: t.display_name,
                        zone: t.zone,
                        is_active: t.is_active !== false,
                        capacity: t.capacity || 4
                    }))
                );
            } catch (dbErr) {
                console.error("Failed to cache tables in IndexedDB", dbErr);
            }
        }
        
        return tables;
    } catch (err) {
        // Fallback to IndexedDB
        console.log("Network error fetching tables, falling back to IndexedDB", err);
        try {
            const cachedTables = await db.master_tables
                .where('tenant_id')
                .equals(tenantId)
                .toArray();
                
            if (cachedTables && cachedTables.length > 0) {
                return cachedTables.map(t => ({
                    id: t.id,
                    number: t.number,
                    display_name: t.display_name,
                    zone: t.zone,
                    is_active: t.is_active,
                    capacity: t.capacity
                }));
            }
        } catch (dbErr) {
            console.error("Failed to read cached tables", dbErr);
        }
        
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

        // Use API tables only. No fallback stubs to prevent fake data in UI.
        const tablesToUse = apiTables;

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
                if (ord.status === "SENT" || ord.status === "PREPARING") {
                    status = "COOKING";
                }
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
