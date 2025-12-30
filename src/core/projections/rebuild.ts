import type { ParkEvent } from "@/src/core/domain/events";
import type { ProjectionsState } from "./types";
import { applySaleEvent } from "./sale.reducer";
import { applyShiftEvent, emptyShift } from "./shift.reducer";

export function rebuildFromEvents(events: ParkEvent[]): { state: ProjectionsState; warnings: string[] } {
    const warnings: string[] = [];

    // Asumimos ordenados por terminal_sequence
    let activeSale: ProjectionsState["activeSale"] = null;
    let shift = emptyShift();

    for (const e of events) {
        // Sale
        const saleRes = applySaleEvent(activeSale as any, e); // eslint-disable-line @typescript-eslint/no-explicit-any
        activeSale = saleRes.state as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        warnings.push(...saleRes.warnings);

        // Shift
        const shiftRes = applyShiftEvent(shift, e);
        shift = shiftRes.state;
        warnings.push(...shiftRes.warnings);
    }

    return { state: { activeSale, shift }, warnings };
}
