import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { applySaleEvent } from "@/src/core/projections/sale.reducer";
import { SaleProjection } from "@/src/core/projections/types";

export function useOrder(orderId: string | null) {
    return useLiveQuery(async () => {
        if (!orderId) return null;

        // 1. Fetch relevant events for this order
        // Optimization: IndexedDB index on 'aggregate_id' would be best
        // But 'events' table index is [tenant_id+event_id] or [terminal_sequence]
        // We rely on 'aggregate_id' matching orderId.
        // Indexing aggregate_id/entity_id in Dexie schema would make this O(1).
        // Current schema: events: '++id, synced, terminal_sequence...'
        // Use filter for now (MVP).

        // Better: We might assume cache. For now, full rebuild.
        const events = await db.events
            .where("aggregate_id")
            .equals(orderId)
            .sortBy("terminal_sequence") as ParkEvent[];

        if (events.length === 0) return null;

        // 2. Rebuild state using existing Reducer
        let state: SaleProjection | null = null;

        for (const ev of events) {
            // applySaleEvent expects (state, event). It initializes defaults if state is null
            // But the reducer signature is different: `(state: SaleProjection | null, event: ParkEvent)`.
            const res = applySaleEvent(state, ev);
            state = res.state;
        }

        return state;
    }, [orderId]);
}
