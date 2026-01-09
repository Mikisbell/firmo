/**
 * Snapshot Service for Event Sourcing
 * 
 * Creates periodic snapshots of projection state to optimize rebuild times.
 * Instead of replaying all events from the beginning, we can load the latest
 * snapshot and only replay events that occurred after it.
 * 
 * Performance target: Reduce rebuild from 30s (1M events) to <1s
 */

import { db, type SnapshotEntity } from "@/src/core/db/schema";
import type { ParkEvent } from "@/src/core/domain/events";
import type { ProjectionsState, SaleProjection, ShiftProjection } from "./types";
import { applySaleEvent } from "./sale.reducer";
import { applyShiftEvent, emptyShift } from "./shift.reducer";

// Configuration
const SNAPSHOT_INTERVAL = 1000; // Create snapshot every N events
const MAX_SNAPSHOTS_PER_AGGREGATE = 3; // Keep only last N snapshots

export type AggregateType = 'ORDER' | 'SHIFT' | 'GLOBAL';

export interface SnapshotResult {
    created: boolean;
    sequence: number;
    reason?: string;
}

/**
 * Check if a snapshot should be created based on event count since last snapshot
 */
export async function shouldCreateSnapshot(
    aggregateType: AggregateType,
    aggregateId: string,
    currentSequence: number
): Promise<boolean> {
    const lastSnapshot = await db.snapshots
        .where({ aggregate_type: aggregateType, aggregate_id: aggregateId })
        .last();

    const lastSeq = lastSnapshot?.sequence ?? 0;
    return (currentSequence - lastSeq) >= SNAPSHOT_INTERVAL;
}

/**
 * Create a snapshot if enough events have accumulated
 */
export async function maybeCreateSnapshot(
    aggregateType: AggregateType,
    aggregateId: string,
    state: SaleProjection | ShiftProjection | ProjectionsState,
    currentSequence: number
): Promise<SnapshotResult> {
    const shouldCreate = await shouldCreateSnapshot(aggregateType, aggregateId, currentSequence);

    if (!shouldCreate) {
        return { created: false, sequence: currentSequence, reason: 'Not enough events since last snapshot' };
    }

    // Create new snapshot
    await db.snapshots.add({
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        sequence: currentSequence,
        state: JSON.parse(JSON.stringify(state)), // Deep clone to avoid mutations
        created_at: new Date().toISOString(),
    });

    // Cleanup old snapshots (keep only MAX_SNAPSHOTS_PER_AGGREGATE)
    await cleanupOldSnapshots(aggregateType, aggregateId);

    return { created: true, sequence: currentSequence };
}

/**
 * Force create a snapshot regardless of interval
 */
export async function forceCreateSnapshot(
    aggregateType: AggregateType,
    aggregateId: string,
    state: SaleProjection | ShiftProjection | ProjectionsState,
    currentSequence: number
): Promise<SnapshotResult> {
    await db.snapshots.add({
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        sequence: currentSequence,
        state: JSON.parse(JSON.stringify(state)),
        created_at: new Date().toISOString(),
    });

    await cleanupOldSnapshots(aggregateType, aggregateId);
    return { created: true, sequence: currentSequence };
}

/**
 * Get the latest snapshot for an aggregate
 */
export async function getLatestSnapshot(
    aggregateType: AggregateType,
    aggregateId: string
): Promise<SnapshotEntity | undefined> {
    return db.snapshots
        .where({ aggregate_type: aggregateType, aggregate_id: aggregateId })
        .last();
}

/**
 * Rebuild a sale projection from snapshot + delta events
 */
export async function rebuildSaleFromSnapshot(
    orderId: string,
    allEvents: ParkEvent[]
): Promise<{ state: SaleProjection | null; warnings: string[]; fromSnapshot: boolean }> {
    const warnings: string[] = [];

    // 1. Try to load snapshot
    const snapshot = await getLatestSnapshot('ORDER', orderId);

    let state: SaleProjection | null = null;
    let fromSeq = 0;
    let fromSnapshot = false;

    if (snapshot) {
        state = snapshot.state as SaleProjection;
        fromSeq = snapshot.sequence;
        fromSnapshot = true;
    }

    // 2. Filter events after snapshot and for this order
    const deltaEvents = allEvents.filter(e =>
        e.aggregate_id === orderId &&
        e.terminal_sequence > fromSeq
    );

    // 3. Apply delta events
    for (const event of deltaEvents) {
        const result = applySaleEvent(state, event);
        state = result.state;
        warnings.push(...result.warnings);
    }

    return { state, warnings, fromSnapshot };
}

/**
 * Rebuild shift projection from snapshot + delta events
 */
export async function rebuildShiftFromSnapshot(
    shiftId: string,
    allEvents: ParkEvent[]
): Promise<{ state: ShiftProjection; warnings: string[]; fromSnapshot: boolean }> {
    const warnings: string[] = [];

    // 1. Try to load snapshot
    const snapshot = await getLatestSnapshot('SHIFT', shiftId);

    let state: ShiftProjection = emptyShift();
    let fromSeq = 0;
    let fromSnapshot = false;

    if (snapshot) {
        state = snapshot.state as ShiftProjection;
        fromSeq = snapshot.sequence;
        fromSnapshot = true;
    }

    // 2. Filter events after snapshot
    const deltaEvents = allEvents.filter(e =>
        e.terminal_sequence > fromSeq
    );

    // 3. Apply delta events
    for (const event of deltaEvents) {
        const result = applyShiftEvent(state, event);
        state = result.state;
        warnings.push(...result.warnings);
    }

    return { state, warnings, fromSnapshot };
}

/**
 * Rebuild all projections from snapshots + delta events (optimized version of rebuildFromEvents)
 */
export async function rebuildFromSnapshots(
    events: ParkEvent[]
): Promise<{ state: ProjectionsState; warnings: string[]; stats: RebuildStats }> {
    const warnings: string[] = [];
    const stats: RebuildStats = {
        totalEvents: events.length,
        eventsReplayed: 0,
        snapshotsUsed: 0,
        rebuildTimeMs: 0,
    };

    const startTime = performance.now();

    // 1. Try to load global snapshot
    const globalSnapshot = await getLatestSnapshot('GLOBAL', 'global');

    let activeSale: SaleProjection | null = null;
    let shift: ShiftProjection = emptyShift();
    let fromSeq = 0;

    if (globalSnapshot) {
        const snapshotState = globalSnapshot.state as ProjectionsState;
        activeSale = snapshotState.activeSale;
        shift = snapshotState.shift;
        fromSeq = globalSnapshot.sequence;
        stats.snapshotsUsed = 1;
    }

    // 2. Filter events after snapshot
    const deltaEvents = events.filter(e => e.terminal_sequence > fromSeq);
    stats.eventsReplayed = deltaEvents.length;

    // 3. Apply delta events
    for (const e of deltaEvents) {
        const saleRes = applySaleEvent(activeSale, e);
        activeSale = saleRes.state;
        warnings.push(...saleRes.warnings);

        const shiftRes = applyShiftEvent(shift, e);
        shift = shiftRes.state;
        warnings.push(...shiftRes.warnings);
    }

    stats.rebuildTimeMs = performance.now() - startTime;

    return {
        state: { activeSale, shift },
        warnings,
        stats,
    };
}

/**
 * Create a global snapshot of all projections
 */
export async function createGlobalSnapshot(
    state: ProjectionsState,
    currentSequence: number
): Promise<SnapshotResult> {
    return maybeCreateSnapshot('GLOBAL', 'global', state, currentSequence);
}

/**
 * Remove old snapshots, keeping only the most recent ones
 */
async function cleanupOldSnapshots(
    aggregateType: AggregateType,
    aggregateId: string
): Promise<number> {
    const snapshots = await db.snapshots
        .where({ aggregate_type: aggregateType, aggregate_id: aggregateId })
        .sortBy('sequence');

    if (snapshots.length <= MAX_SNAPSHOTS_PER_AGGREGATE) {
        return 0;
    }

    // Delete oldest snapshots
    const toDelete = snapshots.slice(0, snapshots.length - MAX_SNAPSHOTS_PER_AGGREGATE);
    const idsToDelete = toDelete.map(s => s.id!).filter(id => id !== undefined);

    await db.snapshots.bulkDelete(idsToDelete);
    return idsToDelete.length;
}

/**
 * Clear all snapshots (for testing or reset)
 */
export async function clearAllSnapshots(): Promise<void> {
    await db.snapshots.clear();
}

/**
 * Get snapshot statistics
 */
export async function getSnapshotStats(): Promise<{
    totalSnapshots: number;
    byType: Record<string, number>;
    oldestSnapshot?: string;
    newestSnapshot?: string;
}> {
    const all = await db.snapshots.toArray();

    const byType: Record<string, number> = {};
    for (const s of all) {
        byType[s.aggregate_type] = (byType[s.aggregate_type] || 0) + 1;
    }

    const sorted = all.sort((a, b) => a.created_at.localeCompare(b.created_at));

    return {
        totalSnapshots: all.length,
        byType,
        oldestSnapshot: sorted[0]?.created_at,
        newestSnapshot: sorted[sorted.length - 1]?.created_at,
    };
}

export interface RebuildStats {
    totalEvents: number;
    eventsReplayed: number;
    snapshotsUsed: number;
    rebuildTimeMs: number;
}

// Export configuration for testing
export const SNAPSHOT_CONFIG = {
    SNAPSHOT_INTERVAL,
    MAX_SNAPSHOTS_PER_AGGREGATE,
} as const;
