import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";
import { type SaleProjection } from "@/src/core/projections/types";
import { applySaleEvent, createOrderFromEvent } from "@/src/core/projections/sale.reducer";
import { type ParkEvent } from "@/src/core/domain/events";

export function useKitchenTickets(stationFilter: string = "All") {
    // We strictly want orders that are NOT done/cancelled
    // and have items for the specific station.

    const tickets = useLiveQuery(async () => {
        const db = getDb();
        if (!db) return [];

        // 1. Get all relevant events for ORDERS
        // distinct aggregate_ids would be nice, but for now we fetch all relevant events
        // Optimization: Filter by time/date to avoid replaying history forever
        const events = await db.events
            .where("aggregate_type")
            .equals("ORDER")
            .toArray() as ParkEvent[];

        // 2. Group by Order ID
        const eventsByOrder: Record<string, ParkEvent[]> = {};
        for (const e of events) {
            if (!eventsByOrder[e.aggregate_id]) {
                eventsByOrder[e.aggregate_id] = [];
            }
            eventsByOrder[e.aggregate_id].push(e);
        }

        // 3. Replay Reducer for each Order
        const openOrders: SaleProjection[] = [];

        for (const orderId in eventsByOrder) {
            const orderEvents = eventsByOrder[orderId].sort((a, b) =>
                new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
            );

            let state: SaleProjection | null = null;

            for (const e of orderEvents) {
                // If it's a creation event, initialize
                if (e.event_type === "ORDER_CREATED") {
                    state = createOrderFromEvent(e as any);
                } else if (state) {
                    // Apply update
                    const res = applySaleEvent(state, e);
                    state = res.state;
                }
            }

            // 4. Filter logic
            if (state && state.status !== "CANCELLED") { // Show even CONFIRMED/PAID if items are pending? Yes, kitchen needs to know.
                // Filter lines by station
                const relevantLines = Object.values(state.lines).filter(l =>
                    (stationFilter === "All" || l.name.toLowerCase().includes(stationFilter.toLowerCase()) || (l as any).station === stationFilter) &&
                    l.status !== "DONE" && l.status !== "VOIDED"
                );

                if (relevantLines.length > 0) {
                    // We only care about this order if it has relevant lines
                    openOrders.push(state);
                }
            }
        }

        return openOrders;

    }, [stationFilter]);

    return tickets ?? [];
}
