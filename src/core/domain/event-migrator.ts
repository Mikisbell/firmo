// src/core/domain/event-migrator.ts
// Event Schema Migration Service
// Transforms events from old versions to current version

import { logger } from '@/src/core/observability/logger';
import { getCurrentVersion, needsMigration as checkNeedsMigration } from './event-versions';
import type { ParkEvent } from './events';

/**
 * Migration function type.
 * Takes a payload and returns the migrated payload.
 */
export type MigrationFunction = (payload: unknown) => unknown;

/**
 * Single migration step from one version to the next.
 */
export interface EventMigration {
  fromVersion: number;
  toVersion: number;
  migrate: MigrationFunction;
}

/**
 * Configuration for an event type's migrations.
 */
export interface EventMigratorConfig {
  eventType: string;
  currentVersion: number;
  migrations: EventMigration[];
}

/**
 * Event Migrator Service.
 * Handles migration of events from old schema versions to current.
 */
class EventMigratorService {
  private registry: Map<string, EventMigratorConfig> = new Map();
  private migrationCache: Map<string, Map<number, MigrationFunction>> = new Map();

  /**
   * Register migrations for an event type.
   */
  register(config: EventMigratorConfig): void {
    this.registry.set(config.eventType, config);
    
    // Build migration cache for fast lookup
    const cache = new Map<number, MigrationFunction>();
    for (const migration of config.migrations) {
      cache.set(migration.fromVersion, migration.migrate);
    }
    this.migrationCache.set(config.eventType, cache);
  }

  /**
   * Check if an event needs migration.
   */
  needsMigration(event: ParkEvent): boolean {
    const eventVersion = (event as any).payload_version ?? (event as any).schema_version ?? 1;
    return checkNeedsMigration(event.event_type, eventVersion);
  }

  /**
   * Migrate an event to the current schema version.
   * Returns a NEW event object - does NOT modify the original.
   */
  migrate(event: ParkEvent): ParkEvent {
    const eventType = event.event_type;
    const eventVersion = (event as any).payload_version ?? (event as any).schema_version ?? 1;
    const currentVersion = getCurrentVersion(eventType);

    // No migration needed
    if (eventVersion >= currentVersion) {
      return event;
    }

    const config = this.registry.get(eventType);
    if (!config) {
      // No migrations registered, return as-is with warning
      logger.warn('EVENT_MIGRATOR_NO_MIGRATIONS', 'No migrations registered for event type', { eventType });
      return event;
    }

    const cache = this.migrationCache.get(eventType);
    if (!cache) {
      return event;
    }

    // Apply migrations sequentially
    let payload: unknown = event.payload;
    let version = eventVersion;

    while (version < currentVersion) {
      const migrateFn = cache.get(version);
      if (!migrateFn) {
        logger.warn('EVENT_MIGRATOR_MISSING_MIGRATION', 'Missing migration step', { eventType, fromVersion: version, toVersion: version + 1 });
        break;
      }

      payload = migrateFn(payload);
      version++;
    }

    // Return NEW event object with migrated payload
    // Use Object.assign to avoid spread type issues
    const migratedEvent = Object.assign({}, event, {
      payload,
      payload_version: currentVersion,
    });
    
    return migratedEvent;
  }

  /**
   * Get current version for an event type.
   */
  getCurrentVersion(eventType: string): number {
    return getCurrentVersion(eventType);
  }

  /**
   * Get all registered event types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}

// Singleton instance
export const eventMigrator = new EventMigratorService();

// Export class for testing
export { EventMigratorService };
