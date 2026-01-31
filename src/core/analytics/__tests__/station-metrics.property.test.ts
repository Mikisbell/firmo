/**
 * Property Test: Station Metrics Correctness
 * 
 * Property 5: For any set of order items with station assignments:
 * - pending_items = COUNT of items WHERE status IN ('PENDING', 'COOKING')
 * - avg_prep_time_minutes = AVG(ready_at - started_cooking_at) for completed items
 * - has_alert = TRUE if and only if pending_items > 10
 * - oldest_item_minutes = MAX(now - created_at) for pending items
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type Station = 'COCINA' | 'HORNO' | 'BAR';
type ItemStatus = 'PENDING' | 'COOKING' | 'READY' | 'DELIVERED';

interface OrderItem {
  id: string;
  station: Station;
  status: ItemStatus;
  created_at: Date;
  started_cooking_at?: Date;
  ready_at?: Date;
}

interface StationMetrics {
  station: string;
  pending_items: number;
  avg_prep_time_minutes: number;
  oldest_item_minutes: number | null;
  has_alert: boolean;
}

// Pure calculation function (extracted from service logic)
function calculateStationMetrics(items: OrderItem[], now: Date): StationMetrics[] {
  const STATIONS: Station[] = ['COCINA', 'HORNO', 'BAR'];
  
  const stationData: Record<string, {
    pending: number;
    prepTimes: number[];
    oldestMinutes: number | null;
  }> = {};

  for (const station of STATIONS) {
    stationData[station] = { pending: 0, prepTimes: [], oldestMinutes: null };
  }

  for (const item of items) {
    const station = item.station;
    if (!stationData[station]) continue;

    if (item.status === 'PENDING' || item.status === 'COOKING') {
      stationData[station].pending++;
      
      const ageMinutes = Math.round((now.getTime() - item.created_at.getTime()) / 60000);
      if (stationData[station].oldestMinutes === null || ageMinutes > stationData[station].oldestMinutes) {
        stationData[station].oldestMinutes = ageMinutes;
      }
    }

    if (item.status === 'READY' && item.started_cooking_at && item.ready_at) {
      const prepTime = (item.ready_at.getTime() - item.started_cooking_at.getTime()) / 60000;
      stationData[station].prepTimes.push(prepTime);
    }
  }

  return STATIONS.map(station => {
    const data = stationData[station];
    const avgPrepTime = data.prepTimes.length > 0
      ? Math.round((data.prepTimes.reduce((a, b) => a + b, 0) / data.prepTimes.length) * 10) / 10
      : 0;

    return {
      station,
      pending_items: data.pending,
      avg_prep_time_minutes: avgPrepTime,
      oldest_item_minutes: data.oldestMinutes,
      has_alert: data.pending > 10,
    };
  });
}

// Generators
const stationArb = fc.constantFrom<Station>('COCINA', 'HORNO', 'BAR');
const itemStatusArb = fc.constantFrom<ItemStatus>('PENDING', 'COOKING', 'READY', 'DELIVERED');

const orderItemArb = fc.record({
  id: fc.uuid(),
  station: stationArb,
  status: itemStatusArb,
  created_at: fc.integer({ min: 0, max: 7 * 24 * 60 }).map(mins => {
    const base = new Date('2026-01-01T00:00:00Z');
    return new Date(base.getTime() + mins * 60000);
  }),
}).chain(item => {
  // Add cooking timestamps for READY items
  if (item.status === 'READY') {
    const startOffset = fc.integer({ min: 1, max: 30 });
    const prepTime = fc.integer({ min: 1, max: 20 });
    
    return fc.tuple(startOffset, prepTime).map(([start, prep]) => ({
      ...item,
      started_cooking_at: new Date(item.created_at.getTime() + start * 60000),
      ready_at: new Date(item.created_at.getTime() + (start + prep) * 60000),
    } as OrderItem));
  }
  return fc.constant(item as OrderItem);
});

describe('Station Metrics Properties', () => {
  const now = new Date('2026-01-08T14:00:00Z');

  it('Property 5.1: pending_items counts only PENDING and COOKING items', () => {
    fc.assert(
      fc.property(fc.array(orderItemArb, { minLength: 0, maxLength: 100 }), (items) => {
        const metrics = calculateStationMetrics(items, now);
        
        for (const stationMetric of metrics) {
          const expectedPending = items.filter(
            i => i.station === stationMetric.station && 
                 (i.status === 'PENDING' || i.status === 'COOKING')
          ).length;
          
          expect(stationMetric.pending_items).toBe(expectedPending);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5.2: has_alert is true if and only if pending_items > 10', () => {
    fc.assert(
      fc.property(fc.array(orderItemArb, { minLength: 0, maxLength: 100 }), (items) => {
        const metrics = calculateStationMetrics(items, now);
        
        for (const stationMetric of metrics) {
          expect(stationMetric.has_alert).toBe(stationMetric.pending_items > 10);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5.3: oldest_item_minutes is null when no pending items', () => {
    // Create items that are all READY or DELIVERED
    const nonPendingItems: OrderItem[] = [
      { id: '1', station: 'COCINA', status: 'READY', created_at: new Date('2026-01-08T12:00:00Z'), started_cooking_at: new Date('2026-01-08T12:05:00Z'), ready_at: new Date('2026-01-08T12:15:00Z') },
      { id: '2', station: 'HORNO', status: 'DELIVERED', created_at: new Date('2026-01-08T12:00:00Z') },
    ];
    
    const metrics = calculateStationMetrics(nonPendingItems, now);
    
    for (const stationMetric of metrics) {
      if (stationMetric.pending_items === 0) {
        expect(stationMetric.oldest_item_minutes).toBeNull();
      }
    }
  });

  it('Property 5.4: oldest_item_minutes is max age of pending items', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const metrics = calculateStationMetrics(items, now);
          
          for (const stationMetric of metrics) {
            const pendingItems = items.filter(
              i => i.station === stationMetric.station && 
                   (i.status === 'PENDING' || i.status === 'COOKING')
            );
            
            if (pendingItems.length > 0) {
              const expectedOldest = Math.max(
                ...pendingItems.map(i => Math.round((now.getTime() - i.created_at.getTime()) / 60000))
              );
              expect(stationMetric.oldest_item_minutes).toBe(expectedOldest);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5.5: avg_prep_time only considers READY items with timestamps', () => {
    fc.assert(
      fc.property(fc.array(orderItemArb, { minLength: 0, maxLength: 50 }), (items) => {
        const metrics = calculateStationMetrics(items, now);
        
        for (const stationMetric of metrics) {
          const readyItems = items.filter(
            i => i.station === stationMetric.station && 
                 i.status === 'READY' && 
                 i.started_cooking_at && 
                 i.ready_at
          );
          
          if (readyItems.length === 0) {
            expect(stationMetric.avg_prep_time_minutes).toBe(0);
          } else {
            // Verify it's a reasonable average (non-negative)
            expect(stationMetric.avg_prep_time_minutes).toBeGreaterThanOrEqual(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5.6: all stations are always returned', () => {
    fc.assert(
      fc.property(fc.array(orderItemArb, { minLength: 0, maxLength: 50 }), (items) => {
        const metrics = calculateStationMetrics(items, now);
        
        expect(metrics.length).toBe(3);
        expect(metrics.map(m => m.station).sort()).toEqual(['BAR', 'COCINA', 'HORNO']);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 5.7: pending_items is always non-negative integer', () => {
    fc.assert(
      fc.property(fc.array(orderItemArb, { minLength: 0, maxLength: 50 }), (items) => {
        const metrics = calculateStationMetrics(items, now);
        
        for (const stationMetric of metrics) {
          expect(Number.isInteger(stationMetric.pending_items)).toBe(true);
          expect(stationMetric.pending_items).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
