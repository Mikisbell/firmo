/**
 * PARK POS Projections Module
 *
 * Barrel export for event projection reducers, snapshot service, and types.
 * Import from '@/src/core/projections' instead of individual files.
 */

export { createOrderFromEvent, applySaleEvent } from './sale.reducer';
export { emptyShift, applyShiftEvent } from './shift.reducer';
export {
  shouldCreateSnapshot,
  maybeCreateSnapshot,
  forceCreateSnapshot,
  getLatestSnapshot,
  rebuildSaleFromSnapshot,
  rebuildShiftFromSnapshot,
  rebuildFromSnapshots,
  createGlobalSnapshot,
  clearAllSnapshots,
  getSnapshotStats,
  SNAPSHOT_CONFIG,
} from './snapshot.service';
export type { AggregateType, SnapshotResult, RebuildStats } from './snapshot.service';
export { rebuildFromEvents, rebuildFromEventsOptimized, rebuildAndSnapshot } from './rebuild';
export { loadProjectionsFromCache, saveProjectionsToCache } from './cache';
export * from './types';
export * from './hr-types';
