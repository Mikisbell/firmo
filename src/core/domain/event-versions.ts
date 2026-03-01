// src/core/domain/event-versions.ts
// Event Schema Version Registry
// Tracks current version for each event type

/**
 * Current schema version for each event type.
 * Increment when adding new fields or changing structure.
 * 
 * Version History:
 * - V1: Initial schema (MVP)
 * - V2: Added delivery fields to ORDER_CREATED, timestamps to ORDER_ITEM_ADDED
 */
export const EVENT_VERSIONS: Record<string, number> = {
  // Order events
  ORDER_CREATED: 2,
  ORDER_ITEM_ADDED: 2,
  ORDER_ITEM_QTY_CHANGED: 1,
  ORDER_ITEM_STATUS_CHANGED: 1,
  ORDER_ITEM_VOIDED: 1,
  ORDER_CANCELLED: 1,
  
  // Check events (split bill)
  CHECK_CREATED: 1,
  CHECK_PAYMENT_ADDED: 1,
  CHECK_MARKED_PAID: 1,
  CHECK_TIP_SET: 1,
  CHECK_ITEMS_UPDATED: 1,
  CHECK_ITEMS_MOVED: 1,
  
  // Shift events
  SHIFT_OPENED: 1,
  SHIFT_CLOSED: 1,
  CASH_ADJUSTED: 1,
  
  // Invoice events
  INVOICE_ISSUED: 1,
  INVOICE_VOIDED: 1,

  // Credit note events
  CREDIT_NOTE_ISSUED: 1,
  CREDIT_NOTE_VOIDED: 1,

  // Catalog events
  CATALOG_VERSION_BUMPED: 1,
};

/**
 * Get the current schema version for an event type.
 * Returns 1 for unknown event types (backward compatible).
 */
export function getCurrentVersion(eventType: string): number {
  return EVENT_VERSIONS[eventType] ?? 1;
}

/**
 * Check if an event needs migration.
 * Returns true if the event's version is less than current.
 */
export function needsMigration(eventType: string, eventVersion: number): boolean {
  const currentVersion = getCurrentVersion(eventType);
  return eventVersion < currentVersion;
}

/**
 * Get all supported event types.
 */
export function getSupportedEventTypes(): string[] {
  return Object.keys(EVENT_VERSIONS);
}

/**
 * Validate that an event type is known.
 */
export function isKnownEventType(eventType: string): boolean {
  return eventType in EVENT_VERSIONS;
}
