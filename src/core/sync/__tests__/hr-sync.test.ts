/**
 * Unit + Integration Tests: HR Sync Client
 * Fase 9 - Sincronización de eventos HR offline
 *
 * Tests for pure functions and sync logic.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateBackoff,
  batchEvents,
  isHighPriorityEvent,
  prioritizeEvents,
  isValidForSync,
  buildSyncPayload,
  parseSyncResponse,
} from '../hr-sync';
import type { PendingHREvent } from '@/src/core/db/hr-offline-db';

type HREventType =
  | 'EMPLOYEE_CREATED' | 'EMPLOYEE_PROFILE_UPDATED' | 'EMPLOYEE_DEACTIVATED'
  | 'ATTENDANCE_CLOCKED_IN' | 'ATTENDANCE_CLOCKED_OUT'
  | 'ATTENDANCE_ABSENCE_DETECTED' | 'ATTENDANCE_JUSTIFIED'
  | 'LEAVE_REQUEST_CREATED' | 'LEAVE_REQUEST_APPROVED' | 'LEAVE_REQUEST_REJECTED'
  | 'ADVANCE_REQUESTED' | 'ADVANCE_APPROVED'
  | 'PAYROLL_CALCULATED' | 'EVALUATION_CREATED' | 'TRAINING_COMPLETED';

// ============ PURE FUNCTION TESTS ============

describe('calculateBackoff', () => {
  it('should return a value within min/max bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 100, max: 5000 }),
        fc.integer({ min: 10000, max: 120000 }),
        (attempt, minMs, maxMs) => {
          const result = calculateBackoff(attempt, minMs, maxMs, 0.2);
          // With jitter, the value should be close to exponential backoff
          const exponential = Math.min(minMs * Math.pow(2, attempt), maxMs);
          const lowerBound = exponential * 0.8;
          const upperBound = exponential * 1.2;
          expect(result).toBeGreaterThanOrEqual(Math.floor(lowerBound));
          expect(result).toBeLessThanOrEqual(Math.ceil(upperBound));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cap at maxMs', () => {
    const result = calculateBackoff(100, 1000, 60000, 0);
    expect(result).toBeLessThanOrEqual(60000);
  });

  it('should increase with more attempts (no jitter)', () => {
    const attempt0 = calculateBackoff(0, 1000, 60000, 0);
    const attempt1 = calculateBackoff(1, 1000, 60000, 0);
    const attempt2 = calculateBackoff(2, 1000, 60000, 0);
    expect(attempt1).toBeGreaterThanOrEqual(attempt0);
    expect(attempt2).toBeGreaterThanOrEqual(attempt1);
  });
});

describe('batchEvents', () => {
  it('should split events into correct number of batches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 0, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (events, batchSize) => {
          const batches = batchEvents(events, batchSize);
          const expectedBatches = Math.ceil(events.length / batchSize);
          expect(batches.length).toBe(events.length === 0 ? 0 : expectedBatches);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all events across batches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 20 }),
        (events, batchSize) => {
          const batches = batchEvents(events, batchSize);
          const flattened = batches.flat();
          expect(flattened).toEqual(events);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should have all batches <= batchSize', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer(), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (events, batchSize) => {
          const batches = batchEvents(events, batchSize);
          for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(batchSize);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return empty array for empty input', () => {
    expect(batchEvents([], 10)).toEqual([]);
  });
});

describe('isHighPriorityEvent', () => {
  it('should return true for clock-in events', () => {
    expect(isHighPriorityEvent('ATTENDANCE_CLOCKED_IN')).toBe(true);
  });

  it('should return true for clock-out events', () => {
    expect(isHighPriorityEvent('ATTENDANCE_CLOCKED_OUT')).toBe(true);
  });

  it('should return false for other event types', () => {
    const lowPriority: HREventType[] = [
      'EMPLOYEE_CREATED', 'EMPLOYEE_PROFILE_UPDATED', 'EMPLOYEE_DEACTIVATED',
      'LEAVE_REQUEST_CREATED', 'ADVANCE_REQUESTED', 'PAYROLL_CALCULATED',
    ];
    for (const type of lowPriority) {
      expect(isHighPriorityEvent(type)).toBe(false);
    }
  });
});

describe('prioritizeEvents', () => {
  it('should put attendance events before other types', () => {
    const events: PendingHREvent[] = [
      makeEvent('LEAVE_REQUEST_CREATED', '2025-01-01T10:00:00Z'),
      makeEvent('ATTENDANCE_CLOCKED_IN', '2025-01-01T10:01:00Z'),
      makeEvent('EMPLOYEE_CREATED', '2025-01-01T09:00:00Z'),
      makeEvent('ATTENDANCE_CLOCKED_OUT', '2025-01-01T10:02:00Z'),
    ];

    const sorted = prioritizeEvents(events);

    // First two should be attendance events (high priority)
    expect(sorted[0].type).toBe('ATTENDANCE_CLOCKED_IN');
    expect(sorted[1].type).toBe('ATTENDANCE_CLOCKED_OUT');
  });

  it('should preserve chronological order within same priority', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            eventId: fc.uuid(),
            type: fc.constant<HREventType>('LEAVE_REQUEST_CREATED'),
            tenantId: fc.constant('t1'),
            employeeId: fc.constant('e1'),
            actorId: fc.constant('a1'),
            createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
              .filter(d => !isNaN(d.getTime()))
              .map(d => d.toISOString()),
            syncStatus: fc.constant<'pending'>('pending'),
            retryCount: fc.constant(0),
            payload: fc.constant({}),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (events) => {
          const sorted = prioritizeEvents(events as PendingHREvent[]);
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i].createdAt >= sorted[i - 1].createdAt).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not modify original array', () => {
    const events = [
      makeEvent('EMPLOYEE_CREATED', '2025-01-01T10:00:00Z'),
      makeEvent('ATTENDANCE_CLOCKED_IN', '2025-01-01T09:00:00Z'),
    ];
    const original = [...events];
    prioritizeEvents(events);
    expect(events).toEqual(original);
  });
});

describe('isValidForSync', () => {
  it('should return true for valid events', () => {
    const event = makeEvent('EMPLOYEE_CREATED', '2025-01-01T10:00:00Z');
    expect(isValidForSync(event)).toBe(true);
  });

  it('should return false for events missing required fields', () => {
    const incomplete = {
      eventId: '',
      type: 'EMPLOYEE_CREATED' as HREventType,
      tenantId: 'tenant-1',
      employeeId: 'emp-1',
      actorId: 'actor-1',
      createdAt: '2025-01-01T10:00:00Z',
      syncStatus: 'pending' as const,
      retryCount: 0,
      payload: {},
    };
    expect(isValidForSync(incomplete)).toBe(false);
  });
});

describe('buildSyncPayload', () => {
  it('should map PendingHREvent to sync format', () => {
    const events = [makeEvent('EMPLOYEE_CREATED', '2025-01-01T10:00:00Z')];
    const payload = buildSyncPayload(events);

    expect(payload.events).toHaveLength(1);
    expect(payload.events[0].event_id).toBe(events[0].eventId);
    expect(payload.events[0].event_type).toBe('EMPLOYEE_CREATED');
    expect(payload.events[0].tenant_id).toBe(events[0].tenantId);
    expect(payload.events[0].employee_id).toBe(events[0].employeeId);
    expect(payload.events[0].actor_id).toBe(events[0].actorId);
    expect(payload.events[0].created_at).toBe(events[0].createdAt);
    expect(payload.events[0].payload).toEqual(events[0].payload);
  });

  it('should handle multiple events', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (count) => {
          const events = Array.from({ length: count }, (_, i) =>
            makeEvent('EMPLOYEE_CREATED', `2025-01-01T${String(i).padStart(2, '0')}:00:00Z`)
          );
          const payload = buildSyncPayload(events);
          expect(payload.events).toHaveLength(count);
        }
      ),
      { numRuns: 20 }
    );
  });
});

describe('parseSyncResponse', () => {
  it('should extract synced and failed event IDs', () => {
    const response = {
      accepted: true,
      synced_event_ids: ['id1', 'id2'],
      rejected: [{ event_id: 'id3', error: 'Invalid data' }],
      deduped_event_ids: ['id4'],
    };

    const result = parseSyncResponse(response);
    expect(result.syncedIds).toEqual(['id1', 'id2', 'id4']);
    expect(result.failedIds).toEqual([{ eventId: 'id3', error: 'Invalid data' }]);
  });

  it('should handle empty response', () => {
    const response = { accepted: true };
    const result = parseSyncResponse(response);
    expect(result.syncedIds).toEqual([]);
    expect(result.failedIds).toEqual([]);
  });

  it('should include deduped events as synced', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
        (syncedIds, dedupedIds) => {
          const response = {
            accepted: true,
            synced_event_ids: syncedIds,
            deduped_event_ids: dedupedIds,
          };
          const result = parseSyncResponse(response);
          expect(result.syncedIds.length).toBe(syncedIds.length + dedupedIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============ HELPERS ============

function makeEvent(type: HREventType, createdAt: string): PendingHREvent {
  return {
    id: Math.floor(Math.random() * 10000),
    eventId: `evt-${type}-${createdAt}-${Math.random()}`,
    type,
    tenantId: 'tenant-1',
    employeeId: 'emp-1',
    actorId: 'actor-1',
    createdAt,
    syncStatus: 'pending',
    retryCount: 0,
    payload: { test: true },
  };
}
