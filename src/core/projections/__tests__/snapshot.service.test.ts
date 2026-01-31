/**
 * Snapshot Service Tests
 * 
 * Property-based tests for snapshot creation and rebuild optimization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';

// Mock Dexie before imports
vi.mock('@/src/core/db/schema', () => {
    const snapshots: any[] = [];
    return {
        db: {
            snapshots: {
                where: vi.fn((query: any) => ({
                    last: vi.fn(async () => {
                        const filtered = snapshots.filter(s =>
                            s.aggregate_type === query.aggregate_type &&
                            s.aggregate_id === query.aggregate_id
                        );
                        return filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
                    }),
                    sortBy: vi.fn(async () => {
                        return snapshots.filter(s =>
                            s.aggregate_type === query.aggregate_type &&
                            s.aggregate_id === query.aggregate_id
                        ).sort((a, b) => a.sequence - b.sequence);
                    }),
                })),
                add: vi.fn(async (snapshot: any) => {
                    const id = snapshots.length + 1;
                    snapshots.push({ ...snapshot, id });
                    return id;
                }),
                bulkDelete: vi.fn(async (ids: number[]) => {
                    for (const id of ids) {
                        const idx = snapshots.findIndex(s => s.id === id);
                        if (idx >= 0) snapshots.splice(idx, 1);
                    }
                }),
                clear: vi.fn(async () => {
                    snapshots.length = 0;
                }),
                toArray: vi.fn(async () => [...snapshots]),
            },
        },
        // Export for test access
        __snapshots: snapshots,
    };
});

import {
    shouldCreateSnapshot,
    maybeCreateSnapshot,
    forceCreateSnapshot,
    getLatestSnapshot,
    clearAllSnapshots,
    getSnapshotStats,
    SNAPSHOT_CONFIG,
    type AggregateType,
} from '../snapshot.service';
import type { SaleProjection } from '../types';
import { asCentavos, asOrderId } from '@/src/core/types/shared';

describe('Snapshot Service', () => {
    beforeEach(async () => {
        await clearAllSnapshots();
    });

    describe('shouldCreateSnapshot', () => {
        it('returns true when no snapshot exists', async () => {
            const result = await shouldCreateSnapshot('ORDER', 'order-1', 1000);
            expect(result).toBe(true);
        });

        it('returns false when below threshold', async () => {
            // Create a snapshot at sequence 500
            await forceCreateSnapshot('ORDER', 'order-1', {} as any, 500);

            // Check at sequence 600 (only 100 events since snapshot)
            const result = await shouldCreateSnapshot('ORDER', 'order-1', 600);
            expect(result).toBe(false);
        });

        it('returns true when at or above threshold', async () => {
            await forceCreateSnapshot('ORDER', 'order-1', {} as any, 0);

            // Check at sequence 1000 (exactly threshold)
            const result = await shouldCreateSnapshot('ORDER', 'order-1', SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL);
            expect(result).toBe(true);
        });
    });

    describe('maybeCreateSnapshot', () => {
        it('creates snapshot when threshold reached', async () => {
            const state: SaleProjection = {
                sale_id: asOrderId('sale-1'),
                order_id: asOrderId('order-1'),
                order_number: 1,
                order_type: 'DINE_IN',
                catalog_version: 1,
                status: 'OPEN',
                lines: {},
                subtotal_cents: asCentavos(0),
                payments: [],
                paid_cents: asCentavos(0),
                change_cents: asCentavos(0),
                total_cents: null,
                last_event_sequence: 1000,
                correlation_id: 'corr-1',
                checks: [],
            };

            const result = await maybeCreateSnapshot('ORDER', 'order-1', state, 1000);
            expect(result.created).toBe(true);
            expect(result.sequence).toBe(1000);
        });

        it('does not create snapshot below threshold', async () => {
            await forceCreateSnapshot('ORDER', 'order-1', {} as any, 500);

            const result = await maybeCreateSnapshot('ORDER', 'order-1', {} as any, 600);
            expect(result.created).toBe(false);
            expect(result.reason).toContain('Not enough events');
        });
    });

    describe('getLatestSnapshot', () => {
        it('returns undefined when no snapshots exist', async () => {
            const result = await getLatestSnapshot('ORDER', 'nonexistent');
            expect(result).toBeUndefined();
        });

        it('returns the latest snapshot', async () => {
            await forceCreateSnapshot('ORDER', 'order-1', { v: 1 } as any, 100);
            await forceCreateSnapshot('ORDER', 'order-1', { v: 2 } as any, 200);

            const result = await getLatestSnapshot('ORDER', 'order-1');
            expect(result?.sequence).toBe(200);
            expect(result?.state).toEqual({ v: 2 });
        });
    });

    describe('getSnapshotStats', () => {
        it('returns correct statistics', async () => {
            await forceCreateSnapshot('ORDER', 'order-1', {} as any, 100);
            await forceCreateSnapshot('ORDER', 'order-2', {} as any, 200);
            await forceCreateSnapshot('SHIFT', 'shift-1', {} as any, 150);

            const stats = await getSnapshotStats();
            expect(stats.totalSnapshots).toBe(3);
            expect(stats.byType['ORDER']).toBe(2);
            expect(stats.byType['SHIFT']).toBe(1);
        });
    });
});

describe('Snapshot Properties', () => {
    beforeEach(async () => {
        await clearAllSnapshots();
    });

    // Property 1: Snapshot creation is deterministic
    it('Property 1: Snapshot creation is deterministic based on sequence gap', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 10000 }),
                fc.integer({ min: 0, max: 10000 }),
                async (lastSnapshotSeq, currentSeq) => {
                    await clearAllSnapshots();

                    if (lastSnapshotSeq > 0) {
                        await forceCreateSnapshot('ORDER', 'test', {} as any, lastSnapshotSeq);
                    }

                    const shouldCreate = await shouldCreateSnapshot('ORDER', 'test', currentSeq);
                    const gap = currentSeq - (lastSnapshotSeq > 0 ? lastSnapshotSeq : 0);

                    // Should create if gap >= threshold
                    expect(shouldCreate).toBe(gap >= SNAPSHOT_CONFIG.SNAPSHOT_INTERVAL);
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 2: Snapshots preserve state integrity
    it('Property 2: Snapshot state is deep-cloned (no mutation leakage)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    sale_id: fc.uuid(),
                    subtotal_cents: fc.integer({ min: 0, max: 1000000 }),
                }),
                async (partialState) => {
                    await clearAllSnapshots();

                    const state = {
                        ...partialState,
                        sale_id: asOrderId(partialState.sale_id),
                        order_id: asOrderId(partialState.sale_id),
                        subtotal_cents: asCentavos(partialState.subtotal_cents),
                        order_number: 1,
                        order_type: 'DINE_IN' as const,
                        catalog_version: 1,
                        status: 'OPEN' as const,
                        lines: {},
                        payments: [],
                        paid_cents: asCentavos(0),
                        change_cents: asCentavos(0),
                        total_cents: null,
                        last_event_sequence: 1000,
                        correlation_id: 'test',
                        checks: [],
                    };

                    await forceCreateSnapshot('ORDER', partialState.sale_id, state, 1000);

                    // Mutate original state
                    (state as any).subtotal_cents = 999999;

                    // Snapshot should have original value
                    const snapshot = await getLatestSnapshot('ORDER', partialState.sale_id);
                    expect(snapshot?.state.subtotal_cents).toBe(partialState.subtotal_cents);
                }
            ),
            { numRuns: 20 }
        );
    });

    // Property 3: Sequence numbers are monotonically increasing per aggregate
    it('Property 3: Multiple snapshots have increasing sequences', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 2, maxLength: 5 }),
                async (sequences) => {
                    await clearAllSnapshots();

                    const sortedSeqs = [...sequences].sort((a, b) => a - b);

                    for (const seq of sortedSeqs) {
                        await forceCreateSnapshot('ORDER', 'test', { seq } as any, seq);
                    }

                    const latest = await getLatestSnapshot('ORDER', 'test');
                    expect(latest?.sequence).toBe(sortedSeqs[sortedSeqs.length - 1]);
                }
            ),
            { numRuns: 20 }
        );
    });

    // Property 4: Different aggregates have independent snapshots
    it('Property 4: Aggregate isolation - snapshots are independent per aggregate', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.uuid(),
                fc.integer({ min: 100, max: 1000 }),
                fc.integer({ min: 100, max: 1000 }),
                async (id1, id2, seq1, seq2) => {
                    if (id1 === id2) return; // Skip if same ID

                    await clearAllSnapshots();

                    await forceCreateSnapshot('ORDER', id1, { id: id1 } as any, seq1);
                    await forceCreateSnapshot('ORDER', id2, { id: id2 } as any, seq2);

                    const snap1 = await getLatestSnapshot('ORDER', id1);
                    const snap2 = await getLatestSnapshot('ORDER', id2);

                    expect(snap1?.state.id).toBe(id1);
                    expect(snap1?.sequence).toBe(seq1);
                    expect(snap2?.state.id).toBe(id2);
                    expect(snap2?.sequence).toBe(seq2);
                }
            ),
            { numRuns: 20 }
        );
    });

    // Property 5: Aggregate types are independent
    it('Property 5: Different aggregate types are independent', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom<AggregateType>('ORDER', 'SHIFT', 'GLOBAL'),
                fc.constantFrom<AggregateType>('ORDER', 'SHIFT', 'GLOBAL'),
                async (type1, type2) => {
                    if (type1 === type2) return;

                    await clearAllSnapshots();

                    await forceCreateSnapshot(type1, 'same-id', { type: type1 } as any, 100);
                    await forceCreateSnapshot(type2, 'same-id', { type: type2 } as any, 200);

                    const snap1 = await getLatestSnapshot(type1, 'same-id');
                    const snap2 = await getLatestSnapshot(type2, 'same-id');

                    expect(snap1?.state.type).toBe(type1);
                    expect(snap2?.state.type).toBe(type2);
                }
            ),
            { numRuns: 10 }
        );
    });
});
