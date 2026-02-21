/**
 * HR Offline Database (Dexie/IndexedDB)
 * Fase 9 - Soporte Offline para RRHH
 *
 * Schema para eventos de RRHH pendientes de sincronización.
 * Soporta:
 * - Guardar eventos cuando no hay conexión
 * - Sync automático cuando vuelve conexión
 * - Retry con backoff exponencial
 * - Deduplicación por event_id
 * - Cache de datos para lectura offline
 */

import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/src/core/observability/logger';

// ============ TYPES ============

export type HREventType =
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

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface PendingHREvent {
  id?: number; // auto-increment
  eventId: string; // UUID - unique identifier (deduplication key)
  type: HREventType;
  tenantId: string;
  employeeId: string;
  actorId: string;
  createdAt: string; // ISO 8601
  syncStatus: SyncStatus;
  retryCount: number;
  lastError?: string;
  payload: unknown; // Event-specific data
}

/** Cached employee for offline read */
export interface CachedEmployee {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  isActive: boolean;
  updatedAt: string;
}

/** Cached schedule for offline read */
export interface CachedSchedule {
  id: string;
  tenantId: string;
  employeeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  updatedAt: string;
}

/** Cached attendance for offline read */
export interface CachedAttendance {
  id: string;
  tenantId: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: string;
  updatedAt: string;
}

/** Cached leave request for offline read */
export interface CachedLeaveRequest {
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

// ============ DATABASE CLASS ============

const DB_NAME = 'HROfflineDB';
const MAX_RETRIES = 5;

class HROfflineDB extends Dexie {
  pendingEvents!: EntityTable<PendingHREvent, 'id'>;
  employees!: EntityTable<CachedEmployee, 'id'>;
  schedules!: EntityTable<CachedSchedule, 'id'>;
  attendance!: EntityTable<CachedAttendance, 'id'>;
  leaveRequests!: EntityTable<CachedLeaveRequest, 'id'>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      pendingEvents: '++id, &eventId, type, syncStatus, createdAt, retryCount, [tenantId+employeeId]',
      employees: 'id, tenantId, [tenantId+isActive], name',
      schedules: 'id, [tenantId+employeeId], dayOfWeek',
      attendance: 'id, [tenantId+employeeId], [tenantId+date], date',
      leaveRequests: 'id, [tenantId+employeeId], [tenantId+status], status',
    });
  }

  // ============ PENDING EVENTS ============

  async addPendingEvent(event: Omit<PendingHREvent, 'id'>): Promise<number> {
    const existing = await this.pendingEvents
      .where('eventId')
      .equals(event.eventId)
      .first();

    if (existing) {
      logger.debug('HR_OFFLINE_EVENT_EXISTS', 'Event already exists, skipping', { eventId: event.eventId });
      return existing.id!;
    }

    const id = await this.pendingEvents.add(event as PendingHREvent);
    logger.debug('HR_OFFLINE_EVENT_ADDED', 'Added pending HR event', { eventId: event.eventId, type: event.type, id });
    return id ?? 0;
  }

  async getPendingEvents(): Promise<PendingHREvent[]> {
    return this.pendingEvents
      .where('syncStatus')
      .anyOf(['pending', 'failed'])
      .and(event => event.retryCount < MAX_RETRIES)
      .sortBy('createdAt');
  }

  async getPendingCount(): Promise<number> {
    return this.pendingEvents
      .where('syncStatus')
      .anyOf(['pending', 'syncing', 'failed'])
      .and(event => event.retryCount < MAX_RETRIES)
      .count();
  }

  async updateEventStatus(eventId: string, status: SyncStatus): Promise<void> {
    await this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .modify({ syncStatus: status });
  }

  async incrementRetry(eventId: string, error: string): Promise<void> {
    const event = await this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .first();

    if (event) {
      const newRetryCount = event.retryCount + 1;
      await this.pendingEvents
        .where('eventId')
        .equals(eventId)
        .modify({
          retryCount: newRetryCount,
          lastError: error,
          syncStatus: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
        });
    }
  }

  async markAsSynced(eventId: string): Promise<void> {
    await this.updateEventStatus(eventId, 'synced');
  }

  async getEventById(eventId: string): Promise<PendingHREvent | undefined> {
    return this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .first();
  }

  async cleanupSyncedEvents(): Promise<number> {
    const count = await this.pendingEvents
      .where('syncStatus')
      .equals('synced')
      .delete();

    if (count > 0) {
      logger.info('HR_OFFLINE_CLEANUP_SYNCED', 'Cleaned up synced HR events', { count });
    }
    return count;
  }

  async cleanupFailedEvents(): Promise<number> {
    const count = await this.pendingEvents
      .where('syncStatus')
      .equals('failed')
      .and(event => event.retryCount >= MAX_RETRIES)
      .delete();

    if (count > 0) {
      logger.info('HR_OFFLINE_CLEANUP_FAILED', 'Cleaned up permanently failed HR events', { count });
    }
    return count;
  }

  async getAllEvents(): Promise<PendingHREvent[]> {
    return this.pendingEvents.toArray();
  }

  async clearAllEvents(): Promise<void> {
    await this.pendingEvents.clear();
    logger.info('HR_OFFLINE_EVENTS_CLEARED', 'All HR events cleared');
  }

  // ============ EMPLOYEE CACHE ============

  async cacheEmployees(employees: CachedEmployee[]): Promise<void> {
    await this.employees.bulkPut(employees);
  }

  async getCachedEmployees(tenantId: string): Promise<CachedEmployee[]> {
    return this.employees
      .where('[tenantId+isActive]')
      .equals([tenantId, 1 as any]) // Dexie stores booleans as 0/1
      .toArray();
  }

  async getCachedEmployeeById(id: string): Promise<CachedEmployee | undefined> {
    return this.employees.get(id);
  }

  // ============ SCHEDULE CACHE ============

  async cacheSchedules(schedules: CachedSchedule[]): Promise<void> {
    await this.schedules.bulkPut(schedules);
  }

  async getCachedSchedules(tenantId: string, employeeId: string): Promise<CachedSchedule[]> {
    return this.schedules
      .where('[tenantId+employeeId]')
      .equals([tenantId, employeeId])
      .toArray();
  }

  // ============ ATTENDANCE CACHE ============

  async cacheAttendance(records: CachedAttendance[]): Promise<void> {
    await this.attendance.bulkPut(records);
  }

  async getCachedAttendance(tenantId: string, employeeId: string): Promise<CachedAttendance[]> {
    return this.attendance
      .where('[tenantId+employeeId]')
      .equals([tenantId, employeeId])
      .sortBy('date');
  }

  async getCachedAttendanceByDate(tenantId: string, date: string): Promise<CachedAttendance[]> {
    return this.attendance
      .where('[tenantId+date]')
      .equals([tenantId, date])
      .toArray();
  }

  // ============ LEAVE REQUEST CACHE ============

  async cacheLeaveRequests(requests: CachedLeaveRequest[]): Promise<void> {
    await this.leaveRequests.bulkPut(requests);
  }

  async getCachedLeaveRequests(tenantId: string, employeeId: string): Promise<CachedLeaveRequest[]> {
    return this.leaveRequests
      .where('[tenantId+employeeId]')
      .equals([tenantId, employeeId])
      .toArray();
  }

  // ============ FULL CACHE CLEAR ============

  async clearAllCaches(): Promise<void> {
    await Promise.all([
      this.employees.clear(),
      this.schedules.clear(),
      this.attendance.clear(),
      this.leaveRequests.clear(),
    ]);
    logger.info('HR_OFFLINE_CACHES_CLEARED', 'All HR caches cleared');
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.clearAllEvents(),
      this.clearAllCaches(),
    ]);
  }
}

// ============ SINGLETON ============

let _instance: HROfflineDB | null = null;

function getInstance(): HROfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('HROfflineDB can only be used on the client side');
  }
  if (!_instance) {
    _instance = new HROfflineDB();
  }
  return _instance;
}

// Export proxy for lazy initialization (SSR-safe)
export const hrOfflineDb = new Proxy({} as HROfflineDB, {
  get(_, prop) {
    const instance = getInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// SSR-safe getter
export function getHrOfflineDb(): HROfflineDB | null {
  if (typeof window === 'undefined') return null;
  return getInstance();
}

// Export class for testing
export { HROfflineDB };
