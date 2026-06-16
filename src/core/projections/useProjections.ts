import { useLiveQuery } from "dexie-react-hooks";
import { db, getDb } from "@/src/core/db/schema";
import { applySaleEvent } from "./sale.reducer";
import { applyShiftEvent } from "./shift.reducer";
import { loadProjectionsFromCache } from "./cache";
import type { ProjectionsState, SaleProjection } from "./types";
import type { ParkEvent } from "@/src/core/domain/events";

/**
 * Hook Legacy/Global: Retorna el shift global y el singleton_sale.
 * Se mantiene para compatibilidad con la caja genérica y turnos.
 */
export function useProjections(): ProjectionsState | null {
    return useLiveQuery(async () => {
        const base = await loadProjectionsFromCache();

        const seqSale = base.activeSale?.last_event_sequence ?? 0;
        const seqShift = base.shift.last_event_sequence;
        const fromSeq = Math.min(seqSale, seqShift);

        const deltaEvents = (await db.events
            .where("terminal_sequence")
            .above(fromSeq)
            .sortBy("terminal_sequence")) as any as ParkEvent[];

        if (deltaEvents.length === 0) return base;

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

        if (activeSale && (activeSale.status === "CONFIRMED" || activeSale.status === "CANCELLED")) {
            activeSale = null;
        }

        return { activeSale, shift };
    }, [], null);
}

/**
 * Hook Premium: Retorna la proyección reactiva de una ORDEN ESPECÍFICA en tiempo real (O(1)).
 * Desbloquea flujos de cobro en paralelo y "Parked Sales".
 */
export function useOrderProjection(orderId: string | null): SaleProjection | null {
    return useLiveQuery(async () => {
        if (!orderId) return null;

        const dbInstance = getDb();
        if (!dbInstance) return null;

        // Fetch solo los eventos específicos de ESTA orden (O(1) por index)
        const events = await dbInstance.events
            .where("aggregate_id")
            .equals(orderId)
            .toArray() as any as ParkEvent[];

        if (events.length === 0) return null;

        // Ordenar por secuencia local
        events.sort((a, b) => a.terminal_sequence - b.terminal_sequence);

        let state: SaleProjection | null = null;
        for (const e of events) {
            state = applySaleEvent(state, e).state;
        }

        // Si la venta está finalizada o cancelada, retornamos null (limpia UI)
        if (state && (state.status === "CONFIRMED" || state.status === "CANCELLED")) {
            return null;
        }

        return state;
    }, [orderId], null);
}
