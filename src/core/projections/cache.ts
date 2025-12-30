import { db } from "@/src/core/db/schema";
import type { ProjectionsState } from "./types";
import { emptyShift } from "./shift.reducer";

const SALE_KEY = "singleton_sale";
const SHIFT_KEY = "singleton_shift";

export async function loadProjectionsFromCache(): Promise<ProjectionsState> {
    const [sale, shift] = await Promise.all([
        db.projections.get(SALE_KEY),
        db.projections.get(SHIFT_KEY),
    ]);

    return {
        activeSale: sale?.data ?? null,
        shift: shift?.data ?? emptyShift(),
    };
}

export async function saveProjectionsToCache(state: ProjectionsState) {
    await db.transaction("rw", db.projections, async () => {
        await db.projections.put({ key: SALE_KEY, data: state.activeSale, last_seq: state.activeSale?.last_event_sequence ?? 0 });
        await db.projections.put({ key: SHIFT_KEY, data: state.shift, last_seq: state.shift.last_event_sequence });
    });
}
