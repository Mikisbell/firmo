// src/core/conflict/soft-lock.service.ts
// Soft Lock Service for PARK POS Multi-Terminal
// Soft locks are advisory only - they warn but don't block operations

import { logger } from '@/src/core/observability/logger';

type PrismaClientType = any;

const LOCK_TTL_MS = 30000; // 30 seconds

// ============================================================================
// Types
// ============================================================================

export interface LockInfo {
  isLocked: boolean;
  lockedBy?: string;
  expiresAt?: Date;
  remainingMs?: number;
}

export interface AcquireLockResult {
  acquired: boolean;
  existingLock?: LockInfo;
}

// ============================================================================
// Soft Lock Operations
// ============================================================================

/**
 * Intenta adquirir un soft lock para un agregado.
 * Si ya existe un lock de otro terminal, retorna info del lock existente.
 * Los soft locks son solo advertencias - no bloquean operaciones.
 */
export async function acquireSoftLock(
  prisma: PrismaClientType,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<AcquireLockResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  // First, check if there's an existing non-expired lock from another terminal
  const existing = await prisma.softLock.findUnique({
    where: {
      tenant_id_aggregate_type_aggregate_id: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
      },
    },
  });

  // If lock exists, is not expired, and belongs to another terminal
  if (existing && existing.expires_at > now && existing.terminal_id !== terminalId) {
    return {
      acquired: false,
      existingLock: {
        isLocked: true,
        lockedBy: existing.terminal_id,
        expiresAt: existing.expires_at,
        remainingMs: existing.expires_at.getTime() - now.getTime(),
      },
    };
  }

  // Create or update the lock
  try {
    await prisma.softLock.upsert({
      where: {
        tenant_id_aggregate_type_aggregate_id: {
          tenant_id: tenantId,
          aggregate_type: aggregateType,
          aggregate_id: aggregateId,
        },
      },
      create: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        terminal_id: terminalId,
        locked_at: now,
        expires_at: expiresAt,
      },
      update: {
        terminal_id: terminalId,
        locked_at: now,
        expires_at: expiresAt,
      },
    });

    return { acquired: true };
  } catch (e) {
    logger.error('SOFT_LOCK_ACQUIRE_FAILED', 'Failed to acquire lock', e instanceof Error ? e : undefined, {});
    return { acquired: false };
  }
}

/**
 * Libera un soft lock.
 * Solo el terminal que tiene el lock puede liberarlo.
 */
export async function releaseSoftLock(
  prisma: PrismaClientType,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<boolean> {
  try {
    const result = await prisma.softLock.deleteMany({
      where: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        terminal_id: terminalId,
      },
    });
    return result.count > 0;
  } catch (e) {
    logger.error('SOFT_LOCK_RELEASE_FAILED', 'Failed to release lock', e instanceof Error ? e : undefined, {});
    return false;
  }
}

/**
 * Verifica si hay un soft lock activo para un agregado.
 * Retorna info del lock si existe y no ha expirado.
 */
export async function checkSoftLock(
  prisma: PrismaClientType,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<LockInfo> {
  const now = new Date();

  const existing = await prisma.softLock.findUnique({
    where: {
      tenant_id_aggregate_type_aggregate_id: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
      },
    },
  });

  // No lock or expired
  if (!existing || existing.expires_at <= now) {
    return { isLocked: false };
  }

  // Own lock - not considered locked
  if (existing.terminal_id === terminalId) {
    return { isLocked: false };
  }

  // Another terminal's active lock
  return {
    isLocked: true,
    lockedBy: existing.terminal_id,
    expiresAt: existing.expires_at,
    remainingMs: existing.expires_at.getTime() - now.getTime(),
  };
}

/**
 * Renueva un soft lock existente.
 * Extiende el TTL si el terminal actual tiene el lock.
 */
export async function renewSoftLock(
  prisma: PrismaClientType,
  tenantId: string,
  aggregateType: string,
  aggregateId: string,
  terminalId: string
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  try {
    const result = await prisma.softLock.updateMany({
      where: {
        tenant_id: tenantId,
        aggregate_type: aggregateType,
        aggregate_id: aggregateId,
        terminal_id: terminalId,
      },
      data: {
        locked_at: now,
        expires_at: expiresAt,
      },
    });
    return result.count > 0;
  } catch (e) {
    logger.error('SOFT_LOCK_RENEW_FAILED', 'Failed to renew lock', e instanceof Error ? e : undefined, {});
    return false;
  }
}

/**
 * Limpia todos los soft locks expirados.
 * Puede ejecutarse periódicamente o de forma lazy.
 */
export async function cleanupExpiredLocks(prisma: PrismaClientType): Promise<number> {
  try {
    const result = await prisma.softLock.deleteMany({
      where: {
        expires_at: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      logger.info('SOFT_LOCK_CLEANUP', 'Cleaned up expired locks', { count: result.count });
    }
    return result.count;
  } catch (e) {
    logger.error('SOFT_LOCK_CLEANUP_FAILED', 'Failed to cleanup expired locks', e instanceof Error ? e : undefined, {});
    return 0;
  }
}

/**
 * Obtiene todos los locks activos para un tenant.
 * Útil para debugging y monitoreo.
 */
export async function getActiveLocks(
  prisma: PrismaClientType,
  tenantId: string
): Promise<Array<{ aggregateType: string; aggregateId: string; terminalId: string; expiresAt: Date }>> {
  const now = new Date();

  const locks = await prisma.softLock.findMany({
    where: {
      tenant_id: tenantId,
      expires_at: { gt: now },
    },
    select: {
      aggregate_type: true,
      aggregate_id: true,
      terminal_id: true,
      expires_at: true,
    },
  });

  return locks.map((l: { aggregate_type: string; aggregate_id: string; terminal_id: string; expires_at: Date }) => ({
    aggregateType: l.aggregate_type,
    aggregateId: l.aggregate_id,
    terminalId: l.terminal_id,
    expiresAt: l.expires_at,
  }));
}
