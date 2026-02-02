// src/core/conflict/conflict-resolver.ts
// Conflict Resolution Service for PARK POS Multi-Terminal

import { v4 as uuidv4 } from 'uuid';
import { Prisma } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";
import { conflictLogger, logger } from "@/src/core/observability/logger";

type TxClient = any;

// ============================================================================
// Types
// ============================================================================

export type ConflictType = 
  | "REVISION_CONFLICT" 
  | "PAYMENT_CONFLICT" 
  | "STATE_CONFLICT";

export type ResolutionStrategy = 
  | "MERGE" 
  | "LWW" 
  | "REJECT" 
  | "MANUAL";

export interface ConflictInfo {
  type: ConflictType;
  aggregate_id: string;
  expected_revision: number;
  actual_revision: number;
  resolution: ResolutionStrategy;
  merged_state?: unknown;
  rejected_reason?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflict?: ConflictInfo;
  shouldApply: boolean;
  mergedEvent?: ParkEvent;
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detecta y resuelve conflictos basado en revisión del agregado.
 * 
 * @param tx - Transacción de Prisma
 * @param event - Evento a procesar
 * @param currentRevision - Revisión actual del agregado en el servidor
 * @returns Resultado del conflicto con estrategia de resolución
 */
export async function detectAndResolveConflict(
  tx: TxClient,
  event: ParkEvent,
  currentRevision: number
): Promise<ConflictResult> {
  // Obtener expected_revision del evento o payload
  const expectedRevision = getExpectedRevision(event);
  
  // No revision check = no conflict detection (backward compatibility)
  if (expectedRevision === undefined || expectedRevision === null) {
    return { hasConflict: false, shouldApply: true };
  }
  
  // Revision matches = no conflict
  if (expectedRevision === currentRevision) {
    return { hasConflict: false, shouldApply: true };
  }
  
  // CONFLICT DETECTED
  conflictLogger.detected({
    order_id: event.aggregate_id,
    event_type: event.event_type,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
  });
  
  // Determine resolution strategy based on event type
  const strategy = getResolutionStrategy(event.event_type);
  
  switch (strategy) {
    case "MERGE":
      return await resolveMerge(tx, event, currentRevision, expectedRevision);
    
    case "LWW":
      return await resolveLWW(tx, event, currentRevision, expectedRevision);
    
    case "REJECT":
      return await resolveReject(tx, event, currentRevision, expectedRevision);
    
    default:
      return { 
        hasConflict: true, 
        shouldApply: false,
        conflict: {
          type: "REVISION_CONFLICT",
          aggregate_id: event.aggregate_id,
          expected_revision: expectedRevision,
          actual_revision: currentRevision,
          resolution: "REJECT",
          rejected_reason: "Unknown event type for conflict resolution",
        }
      };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getExpectedRevision(event: ParkEvent): number | undefined {
  // Check envelope level first
  if ('expected_revision' in event && typeof (event as any).expected_revision === 'number') {
    return (event as any).expected_revision;
  }
  
  // Check payload level
  const payload = event.payload as Record<string, unknown>;
  if (payload && typeof payload.expected_revision === 'number') {
    return payload.expected_revision;
  }
  
  return undefined;
}

/**
 * Determina la estrategia de resolución basada en el tipo de evento.
 * 
 * - Items → MERGE (no perder datos)
 * - Estados → LWW (último gana)
 * - Pagos → REJECT (requiere intervención manual)
 */
export function getResolutionStrategy(eventType: string): ResolutionStrategy {
  // Items de orden → MERGE (no perder datos)
  if (eventType === "ORDER_ITEM_ADDED" || eventType === "ORDER_ITEM_QTY_CHANGED") {
    return "MERGE";
  }
  
  // Estados de items → LWW (último timestamp gana)
  if (eventType === "ORDER_ITEM_STATUS_CHANGED") {
    return "LWW";
  }
  
  // Pagos → REJECT (requiere intervención manual - dinero es crítico)
  if (
    eventType === "CHECK_PAYMENT_ADDED" || 
    eventType === "CHECK_MARKED_PAID" ||
    eventType.includes("PAYMENT")
  ) {
    return "REJECT";
  }
  
  // Checks → MERGE (no perder datos)
  if (eventType === "CHECK_CREATED" || eventType === "CHECK_ITEMS_UPDATED") {
    return "MERGE";
  }
  
  // Default: LWW para otros eventos
  return "LWW";
}

// ============================================================================
// Resolution Strategies
// ============================================================================

/**
 * MERGE Strategy: Aplica el evento de todas formas.
 * Usado para ORDER_ITEM_ADDED donde queremos conservar ambos items.
 */
async function resolveMerge(
  tx: TxClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  // Log conflict for audit
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "REVISION_CONFLICT",
    resolution: "MERGED",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  conflictLogger.resolved({
    order_id: event.aggregate_id,
    event_type: event.event_type,
    resolution: "MERGE",
  });
  
  return {
    hasConflict: true,
    shouldApply: true, // Aplicar de todas formas (merge automático)
    conflict: {
      type: "REVISION_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "MERGE",
    }
  };
}

/**
 * LWW Strategy: Last-Write-Wins basado en timestamp.
 * El evento más reciente gana.
 */
async function resolveLWW(
  tx: TxClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  // Para LWW, siempre aplicamos el evento que llega
  // porque llegó después (es más reciente en términos de sync)
  // El servidor ya tiene eventos anteriores aplicados
  
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "REVISION_CONFLICT",
    resolution: "LWW",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  conflictLogger.resolved({
    order_id: event.aggregate_id,
    event_type: event.event_type,
    resolution: "LWW",
  });
  
  return {
    hasConflict: true,
    shouldApply: true,
    conflict: {
      type: "REVISION_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "LWW",
    }
  };
}

/**
 * REJECT Strategy: Rechaza el evento.
 * Usado para pagos donde conflictos requieren intervención manual.
 */
async function resolveReject(
  tx: TxClient,
  event: ParkEvent,
  currentRevision: number,
  expectedRevision: number
): Promise<ConflictResult> {
  await logConflict(tx, {
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    conflict_type: "PAYMENT_CONFLICT",
    resolution: "REJECTED",
    event_id: event.event_id,
    expected_revision: expectedRevision,
    actual_revision: currentRevision,
    terminal_id: event.terminal_id,
  });
  
  conflictLogger.rejected({
    order_id: event.aggregate_id,
    event_type: event.event_type,
    reason: "Payment conflict requires manual resolution",
  });
  
  return {
    hasConflict: true,
    shouldApply: false, // NO aplicar
    conflict: {
      type: "PAYMENT_CONFLICT",
      aggregate_id: event.aggregate_id,
      expected_revision: expectedRevision,
      actual_revision: currentRevision,
      resolution: "REJECT",
      rejected_reason: "Payment conflicts require manual resolution. Please refresh and retry.",
    }
  };
}

// ============================================================================
// Conflict Logging
// ============================================================================

async function logConflict(
  tx: TxClient,
  data: {
    tenant_id: string;
    aggregate_type: string;
    aggregate_id: string;
    conflict_type: string;
    resolution: string;
    event_id: string;
    expected_revision: number;
    actual_revision: number;
    terminal_id: string;
    local_state?: unknown;
    server_state?: unknown;
    merged_state?: unknown;
    resolved_by?: string;
  }
) {
  try {
    // IMPORTANTE: Usar conflict_logs (snake_case) según el modelo en schema.prisma
    // Ver docs/02-architecture/PRISMA_NAMING.md para convención de nombres
    await tx.conflict_logs.create({
      data: {
        id: uuidv4(),
        tenant_id: data.tenant_id,
        aggregate_type: data.aggregate_type,
        aggregate_id: data.aggregate_id,
        conflict_type: data.conflict_type,
        resolution: data.resolution,
        event_id: data.event_id,
        expected_revision: data.expected_revision,
        actual_revision: data.actual_revision,
        terminal_id: data.terminal_id,
        local_state: data.local_state as any,
        server_state: data.server_state as any,
        merged_state: data.merged_state as any,
        resolved_by: data.resolved_by,
      }
    });
  } catch (e) {
    logger.error('conflict.log_failed', 'Failed to log conflict', e instanceof Error ? e : new Error(String(e)));
    // Don't throw - logging failure shouldn't block the operation
  }
}

// ============================================================================
// State Transition Validation
// ============================================================================

const VALID_STATE_TRANSITIONS: Record<string, string[]> = {
  "PENDING": ["COOKING", "VOIDED"],
  "COOKING": ["READY", "VOIDED"],
  "READY": ["DONE", "VOIDED"],
  "DONE": ["VOIDED"], // Can only void from DONE
  "VOIDED": [], // Terminal state
};

/**
 * Valida que una transición de estado sea válida.
 * Rechaza transiciones inválidas como DONE→PENDING.
 */
export function isValidStateTransition(fromState: string, toState: string): boolean {
  const validNextStates = VALID_STATE_TRANSITIONS[fromState];
  if (!validNextStates) {
    return false; // Unknown state
  }
  return validNextStates.includes(toState);
}
