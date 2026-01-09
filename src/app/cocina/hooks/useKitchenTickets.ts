import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/src/core/db/schema";
import { type SaleProjection } from "@/src/core/projections/types";
import { applySaleEvent, createOrderFromEvent } from "@/src/core/projections/sale.reducer";
import { type ParkEvent } from "@/src/core/domain/events";
import { STATION_GROUPS, type StationCode } from "@/src/core/domain/stations";

type StationFilter = StationCode | StationCode[] | "All";

export function useKitchenTickets(stationFilter: StationFilter = "All") {
    // Normalize to array
    const stations = Array.isArray(stationFilter) 
        ? stationFilter 
        : stationFilter === "All" 
            ? [] // Empty means all
            : [stationFilter];
    
    const isAllStations = stations.length === 0 || stationFilter === "All";

    const tickets = useLiveQuery(async () => {
        const db = getDb();
        if (!db) return [];

        // Performance: Solo obtener eventos del día actual
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // 1. Get ORDER events (filtrar por fecha para performance)
        const events = await db.events
            .where("aggregate_type")
            .equals("ORDER")
            .filter(e => e.occurred_at >= todayISO)
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
                if (e.event_type === "ORDER_CREATED") {
                    state = createOrderFromEvent(e as any);
                } else if (state) {
                    const res = applySaleEvent(state, e);
                    state = res.state;
                }
            }

            // 4. Filter logic
            if (state && state.status !== "CANCELLED") {
                // Filter lines by station(s) - ahora tipado correctamente
                const relevantLines = Object.values(state.lines).filter(l => {
                    const matchesStation = isAllStations || stations.includes(l.station as StationCode);
                    const notCompleted = l.status !== "DONE" && l.status !== "VOIDED";
                    return matchesStation && notCompleted;
                });

                if (relevantLines.length > 0) {
                    // Clone state with only relevant lines for this station view
                    const filteredState = {
                        ...state,
                        lines: Object.fromEntries(
                            Object.entries(state.lines).filter(([_, l]) => {
                                return isAllStations || stations.includes(l.station as StationCode);
                            })
                        )
                    };
                    openOrders.push(filteredState);
                }
            }
        }

        // Ordenar por order_number para consistencia
        return openOrders.sort((a, b) => a.order_number - b.order_number);

    }, [stations.join(',')]);

    return tickets ?? [];
}

// Helper para obtener tickets por grupo de estación
export function useKitchenTicketsByGroup(group: keyof typeof STATION_GROUPS) {
    return useKitchenTickets(STATION_GROUPS[group] as StationCode[]);
}
