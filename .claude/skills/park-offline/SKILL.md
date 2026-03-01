---
name: park-offline
description: >
  PARK POS offline-first: Dexie/IndexedDB, SyncClient, saga queue, outbox.
  Trigger: When working with sync, offline, Dexie, IndexedDB, or connectivity.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## Dexie ParkDB Schema

File: `src/core/db/schema.ts` — 8 tables, 7 schema versions

```typescript
export class ParkDB extends Dexie {
  events!: EntityTable<EventEntity, 'id'>;         // local event log
  sync_state!: EntityTable<SyncStateEntity, 'id'>; // sync progress
  catalog_versions!: EntityTable<CatalogVersionEntity, any>;
  catalog_items!: EntityTable<CatalogItemEntity, 'id'>;
  projections!: EntityTable<ProjectionEntity, 'key'>;
  snapshots!: EntityTable<SnapshotEntity, 'id'>;
  saga_logs!: EntityTable<SagaLogEntity, 'saga_id'>;
  offline_saga_events!: EntityTable<OfflineSagaEventEntity, 'event_id'>;
}
```

**EventEntity** (local Dexie):
```typescript
interface EventEntity {
  id?: number;               // auto-increment (local ordering)
  tenant_id: string;
  terminal_id: string;
  terminal_sequence: number;
  event_id: string;          // UUID (dedup key)
  event_type: string;
  synced: number;            // 0 = pending, 1 = synced
  payload: any;
  // ... all BaseEnvelope fields
}
```

## SSR-Safe Singleton

```typescript
// Proxy pattern — safe on server (no window), lazy on client
export const db = new Proxy({} as ParkDB, {
  get(_, prop) {
    const instance = getDbInstance(); // throws if typeof window === 'undefined'
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// Safe check for SSR
export function getDb(): ParkDB | null {
  if (typeof window === 'undefined') return null;
  return getDbInstance();
}
```

## SyncClient

File: `src/core/sync/client.ts`

Key features:
- **Exponential backoff**: `minMs * 2^attempt` capped at `maxMs`, with jitter
- **Max 5 retries** per event batch
- **Circuit breaker**: wraps HTTP calls to `/api/events/ingest`
- **Zod validation** before send (optional `validateWithZodBeforeSend`)
- **After sync**: marks events `synced: 1` in Dexie, updates `last_terminal_sequence_acked`

```typescript
// Trigger sync after any POSAction
getSyncClient().start();

// IngestResponse tracks:
{ deduped_event_ids: [], rejected: [], merged: [] }
```

## OfflineSagaEventQueue

File: `src/core/saga/offline.ts`

```typescript
export class OfflineSagaEventQueue {
  async queueEvent(sagaId, tenantId, event: ParkEvent): Promise<void>
  async getQueuedEvents(tenantId): Promise<OfflineSagaEventEntity[]>
  async markSynced(eventId): Promise<void>
  async recordSyncFailure(eventId, error): Promise<void>
}
```

Query pattern for compound index:
```typescript
(db.offline_saga_events.where('[tenant_id+synced]') as any)
  .equals([tenantId, false])
  .toArray();
```

## Outbox Pattern

Events go to `event_outbox` table in the same transaction as the projection update:
```typescript
await tx.event_outbox.create({
  data: { event_id, tenant_id, event_type, payload, created_at: new Date() }
});
// Separate process publishes from outbox and marks as sent
```

## Sync Flow

```
[Client: Dexie] → appendEvent(synced: 0) → SyncClient.start()
  → POST /api/events/ingest { events: [...] }
    → [Server: Prisma $transaction]
      → dedup → validate → project → outbox
    → Response: { accepted, deduped_event_ids }
  → mark synced: 1 in Dexie
  → update sync_state.last_terminal_sequence_acked
```

## Anti-Patterns

- Accessing `db.*` on server side → crashes (no IndexedDB)
- Using `getDb()` without null check → use `if (typeof window === 'undefined') return`
- Dexie compound key without `as any` → TypeScript complains
- Deleting events from Dexie after sync → keep for offline replay
- Syncing without circuit breaker → hammers server on network issues
