// src/core/domain/migrations/index.ts
// Migration Registry - registers all migrations with EventMigrator

import { logger } from '@/src/core/observability/logger';
import { eventMigrator } from '../event-migrator';
import { getCurrentVersion } from '../event-versions';
import {
  ORDER_CREATED_MIGRATIONS,
  ORDER_ITEM_ADDED_MIGRATIONS,
  ORDER_ITEM_QTY_CHANGED_MIGRATIONS,
  ORDER_ITEM_STATUS_CHANGED_MIGRATIONS,
  ORDER_ITEM_VOIDED_MIGRATIONS,
  ORDER_CANCELLED_MIGRATIONS,
} from './order-migrations';

/**
 * Register all migrations with the EventMigrator.
 * Call this once at application startup.
 */
export function registerAllMigrations(): void {
  // ORDER events
  eventMigrator.register({
    eventType: 'ORDER_CREATED',
    currentVersion: getCurrentVersion('ORDER_CREATED'),
    migrations: ORDER_CREATED_MIGRATIONS,
  });

  eventMigrator.register({
    eventType: 'ORDER_ITEM_ADDED',
    currentVersion: getCurrentVersion('ORDER_ITEM_ADDED'),
    migrations: ORDER_ITEM_ADDED_MIGRATIONS,
  });

  eventMigrator.register({
    eventType: 'ORDER_ITEM_QTY_CHANGED',
    currentVersion: getCurrentVersion('ORDER_ITEM_QTY_CHANGED'),
    migrations: ORDER_ITEM_QTY_CHANGED_MIGRATIONS,
  });

  eventMigrator.register({
    eventType: 'ORDER_ITEM_STATUS_CHANGED',
    currentVersion: getCurrentVersion('ORDER_ITEM_STATUS_CHANGED'),
    migrations: ORDER_ITEM_STATUS_CHANGED_MIGRATIONS,
  });

  eventMigrator.register({
    eventType: 'ORDER_ITEM_VOIDED',
    currentVersion: getCurrentVersion('ORDER_ITEM_VOIDED'),
    migrations: ORDER_ITEM_VOIDED_MIGRATIONS,
  });

  eventMigrator.register({
    eventType: 'ORDER_CANCELLED',
    currentVersion: getCurrentVersion('ORDER_CANCELLED'),
    migrations: ORDER_CANCELLED_MIGRATIONS,
  });

  // CHECK events (no migrations yet, all at V1)
  const checkEvents = [
    'CHECK_CREATED',
    'CHECK_PAYMENT_ADDED',
    'CHECK_MARKED_PAID',
    'CHECK_TIP_SET',
    'CHECK_ITEMS_UPDATED',
    'CHECK_ITEMS_MOVED',
  ];

  for (const eventType of checkEvents) {
    eventMigrator.register({
      eventType,
      currentVersion: getCurrentVersion(eventType),
      migrations: [],
    });
  }

  // SHIFT events (no migrations yet, all at V1)
  const shiftEvents = ['SHIFT_OPENED', 'SHIFT_CLOSED', 'CASH_ADJUSTED'];

  for (const eventType of shiftEvents) {
    eventMigrator.register({
      eventType,
      currentVersion: getCurrentVersion(eventType),
      migrations: [],
    });
  }

  // INVOICE events (no migrations yet, all at V1)
  const invoiceEvents = ['INVOICE_ISSUED', 'INVOICE_VOIDED'];

  for (const eventType of invoiceEvents) {
    eventMigrator.register({
      eventType,
      currentVersion: getCurrentVersion(eventType),
      migrations: [],
    });
  }

  // CATALOG events (no migrations yet, all at V1)
  eventMigrator.register({
    eventType: 'CATALOG_VERSION_BUMPED',
    currentVersion: getCurrentVersion('CATALOG_VERSION_BUMPED'),
    migrations: [],
  });

  logger.info('EVENT_MIGRATOR_REGISTERED', 'Registered migrations for event types', { count: eventMigrator.getRegisteredTypes().length });
}

// Auto-register on import (for convenience)
registerAllMigrations();

// Re-export for convenience
export { eventMigrator } from '../event-migrator';
