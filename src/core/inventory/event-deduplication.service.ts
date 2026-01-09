/**
 * Event Deduplication Service
 * 
 * Ensures idempotent event processing by checking event_id uniqueness.
 * Requirements: 7.3 - Event deduplication
 * 
 * @module event-deduplication.service
 */

import prisma from '@/src/core/db/prisma';

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingEventId?: string;
  processedAt?: Date;
}

/**
 * Check if an event has already been processed
 */
export async function checkEventDuplicate(
  eventId: string,
  tenantId: string
): Promise<DeduplicationResult> {
  // Check in events table
  const existingEvent = await prisma.events.findFirst({
    where: {
      id: eventId,
      tenant_id: tenantId,
    },
    select: {
      id: true,
      occurred_at: true,
    },
  });

  if (existingEvent) {
    return {
      isDuplicate: true,
      existingEventId: existingEvent.id,
      processedAt: existingEvent.occurred_at,
    };
  }

  // Also check processed_events table if it exists
  try {
    const processedEvent = await prisma.processed_events.findFirst({
      where: {
        event_id: eventId,
        tenant_id: tenantId,
      },
      select: {
        event_id: true,
        processed_at: true,
      },
    });

    if (processedEvent) {
      return {
        isDuplicate: true,
        existingEventId: processedEvent.event_id,
        processedAt: processedEvent.processed_at,
      };
    }
  } catch {
    // processed_events table might not exist, ignore
  }

  return { isDuplicate: false };
}

/**
 * Mark an event as processed (for idempotency)
 */
export async function markEventProcessed(
  eventId: string,
  tenantId: string,
  eventType: string
): Promise<void> {
  try {
    await prisma.processed_events.create({
      data: {
        event_id: eventId,
        tenant_id: tenantId,
        event_type: eventType,
        processed_at: new Date(),
      },
    });
  } catch (error) {
    // Ignore duplicate key errors (event already processed)
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('Unique constraint')) {
      throw error;
    }
  }
}

/**
 * Process an event with deduplication
 * Returns true if event was processed, false if it was a duplicate
 */
export async function processEventWithDeduplication<T>(
  eventId: string,
  tenantId: string,
  eventType: string,
  processor: () => Promise<T>
): Promise<{ processed: boolean; result?: T; duplicate?: boolean }> {
  // 1. Check for duplicate
  const dedup = await checkEventDuplicate(eventId, tenantId);
  if (dedup.isDuplicate) {
    return { processed: false, duplicate: true };
  }

  // 2. Process the event
  const result = await processor();

  // 3. Mark as processed
  await markEventProcessed(eventId, tenantId, eventType);

  return { processed: true, result };
}

/**
 * Batch check for duplicate events
 */
export async function checkBatchDuplicates(
  eventIds: string[],
  tenantId: string
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  // Initialize all as not duplicate
  for (const id of eventIds) {
    results.set(id, false);
  }

  // Check events table
  const existingEvents = await prisma.events.findMany({
    where: {
      id: { in: eventIds },
      tenant_id: tenantId,
    },
    select: { id: true },
  });

  for (const event of existingEvents) {
    results.set(event.id, true);
  }

  // Check processed_events table
  try {
    const processedEvents = await prisma.processed_events.findMany({
      where: {
        event_id: { in: eventIds },
        tenant_id: tenantId,
      },
      select: { event_id: true },
    });

    for (const event of processedEvents) {
      results.set(event.event_id, true);
    }
  } catch {
    // processed_events table might not exist, ignore
  }

  return results;
}
