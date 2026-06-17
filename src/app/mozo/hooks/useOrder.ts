import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { applySaleEvent } from "@/src/core/projections/sale.reducer";
import { SaleProjection } from "@/src/core/projections/types";
import { usePosStore } from "@/src/core/store/usePosStore";
import { useMemo } from "react";

export function useOrder(orderId: string | null) {
    // 1. Fetch confirmed historical events from local replica (Server State)
    const serverOrderState = useLiveQuery(async () => {
        if (!orderId) return null;

        const events = await db.events
            .where("aggregate_id")
            .equals(orderId)
            .sortBy("terminal_sequence") as ParkEvent[];

        if (events.length === 0) return null;

        let state: SaleProjection | null = null;
        for (const ev of events) {
            const res = applySaleEvent(state, ev);
            state = res.state;
        }

        return state;
    }, [orderId]);

    // 2. Extract ONLY the optimistic events for this specific order from RAM (O(1))
    const localOptimisticEvents = usePosStore(state => 
        state.localOptimisticEvents.filter(e => e.aggregate_id === orderId)
    );

    // 3. Pure Math: Project state on the fly
    // useMemo ensures we only recalculate if the server replica updates or if the waiter adds a local event
    const projectedState = useMemo(() => {
        if (!serverOrderState && localOptimisticEvents.length === 0) return null;

        // Deep clone the server state to avoid mutating the cached object from useLiveQuery
        let state: SaleProjection | null = serverOrderState 
            ? JSON.parse(JSON.stringify(serverOrderState)) 
            : null;

        // Apply all local pending events
        for (const ev of localOptimisticEvents) {
            // Cast LocalEvent to ParkEvent since they share the same schema for reducers
            const res = applySaleEvent(state, ev as unknown as ParkEvent);
            state = res.state;
        }

        return state;
    }, [serverOrderState, localOptimisticEvents]);

    return projectedState;
}
