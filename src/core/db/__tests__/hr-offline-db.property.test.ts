/**
 * Property Tests: HR Offline Database
 * Fase 9 - Soporte Offline para RRHH
 *
 * Properties:
 * - 61: Eventos offline se almacenan localmente
 * - 62: Sincronización envía todos los eventos
 * - 63: Lectura offline desde caché
 * - 64: Solicitudes offline se sincronizan
 * - 65: Resolución de conflictos
 *
 * Validates: Requirements 12.1-12.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============ MOCK TYPES (to avoid Dexie in Node) ============

type HREventType =
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_PROFILE_UPDATED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'ATTENDANCE_CLOCKED_IN'
  | 'ATTENDANCE_CLOCKED_OUT'
  | 'ATTENDANCE_ABSENCE_DETECTED'
  | 'ATTENDANCE_JUSTIFIED'
  | 'LEAVE_REQUEST_CREATED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'ADVANCE_REQUESTED'
  | 'ADVANCE_APPROVED'
  | 'PAYROLL_CALCULATED'
  | 'EVALUATION_CREATED'
  | 'TRAINING_COMPLETED';

type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

interface PendingHREvent {
  id?: number;
  eventId: string;
  type: HREventType;
  tenantId: string;
  employeeId: string;
  actorId: string;
  createdAt: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastError?: string;
  payload: unknown;
}

interface CachedEmployee {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  isActive: boolean;
  updatedAt: string;
}

interface CachedSchedule {
  id: string;
  tenantId: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  updatedAt: string;
}

interface CachedAttendance {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: string;
  updatedAt: string;
}

interface CachedLeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  status: string;
  updatedAt: string;
}

// ============ IN-MEMORY MOCK DATABASE ============

const MAX_RETRIES = 5;

function createMockHRDB() {
  const events = new Map<string, PendingHREvent>();
  const employees = new Map<string, CachedEmployee>();
  const schedules = new Map<string, CachedSchedule>();
  const attendance = new Map<string, CachedAttendance>();
  const leaveRequests = new Map<string, CachedLeaveRequest>();
  let autoId = 1;

  return {
    // Pending Events
    async addPendingEvent(event: Omit<PendingHREvent, 'id'>): Promise<number> {
      if (events.has(event.eventId)) {
        return events.get(event.eventId)!.id!;
      }
      const id = autoId++;
      events.set(event.eventId, { ...event, id });
      return id;
    },

    async getPendingEvents(): Promise<PendingHREvent[]> {
      return Array.from(events.values())
        .filter(e => (e.syncStatus === 'pending' || e.syncStatus === 'failed') && e.retryCount < MAX_RETRIES)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    async getPendingCount(): Promise<number> {
      return Array.from(events.values())
        .filter(e => ['pending', 'syncing', 'failed'].includes(e.syncStatus) && e.retryCount < MAX_RETRIES)
        .length;
    },

    async updateEventStatus(eventId: string, status: SyncStatus): Promise<void> {
      const event = events.get(eventId);
      if (event) event.syncStatus = status;
    },

    async incrementRetry(eventId: string, error: string): Promise<void> {
      const event = events.get(eventId);
      if (event) {
        event.retryCount++;
        event.lastError = error;
        event.syncStatus = event.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
      }
    },

    async markAsSynced(eventId: string): Promise<void> {
      const event = events.get(eventId);
      if (event) event.syncStatus = 'synced';
    },

    async getEventById(eventId: string): Promise<PendingHREvent | undefined> {
      return events.get(eventId);
    },

    async cleanupSyncedEvents(): Promise<number> {
      let count = 0;
      for (const [eventId, event] of events) {
        if (event.syncStatus === 'synced') {
          events.delete(eventId);
          count++;
        }
      }
      return count;
    },

    async cleanupFailedEvents(): Promise<number> {
      let count = 0;
      for (const [eventId, event] of events) {
        if (event.syncStatus === 'failed' && event.retryCount >= MAX_RETRIES) {
          events.delete(eventId);
          count++;
        }
      }
      return count;
    },

    async getAllEvents(): Promise<PendingHREvent[]> {
      return Array.from(events.values());
    },

    async clearAllEvents(): Promise<void> {
      events.clear();
    },

    // Cache
    async cacheEmployees(emps: CachedEmployee[]): Promise<void> {
      for (const e of emps) employees.set(e.id, e);
    },

    async getCachedEmployees(tenantId: string): Promise<CachedEmployee[]> {
      return Array.from(employees.values()).filter(e => e.tenantId === tenantId && e.isActive);
    },

    async getCachedEmployeeById(id: string): Promise<CachedEmployee | undefined> {
      return employees.get(id);
    },

    async cacheSchedules(scheds: CachedSchedule[]): Promise<void> {
      for (const s of scheds) schedules.set(s.id, s);
    },

    async getCachedSchedules(tenantId: string, employeeId: string): Promise<CachedSchedule[]> {
      return Array.from(schedules.values()).filter(s => s.tenantId === tenantId && s.employeeId === employeeId);
    },

    async cacheAttendance(records: CachedAttendance[]): Promise<void> {
      for (const a of records) attendance.set(a.id, a);
    },

    async getCachedAttendance(tenantId: string, employeeId: string): Promise<CachedAttendance[]> {
      return Array.from(attendance.values())
        .filter(a => a.tenantId === tenantId && a.employeeId === employeeId)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    async cacheLeaveRequests(reqs: CachedLeaveRequest[]): Promise<void> {
      for (const r of reqs) leaveRequests.set(r.id, r);
    },

    async getCachedLeaveRequests(tenantId: string, employeeId: string): Promise<CachedLeaveRequest[]> {
      return Array.from(leaveRequests.values()).filter(r => r.tenantId === tenantId && r.employeeId === employeeId);
    },

    async clearAllCaches(): Promise<void> {
      employees.clear();
      schedules.clear();
      attendance.clear();
      leaveRequests.clear();
    },
  };
}

// ============ ARBITRARIES ============

const hrEventTypeArb = fc.constantFrom<HREventType>(
  'EMPLOYEE_CREATED', 'EMPLOYEE_PROFILE_UPDATED', 'EMPLOYEE_DEACTIVATED',
  'ATTENDANCE_CLOCKED_IN', 'ATTENDANCE_CLOCKED_OUT', 'ATTENDANCE_ABSENCE_DETECTED', 'ATTENDANCE_JUSTIFIED',
  'LEAVE_REQUEST_CREATED', 'LEAVE_REQUEST_APPROVED', 'LEAVE_REQUEST_REJECTED',
  'ADVANCE_REQUESTED', 'ADVANCE_APPROVED',
  'PAYROLL_CALCULATED', 'EVALUATION_CREATED', 'TRAINING_COMPLETED'
);

const pendingHREventArb = fc.record({
  eventId: fc.uuid(),
  type: hrEventTypeArb,
  tenantId: fc.uuid(),
  employeeId: fc.uuid(),
  actorId: fc.uuid(),
  createdAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
  syncStatus: fc.constant<SyncStatus>('pending'),
  retryCount: fc.constant(0),
  payload: fc.record({
    action: fc.string({ minLength: 1, maxLength: 30 }),
    data: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.oneof(fc.string({ maxLength: 50 }), fc.integer({ min: 0, max: 999999 }))
    ),
  }),
});

const cachedEmployeeArb = fc.record({
  id: fc.uuid(),
  tenantId: fc.uuid(),
  name: fc.string({ minLength: 2, maxLength: 50 }),
  role: fc.constantFrom('CASHIER', 'WAITER', 'COOK', 'ADMIN'),
  isActive: fc.boolean(),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
});

const cachedScheduleArb = fc.record({
  id: fc.uuid(),
  tenantId: fc.uuid(),
  employeeId: fc.uuid(),
  dayOfWeek: fc.integer({ min: 0, max: 6 }),
  startTime: fc.constantFrom('06:00', '08:00', '10:00', '14:00', '18:00'),
  endTime: fc.constantFrom('14:00', '16:00', '18:00', '22:00', '23:00'),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
});

const cachedAttendanceArb = fc.record({
  id: fc.uuid(),
  tenantId: fc.uuid(),
  employeeId: fc.uuid(),
  date: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString().slice(0, 10)),
  clockIn: fc.option(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    { nil: undefined }
  ),
  clockOut: fc.option(
    fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
      .filter(d => !isNaN(d.getTime()))
      .map(d => d.toISOString()),
    { nil: undefined }
  ),
  status: fc.constantFrom('PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED'),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
});

const cachedLeaveRequestArb = fc.record({
  id: fc.uuid(),
  tenantId: fc.uuid(),
  employeeId: fc.uuid(),
  leaveType: fc.constantFrom('VACATION', 'PERSONAL', 'MEDICAL'),
  startDate: fc.constant('2025-03-01'),
  endDate: fc.constant('2025-03-05'),
  daysRequested: fc.integer({ min: 1, max: 30 }),
  status: fc.constantFrom('PENDING', 'APPROVED', 'REJECTED'),
  updatedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
    .filter(d => !isNaN(d.getTime()))
    .map(d => d.toISOString()),
});

// ============ PROPERTY TESTS ============

describe('Property 61: Eventos offline se almacenan localmente', () => {
  it('should store any valid HR event in IndexedDB', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        async (event) => {
          const db = createMockHRDB();
          const id = await db.addPendingEvent(event);

          expect(id).toBeGreaterThan(0);

          const stored = await db.getEventById(event.eventId);
          expect(stored).toBeDefined();
          expect(stored?.eventId).toBe(event.eventId);
          expect(stored?.type).toBe(event.type);
          expect(stored?.tenantId).toBe(event.tenantId);
          expect(stored?.employeeId).toBe(event.employeeId);
          expect(stored?.payload).toEqual(event.payload);
          expect(stored?.syncStatus).toBe('pending');
          expect(stored?.retryCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should deduplicate events with same eventId', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        async (event) => {
          const db = createMockHRDB();
          const id1 = await db.addPendingEvent(event);
          const id2 = await db.addPendingEvent(event);

          expect(id1).toBe(id2);

          const allEvents = await db.getAllEvents();
          const matching = allEvents.filter(e => e.eventId === event.eventId);
          expect(matching.length).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should support all 15 HR event types', () => {
    fc.assert(
      fc.asyncProperty(
        hrEventTypeArb,
        async (type) => {
          const db = createMockHRDB();
          const event = {
            eventId: `test-${type}-${Date.now()}`,
            type,
            tenantId: 'tenant-1',
            employeeId: 'emp-1',
            actorId: 'actor-1',
            createdAt: new Date().toISOString(),
            syncStatus: 'pending' as SyncStatus,
            retryCount: 0,
            payload: { type },
          };
          const id = await db.addPendingEvent(event);
          expect(id).toBeGreaterThan(0);
          const stored = await db.getEventById(event.eventId);
          expect(stored?.type).toBe(type);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 62: Sincronización envía todos los eventos', () => {
  it('should return pending events in chronological order', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(pendingHREventArb, { minLength: 2, maxLength: 20 }),
        async (events) => {
          const db = createMockHRDB();
          for (const event of events) {
            await db.addPendingEvent(event);
          }

          const pending = await db.getPendingEvents();

          for (let i = 1; i < pending.length; i++) {
            expect(pending[i].createdAt >= pending[i - 1].createdAt).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly track sync status transitions', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        async (event) => {
          const db = createMockHRDB();
          await db.addPendingEvent(event);

          let stored = await db.getEventById(event.eventId);
          expect(stored?.syncStatus).toBe('pending');

          await db.updateEventStatus(event.eventId, 'syncing');
          stored = await db.getEventById(event.eventId);
          expect(stored?.syncStatus).toBe('syncing');

          await db.markAsSynced(event.eventId);
          stored = await db.getEventById(event.eventId);
          expect(stored?.syncStatus).toBe('synced');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cleanup synced events correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(pendingHREventArb, { minLength: 5, maxLength: 20 }),
        fc.integer({ min: 1, max: 5 }),
        async (events, syncCount) => {
          const db = createMockHRDB();
          const uniqueEvents = events.filter((e, i, arr) =>
            arr.findIndex(x => x.eventId === e.eventId) === i
          );

          for (const event of uniqueEvents) {
            await db.addPendingEvent(event);
          }

          const toSync = Math.min(syncCount, uniqueEvents.length);
          for (let i = 0; i < toSync; i++) {
            await db.markAsSynced(uniqueEvents[i].eventId);
          }

          const cleaned = await db.cleanupSyncedEvents();
          expect(cleaned).toBe(toSync);

          const remaining = await db.getAllEvents();
          expect(remaining.length).toBe(uniqueEvents.length - toSync);
          expect(remaining.filter(e => e.syncStatus === 'synced').length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should count pending events accurately', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(pendingHREventArb, { minLength: 1, maxLength: 20 }),
        async (events) => {
          const db = createMockHRDB();
          const uniqueEvents = events.filter((e, i, arr) =>
            arr.findIndex(x => x.eventId === e.eventId) === i
          );

          for (const event of uniqueEvents) {
            await db.addPendingEvent(event);
          }

          const count = await db.getPendingCount();
          expect(count).toBe(uniqueEvents.length);

          const halfCount = Math.floor(uniqueEvents.length / 2);
          for (let i = 0; i < halfCount; i++) {
            await db.markAsSynced(uniqueEvents[i].eventId);
          }

          const newCount = await db.getPendingCount();
          expect(newCount).toBe(uniqueEvents.length - halfCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 63: Lectura offline desde caché', () => {
  it('should cache and retrieve employees by tenant', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(cachedEmployeeArb, { minLength: 1, maxLength: 10 }),
        async (tenantId, emps) => {
          const db = createMockHRDB();
          const tenantEmps = emps.map(e => ({ ...e, tenantId }));

          await db.cacheEmployees(tenantEmps);
          const cached = await db.getCachedEmployees(tenantId);

          const expectedActive = tenantEmps.filter(e => e.isActive);
          expect(cached.length).toBe(expectedActive.length);

          for (const emp of cached) {
            expect(emp.tenantId).toBe(tenantId);
            expect(emp.isActive).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should cache and retrieve employee by id', () => {
    fc.assert(
      fc.asyncProperty(
        cachedEmployeeArb,
        async (emp) => {
          const db = createMockHRDB();
          await db.cacheEmployees([emp]);

          const cached = await db.getCachedEmployeeById(emp.id);
          expect(cached).toBeDefined();
          expect(cached?.id).toBe(emp.id);
          expect(cached?.name).toBe(emp.name);
          expect(cached?.role).toBe(emp.role);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should cache and retrieve schedules by tenant+employee', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(cachedScheduleArb, { minLength: 1, maxLength: 7 }),
        async (tenantId, employeeId, scheds) => {
          const db = createMockHRDB();
          const targetScheds = scheds.map(s => ({ ...s, tenantId, employeeId }));

          await db.cacheSchedules(targetScheds);
          const cached = await db.getCachedSchedules(tenantId, employeeId);

          // Deduplicate by id
          const uniqueIds = new Set(targetScheds.map(s => s.id));
          expect(cached.length).toBe(uniqueIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should cache and retrieve attendance sorted by date', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(cachedAttendanceArb, { minLength: 2, maxLength: 10 }),
        async (tenantId, employeeId, records) => {
          const db = createMockHRDB();
          const targetRecords = records.map(r => ({ ...r, tenantId, employeeId }));

          await db.cacheAttendance(targetRecords);
          const cached = await db.getCachedAttendance(tenantId, employeeId);

          // Verify sorted by date
          for (let i = 1; i < cached.length; i++) {
            expect(cached[i].date >= cached[i - 1].date).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should cache and retrieve leave requests by tenant+employee', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(cachedLeaveRequestArb, { minLength: 1, maxLength: 5 }),
        async (tenantId, employeeId, reqs) => {
          const db = createMockHRDB();
          const targetReqs = reqs.map(r => ({ ...r, tenantId, employeeId }));

          await db.cacheLeaveRequests(targetReqs);
          const cached = await db.getCachedLeaveRequests(tenantId, employeeId);

          const uniqueIds = new Set(targetReqs.map(r => r.id));
          expect(cached.length).toBe(uniqueIds.size);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 64: Solicitudes offline se sincronizan', () => {
  it('should increment retry count and track errors', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 4 }),
        async (event, errors) => {
          const db = createMockHRDB();
          await db.addPendingEvent(event);

          for (let i = 0; i < errors.length; i++) {
            await db.incrementRetry(event.eventId, errors[i]);
            const stored = await db.getEventById(event.eventId);
            expect(stored?.retryCount).toBe(i + 1);
            expect(stored?.lastError).toBe(errors[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark event as failed after max retries', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        async (event) => {
          const db = createMockHRDB();
          await db.addPendingEvent(event);

          for (let i = 0; i < MAX_RETRIES; i++) {
            await db.incrementRetry(event.eventId, `Error ${i + 1}`);
          }

          const stored = await db.getEventById(event.eventId);
          expect(stored?.syncStatus).toBe('failed');
          expect(stored?.retryCount).toBe(MAX_RETRIES);

          // Should not appear in pending events
          const pending = await db.getPendingEvents();
          expect(pending.find(e => e.eventId === event.eventId)).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cleanup failed events beyond max retries', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(pendingHREventArb, { minLength: 3, maxLength: 10 }),
        async (events) => {
          const db = createMockHRDB();
          const uniqueEvents = events.filter((e, i, arr) =>
            arr.findIndex(x => x.eventId === e.eventId) === i
          );

          for (const event of uniqueEvents) {
            await db.addPendingEvent(event);
          }

          // Fail first event beyond max retries
          if (uniqueEvents.length > 0) {
            for (let i = 0; i < MAX_RETRIES; i++) {
              await db.incrementRetry(uniqueEvents[0].eventId, `Error ${i}`);
            }

            const cleaned = await db.cleanupFailedEvents();
            expect(cleaned).toBe(1);

            const remaining = await db.getAllEvents();
            expect(remaining.length).toBe(uniqueEvents.length - 1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve payload data through round-trip', () => {
    fc.assert(
      fc.asyncProperty(
        pendingHREventArb,
        async (event) => {
          const db = createMockHRDB();
          await db.addPendingEvent(event);

          const stored = await db.getEventById(event.eventId);
          expect(stored?.payload).toEqual(event.payload);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 65: Resolución de conflictos', () => {
  it('should handle concurrent add operations', async () => {
    const db = createMockHRDB();
    const events = Array.from({ length: 10 }, (_, i) => ({
      eventId: `hr-event-${i}-${Date.now()}`,
      type: 'ATTENDANCE_CLOCKED_IN' as HREventType,
      tenantId: 'tenant-1',
      employeeId: `emp-${i}`,
      actorId: 'actor-1',
      createdAt: new Date().toISOString(),
      syncStatus: 'pending' as SyncStatus,
      retryCount: 0,
      payload: { employee: `emp-${i}` },
    }));

    await Promise.all(events.map(e => db.addPendingEvent(e)));

    const allEvents = await db.getAllEvents();
    expect(allEvents.length).toBe(10);
  });

  it('should handle concurrent status updates', async () => {
    const db = createMockHRDB();
    const events = Array.from({ length: 5 }, (_, i) => ({
      eventId: `conflict-${i}-${Date.now()}`,
      type: 'LEAVE_REQUEST_CREATED' as HREventType,
      tenantId: 'tenant-1',
      employeeId: `emp-${i}`,
      actorId: 'actor-1',
      createdAt: new Date().toISOString(),
      syncStatus: 'pending' as SyncStatus,
      retryCount: 0,
      payload: {},
    }));

    for (const e of events) await db.addPendingEvent(e);

    // Concurrent operations
    await Promise.all([
      db.markAsSynced(events[0].eventId),
      db.markAsSynced(events[1].eventId),
      db.incrementRetry(events[2].eventId, 'Server error'),
      db.updateEventStatus(events[3].eventId, 'syncing'),
    ]);

    const e0 = await db.getEventById(events[0].eventId);
    expect(e0?.syncStatus).toBe('synced');

    const e1 = await db.getEventById(events[1].eventId);
    expect(e1?.syncStatus).toBe('synced');

    const e2 = await db.getEventById(events[2].eventId);
    expect(e2?.retryCount).toBe(1);

    const e3 = await db.getEventById(events[3].eventId);
    expect(e3?.syncStatus).toBe('syncing');

    const e4 = await db.getEventById(events[4].eventId);
    expect(e4?.syncStatus).toBe('pending');

    const pending = await db.getPendingEvents();
    // 2 synced, 1 syncing (not in pending), 1 pending with retry, 1 pending
    expect(pending.length).toBe(2);
  });

  it('should isolate cache data between tenants', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(cachedEmployeeArb, { minLength: 2, maxLength: 5 }),
        async (tenant1, tenant2, emps) => {
          const db = createMockHRDB();

          const tenant1Emps = emps.slice(0, Math.ceil(emps.length / 2)).map(e => ({
            ...e,
            tenantId: tenant1,
            isActive: true,
          }));
          const tenant2Emps = emps.slice(Math.ceil(emps.length / 2)).map(e => ({
            ...e,
            tenantId: tenant2,
            isActive: true,
          }));

          await db.cacheEmployees([...tenant1Emps, ...tenant2Emps]);

          const cached1 = await db.getCachedEmployees(tenant1);
          const cached2 = await db.getCachedEmployees(tenant2);

          // Each tenant only sees their employees
          for (const e of cached1) expect(e.tenantId).toBe(tenant1);
          for (const e of cached2) expect(e.tenantId).toBe(tenant2);

          // Counts are correct
          const unique1 = new Set(tenant1Emps.map(e => e.id));
          const unique2 = new Set(tenant2Emps.map(e => e.id));
          expect(cached1.length).toBe(unique1.size);
          expect(cached2.length).toBe(unique2.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should clear all data when clearAllCaches is called', () => {
    fc.assert(
      fc.asyncProperty(
        cachedEmployeeArb,
        cachedScheduleArb,
        async (emp, sched) => {
          const db = createMockHRDB();
          await db.cacheEmployees([emp]);
          await db.cacheSchedules([sched]);

          await db.clearAllCaches();

          const emps = await db.getCachedEmployees(emp.tenantId);
          const scheds = await db.getCachedSchedules(sched.tenantId, sched.employeeId);
          expect(emps.length).toBe(0);
          expect(scheds.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
