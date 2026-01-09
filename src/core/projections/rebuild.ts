import type { ParkEvent } from "@/src/core/domain/events";
import type { ProjectionsState } from "./types";
import { applySaleEvent } from "./sale.reducer";
import { applyShiftEvent, emptyShift } from "./shift.reducer";
import { rebuildFromSnapshots, createGlobalSnapshot, type RebuildStats } from "./snapshot.service";

/**
 * Rebuild projections from events (legacy, no snapshots)
 * Use rebuildFromEventsOptimized for production
 */
export function rebuildFromEvents(events: ParkEvent[]): { state: ProjectionsState; warnings: string[] } {
    const warnings: string[] = [];

    // Asumimos ordenados por terminal_sequence
    let activeSale: ProjectionsState["activeSale"] = null;
    let shift = emptyShift();

    for (const e of events) {
        // Sale
        const saleRes = applySaleEvent(activeSale as any, e);
        activeSale = saleRes.state as any;
        warnings.push(...saleRes.warnings);

        // Shift
        const shiftRes = applyShiftEvent(shift, e);
        shift = shiftRes.state;
        warnings.push(...shiftRes.warnings);
    }

    return { state: { activeSale, shift }, warnings };
}

/**
 * Rebuild projections using snapshots for optimization
 * Falls back to full rebuild if no snapshots exist
 */
export async function rebuildFromEventsOptimized(
    events: ParkEvent[]
): Promise<{ state: ProjectionsState; warnings: string[]; stats: RebuildStats }> {
    return rebuildFromSnapshots(events);
}

/**
 * Rebuild and optionally create a snapshot if threshold is met
 */
export async function rebuildAndSnapshot(
    events: ParkEvent[]
): Promise<{ state: ProjectionsState; warnings: string[]; stats: RebuildStats; snapshotCreated: boolean }> {
    const result = await rebuildFromSnapshots(events);

    // Get the last event sequence
    const lastSeq = events.length > 0
        ? Math.max(...events.map(e => e.terminal_sequence))
        : 0;

    // Try to create snapshot if enough events accumulated
    const snapshotResult = await createGlobalSnapshot(result.state, lastSeq);

    return {
        ...result,
        snapshotCreated: snapshotResult.created,
    };
}
