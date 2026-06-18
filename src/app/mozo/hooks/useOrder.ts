import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { ParkEvent } from "@/src/core/domain/events";
import { applySaleEvent } from "@/src/core/projections/sale.reducer";
import { SaleProjection } from "@/src/core/projections/types";
import { usePosStore } from "@/src/core/store/usePosStore";
import { useMemo } from "react";

export function useOrder(orderId: string | null) {
    // 1. Leemos los eventos confirmados desde la réplica local (Estado del Servidor).
    //    Devolvemos también el conjunto de event_id ya absorbidos por el servidor para
    //    poder deduplicar los eventos optimistas de forma exacta (ver paso 3).
    const serverReplica = useLiveQuery(async () => {
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

        // event_id de cada evento ya persistido en la réplica (synced=1 al venir del server).
        // Es la fuente de verdad para saber qué eventos optimistas YA fueron procesados.
        const confirmedEventIds = new Set(events.map(ev => ev.event_id));

        return { state, confirmedEventIds };
    }, [orderId]);

    const serverOrderState = serverReplica?.state ?? null;

    // 2. Extraemos SOLO los eventos optimistas de esta orden desde RAM (Zustand, O(1)).
    //    El SyncClient los purga por event_id de este set en cuanto el server los confirma
    //    (usePosStore.applySyncBatch). Hasta entonces conviven con la réplica.
    const localOptimisticEvents = usePosStore(state =>
        state.localOptimisticEvents.filter(e => e.aggregate_id === orderId)
    );

    // 3. Matemática pura: proyectamos el estado al vuelo.
    //    useMemo recalcula solo si cambia la réplica del servidor o si el mozo agrega un evento local.
    const projectedState = useMemo(() => {
        if (!serverOrderState && localOptimisticEvents.length === 0) return null;

        // Conjunto de event_id ya confirmados por el servidor (vacío si aún no hay réplica).
        const confirmedEventIds = serverReplica?.confirmedEventIds ?? new Set<string>();

        // Clonamos el estado del servidor para no mutar el objeto cacheado por useLiveQuery.
        let state: SaleProjection | null = serverOrderState
            ? JSON.parse(JSON.stringify(serverOrderState))
            : null;

        // Aplicamos los eventos optimistas pendientes.
        for (const ev of localOptimisticEvents) {
            // ────────────────────────────────────────────────────────────────────
            // DEDUP EXACTO POR event_id (race-free)
            //
            // Si la réplica del servidor ya contiene este event_id exacto, el backend
            // ya absorbió el evento y la réplica refleja su efecto real (incluyendo
            // cualquier VOID posterior hecho desde otra tablet). El evento en RAM es
            // un duplicado rezagado: lo saltamos para que gane el estado del servidor.
            //
            // Esto reemplaza la antigua heurística de line_id, que resucitaba ítems
            // borrados desde otra tablet ("Chaufa Zombie"): al borrarse la línea del
            // estado del servidor, la heurística dejaba de bloquear el ADD optimista y
            // el ítem reaparecía. Deduplicar por event_id elimina esa ventana de carrera.
            // ────────────────────────────────────────────────────────────────────
            if (confirmedEventIds.has(ev.event_id)) {
                continue;
            }

            // LocalEvent y ParkEvent comparten esquema para los reducers; el reducer
            // hace narrowing por event_type internamente.
            const res = applySaleEvent(state, ev as unknown as ParkEvent);
            state = res.state;
        }

        return state;
    }, [serverOrderState, serverReplica, localOptimisticEvents]);

    return projectedState;
}
