import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/core/db/schema";
import { applySaleEvent } from "./sale.reducer";
import { applyShiftEvent } from "./shift.reducer";
import { loadProjectionsFromCache } from "./cache";
import type { ProjectionsState } from "./types";
import type { ParkEvent } from "@/src/core/domain/events";

export function useProjections(): ProjectionsState | null {
    // Estrategia: "Late Rebuild"
    // 1. Dexie liveQuery detecta cambios en tabla 'events' o 'projections'
    // 2. Cargamos snapshot (rápido)
    // 3. Cargamos delta de eventos (rápido si snapshot es reciente)
    // 4. Aplicamos delta en memoria

    return useLiveQuery(async () => {
        // 1. Snapshot base
        const base = await loadProjectionsFromCache();

        // Determinar desde qué secuencia buscar eventos nuevos
        // (el menor de los dos last_event_sequence, o 0 si alguno es fresh)
        const seqSale = base.activeSale?.last_event_sequence ?? 0;
        const seqShift = base.shift.last_event_sequence;

        // Simplificación MVP: buscamos desde el mínimo común para ir seguros
        // O mejor: buscamos todos los eventos desde el MIN(seq) hacia adelante.
        const fromSeq = Math.min(seqSale, seqShift);

        // 2. Delta events
        // any cast hasta que db.events sea genérico
        const deltaEvents = (await db.events
            .where("terminal_sequence")
            .above(fromSeq)
            .sortBy("terminal_sequence")) as any as ParkEvent[];

        if (deltaEvents.length === 0) return base;

        // 3. Rebuild incremental en memoria
        let activeSale = base.activeSale;
        let shift = base.shift;

        for (const e of deltaEvents) {
            if (e.terminal_sequence > seqSale) {
                const res = applySaleEvent(activeSale, e);
                activeSale = res.state;
            }
            if (e.terminal_sequence > seqShift) {
                const res = applyShiftEvent(shift, e);
                shift = res.state;
            }
        }

        // If sale is CONFIRMED or CANCELLED, treat as no active sale (reset cycle)
        if (activeSale && (activeSale.status === "CONFIRMED" || activeSale.status === "CANCELLED")) {
            activeSale = null;
        }

        return { activeSale, shift };
    }, [], null); // null mientras carga
}
