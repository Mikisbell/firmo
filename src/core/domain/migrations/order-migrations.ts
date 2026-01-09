// src/core/domain/migrations/order-migrations.ts
// Migration definitions for ORDER events

import type { EventMigration } from '../event-migrator';

/**
 * ORDER_CREATED migrations.
 * 
 * V1 → V2: Added delivery fields with defaults
 */
export const ORDER_CREATED_MIGRATIONS: EventMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (payload: any) => ({
      ...payload,
      // V2 adds explicit delivery fields (already optional in schema)
      delivery: payload.delivery ?? null,
      fulfillment: payload.fulfillment ?? null,
      promotion_id: payload.promotion_id ?? null,
    }),
  },
];

/**
 * ORDER_ITEM_ADDED migrations.
 * 
 * V1 → V2: Added timestamps to line items
 */
export const ORDER_ITEM_ADDED_MIGRATIONS: EventMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    migrate: (payload: any) => ({
      ...payload,
      line: {
        ...payload.line,
        // V2 adds timestamps for item lifecycle tracking
        created_at: payload.line.created_at ?? null,
        started_cooking_at: payload.line.started_cooking_at ?? null,
        ready_at: payload.line.ready_at ?? null,
        served_at: payload.line.served_at ?? null,
      },
    }),
  },
];

/**
 * ORDER_ITEM_QTY_CHANGED migrations.
 * Currently at V1, no migrations needed.
 */
export const ORDER_ITEM_QTY_CHANGED_MIGRATIONS: EventMigration[] = [];

/**
 * ORDER_ITEM_STATUS_CHANGED migrations.
 * Currently at V1, no migrations needed.
 */
export const ORDER_ITEM_STATUS_CHANGED_MIGRATIONS: EventMigration[] = [];

/**
 * ORDER_ITEM_VOIDED migrations.
 * Currently at V1, no migrations needed.
 */
export const ORDER_ITEM_VOIDED_MIGRATIONS: EventMigration[] = [];

/**
 * ORDER_CANCELLED migrations.
 * Currently at V1, no migrations needed.
 */
export const ORDER_CANCELLED_MIGRATIONS: EventMigration[] = [];
