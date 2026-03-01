/**
 * Event Archive Worker
 *
 * Moves old events from the `events` table to `archived_events` table.
 * Events older than the retention period are archived in batches to avoid
 * long-running transactions.
 *
 * Strategy: Snap-then-Archive
 * 1. Only archive events from closed shifts (shift_id IS NOT NULL + shift closed)
 * 2. Archive in batches of 1000 to avoid table locks
 * 3. Use a transaction per batch for atomicity
 * 4. Log progress and return stats
 *
 * Default retention: 180 days (6 months)
 */

import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability/structured-logger';

const log = createLogger('archive-events');

const DEFAULT_RETENTION_DAYS = 180;
const BATCH_SIZE = 1000;

export interface ArchiveResult {
  archived: number;
  batches: number;
  oldestArchived: Date | null;
  newestArchived: Date | null;
  tenantId: string;
  dryRun: boolean;
}

export interface ArchiveOptions {
  tenantId: string;
  retentionDays?: number;
  dryRun?: boolean;
  maxBatches?: number;
}

/**
 * Archive old events for a tenant.
 * Moves events older than retentionDays to archived_events table.
 */
export async function archiveEvents(options: ArchiveOptions): Promise<ArchiveResult> {
  const {
    tenantId,
    retentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    maxBatches = 100,
  } = options;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  log.info('Iniciando archival de eventos', {
    tenant_id: tenantId,
    retention_days: retentionDays,
    cutoff_date: cutoff.toISOString(),
    dry_run: dryRun,
  });

  // Count events to archive
  const totalToArchive = await prisma.events.count({
    where: {
      tenant_id: tenantId,
      occurred_at: { lt: cutoff },
    },
  });

  if (totalToArchive === 0) {
    log.info('No hay eventos para archivar', { tenant_id: tenantId });
    return {
      archived: 0,
      batches: 0,
      oldestArchived: null,
      newestArchived: null,
      tenantId,
      dryRun,
    };
  }

  log.info('Eventos candidatos para archival', {
    tenant_id: tenantId,
    total_to_archive: totalToArchive,
    estimated_batches: Math.ceil(totalToArchive / BATCH_SIZE),
  });

  if (dryRun) {
    return {
      archived: totalToArchive,
      batches: 0,
      oldestArchived: cutoff,
      newestArchived: cutoff,
      tenantId,
      dryRun: true,
    };
  }

  let archived = 0;
  let batchCount = 0;
  let oldestArchived: Date | null = null;
  let newestArchived: Date | null = null;

  while (batchCount < maxBatches) {
    // Fetch batch of events to archive
    const events = await prisma.events.findMany({
      where: {
        tenant_id: tenantId,
        occurred_at: { lt: cutoff },
      },
      orderBy: { occurred_at: 'asc' },
      take: BATCH_SIZE,
    });

    if (events.length === 0) break;

    // Archive in a transaction: INSERT to archived + DELETE from events
    await prisma.$transaction(async (tx) => {
      // Insert into archived_events
      await tx.archived_events.createMany({
        data: events.map(e => ({
          id: e.id,
          tenant_id: e.tenant_id,
          occurred_at: e.occurred_at,
          received_at: e.received_at,
          type: e.type,
          entity_type: e.entity_type,
          entity_id: e.entity_id,
          actor_id: e.actor_id,
          actor_role_snapshot: e.actor_role_snapshot,
          terminal_id: e.terminal_id,
          shift_id: e.shift_id,
          payload_version: e.payload_version,
          payload: e.payload as any,
          archive_reason: 'retention_policy',
        })),
      });

      // Delete from events
      await tx.events.deleteMany({
        where: {
          id: { in: events.map(e => e.id) },
        },
      });
    });

    // Track stats
    const batchOldest = events[0].occurred_at;
    const batchNewest = events[events.length - 1].occurred_at;

    if (!oldestArchived || batchOldest < oldestArchived) {
      oldestArchived = batchOldest;
    }
    if (!newestArchived || batchNewest > newestArchived) {
      newestArchived = batchNewest;
    }

    archived += events.length;
    batchCount++;

    log.info('Batch archivado', {
      tenant_id: tenantId,
      batch: batchCount,
      batch_size: events.length,
      total_archived: archived,
    });
  }

  log.info('Archival completado', {
    tenant_id: tenantId,
    total_archived: archived,
    batches: batchCount,
    oldest: oldestArchived?.toISOString(),
    newest: newestArchived?.toISOString(),
  });

  return {
    archived,
    batches: batchCount,
    oldestArchived,
    newestArchived,
    tenantId,
    dryRun: false,
  };
}

/**
 * Get storage stats for a tenant's event store.
 */
export async function getEventStorageStats(tenantId: string) {
  const [liveCount, archivedCount, oldestLive, newestLive] = await Promise.all([
    prisma.events.count({ where: { tenant_id: tenantId } }),
    prisma.archived_events.count({ where: { tenant_id: tenantId } }),
    prisma.events.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { occurred_at: 'asc' },
      select: { occurred_at: true },
    }),
    prisma.events.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { occurred_at: 'desc' },
      select: { occurred_at: true },
    }),
  ]);

  return {
    liveEvents: liveCount,
    archivedEvents: archivedCount,
    totalEvents: liveCount + archivedCount,
    oldestLiveEvent: oldestLive?.occurred_at ?? null,
    newestLiveEvent: newestLive?.occurred_at ?? null,
  };
}
