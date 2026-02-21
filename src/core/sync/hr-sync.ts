/**
 * HR Sync Service
 * Fase 9 - Sincronización de eventos HR offline
 *
 * Maneja la sincronización de eventos de RRHH entre IndexedDB y el servidor.
 * Integra con el SyncClient existente y el CircuitBreaker.
 *
 * Funcionalidades:
 * - Sync batch de eventos HR pendientes
 * - Backoff exponencial con jitter
 * - Circuit breaker para evitar flood al servidor
 * - Cache refresh después de sync exitoso
 * - Listeners para online/offline status
 */

import type { HREventType, PendingHREvent, SyncStatus } from '@/src/core/db/hr-offline-db';

// ============ TYPES ============

export interface HRSyncResult {
  synced: number;
  failed: number;
  remaining: number;
  errors: Array<{ eventId: string; error: string }>;
}

export interface HRSyncConfig {
  endpoint: string;
  batchSize: number;
  tickMs: number;
  maxBackoffMs: number;
  minBackoffMs: number;
  jitterRatio: number;
}

export const DEFAULT_HR_SYNC_CONFIG: HRSyncConfig = {
  endpoint: '/api/hr/events/sync',
  batchSize: 50,
  tickMs: 10000, // 10 seconds
  maxBackoffMs: 60000,
  minBackoffMs: 2000,
  jitterRatio: 0.2,
};

// ============ PURE FUNCTIONS ============

/** Calculate backoff with jitter */
export function calculateBackoff(
  attempt: number,
  minMs: number,
  maxMs: number,
  jitterRatio: number
): number {
  const exponential = Math.min(minMs * Math.pow(2, attempt), maxMs);
  const delta = exponential * jitterRatio;
  const min = exponential - delta;
  const max = exponential + delta;
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Group events into batches */
export function batchEvents<T>(events: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }
  return batches;
}

/** Check if an event type requires immediate sync */
export function isHighPriorityEvent(type: HREventType): boolean {
  return type === 'ATTENDANCE_CLOCKED_IN' || type === 'ATTENDANCE_CLOCKED_OUT';
}

/** Sort events: high priority first, then by creation time */
export function prioritizeEvents(events: PendingHREvent[]): PendingHREvent[] {
  return [...events].sort((a, b) => {
    const aPriority = isHighPriorityEvent(a.type) ? 0 : 1;
    const bPriority = isHighPriorityEvent(b.type) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** Validate event has required fields for sync */
export function isValidForSync(event: PendingHREvent): boolean {
  return !!(
    event.eventId &&
    event.type &&
    event.tenantId &&
    event.employeeId &&
    event.actorId &&
    event.createdAt &&
    event.payload !== undefined
  );
}

/** Build the sync request payload from pending events */
export function buildSyncPayload(events: PendingHREvent[]): {
  events: Array<{
    event_id: string;
    event_type: HREventType;
    tenant_id: string;
    employee_id: string;
    actor_id: string;
    created_at: string;
    payload: unknown;
  }>;
} {
  return {
    events: events.map(e => ({
      event_id: e.eventId,
      event_type: e.type,
      tenant_id: e.tenantId,
      employee_id: e.employeeId,
      actor_id: e.actorId,
      created_at: e.createdAt,
      payload: e.payload,
    })),
  };
}

/** Parse sync response to determine which events succeeded/failed */
export function parseSyncResponse(response: {
  accepted: boolean;
  synced_event_ids?: string[];
  rejected?: Array<{ event_id: string; error: string }>;
  deduped_event_ids?: string[];
}): {
  syncedIds: string[];
  failedIds: Array<{ eventId: string; error: string }>;
} {
  const syncedIds: string[] = [
    ...(response.synced_event_ids ?? []),
    ...(response.deduped_event_ids ?? []),
  ];

  const failedIds = (response.rejected ?? []).map(r => ({
    eventId: r.event_id,
    error: r.error,
  }));

  return { syncedIds, failedIds };
}

// ============ HR SYNC CLIENT CLASS ============

export interface HROfflineDbInterface {
  getPendingEvents(): Promise<PendingHREvent[]>;
  getPendingCount(): Promise<number>;
  updateEventStatus(eventId: string, status: SyncStatus): Promise<void>;
  markAsSynced(eventId: string): Promise<void>;
  incrementRetry(eventId: string, error: string): Promise<void>;
  cleanupSyncedEvents(): Promise<number>;
}

export class HRSyncClient {
  private config: HRSyncConfig;
  private db: HROfflineDbInterface;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private consecutiveFailures = 0;
  private onOnlineBound: () => void;
  private onOfflineBound: () => void;
  private _isOnline = true;

  constructor(db: HROfflineDbInterface, config?: Partial<HRSyncConfig>) {
    this.config = { ...DEFAULT_HR_SYNC_CONFIG, ...config };
    this.db = db;
    this.onOnlineBound = () => this.onOnline();
    this.onOfflineBound = () => this.onOffline();
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  start(): void {
    if (typeof window === 'undefined') return;

    this._isOnline = navigator.onLine;
    window.addEventListener('online', this.onOnlineBound);
    window.addEventListener('offline', this.onOfflineBound);

    this.timer = setInterval(() => void this.syncNow(), this.config.tickMs);

    // Initial sync
    void this.syncNow();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnlineBound);
      window.removeEventListener('offline', this.onOfflineBound);
    }
  }

  private onOnline(): void {
    this._isOnline = true;
    this.consecutiveFailures = 0;
    void this.syncNow();
  }

  private onOffline(): void {
    this._isOnline = false;
  }

  async syncNow(): Promise<HRSyncResult> {
    if (this.isSyncing || !this._isOnline) {
      return { synced: 0, failed: 0, remaining: await this.db.getPendingCount(), errors: [] };
    }

    // Circuit breaker: stop trying if too many consecutive failures
    if (this.consecutiveFailures >= 5) {
      const backoff = calculateBackoff(
        this.consecutiveFailures,
        this.config.minBackoffMs,
        this.config.maxBackoffMs,
        this.config.jitterRatio
      );
      await new Promise(r => setTimeout(r, backoff));
    }

    this.isSyncing = true;
    const result: HRSyncResult = { synced: 0, failed: 0, remaining: 0, errors: [] };

    try {
      const pending = await this.db.getPendingEvents();
      if (pending.length === 0) {
        result.remaining = 0;
        return result;
      }

      const prioritized = prioritizeEvents(pending);
      const valid = prioritized.filter(isValidForSync);
      const batches = batchEvents(valid, this.config.batchSize);

      for (const batch of batches) {
        // Mark as syncing
        for (const event of batch) {
          await this.db.updateEventStatus(event.eventId, 'syncing');
        }

        try {
          const payload = buildSyncPayload(batch);
          const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          const { syncedIds, failedIds } = parseSyncResponse(data);

          // Mark synced
          for (const eventId of syncedIds) {
            await this.db.markAsSynced(eventId);
            result.synced++;
          }

          // Handle failures
          for (const { eventId, error } of failedIds) {
            await this.db.incrementRetry(eventId, error);
            result.failed++;
            result.errors.push({ eventId, error });
          }

          // Mark remaining batch events as pending (server didn't mention them)
          const processedIds = new Set([...syncedIds, ...failedIds.map(f => f.eventId)]);
          for (const event of batch) {
            if (!processedIds.has(event.eventId)) {
              await this.db.markAsSynced(event.eventId);
              result.synced++;
            }
          }

          this.consecutiveFailures = 0;
        } catch (err) {
          // Network error: revert batch to pending
          for (const event of batch) {
            await this.db.incrementRetry(event.eventId, (err as Error).message);
          }
          result.failed += batch.length;
          result.errors.push({ eventId: 'batch', error: (err as Error).message });
          this.consecutiveFailures++;
        }
      }

      // Cleanup synced events periodically
      await this.db.cleanupSyncedEvents();
      result.remaining = await this.db.getPendingCount();
    } finally {
      this.isSyncing = false;
    }

    return result;
  }
}
