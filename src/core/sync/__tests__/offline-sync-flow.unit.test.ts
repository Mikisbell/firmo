/**
 * Unit Tests: Offline → Sync Flow Completa
 *
 * Valida el flujo completo de:
 * 1. Terminal pierde conexión → modo offline
 * 2. Cajero sigue vendiendo offline (eventos en Dexie)
 * 3. Conexión se restaura
 * 4. Sync envía eventos pendientes
 * 5. Conflictos se resuelven (REJECT para pagos duplicados)
 * 6. Sync completado, todos los eventos sincronizados
 *
 * REQUISITOS CRÍTICOS:
 * - Pagos conflictivos = REJECT (nunca cobro doble)
 * - Sync idempotente (no duplica aceptadas)
 * - Eventos se envían en orden de terminal_sequence
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Tipos del dominio de sync
// ============================================================

type SyncStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
type EventSyncStatus = 'pending' | 'syncing' | 'synced' | 'rejected' | 'conflict';

interface SyncEvent {
  event_id: string;
  event_type: string;
  tenant_id: string;
  terminal_id: string;
  terminal_sequence: number;
  aggregate_type: string;
  aggregate_id: string;
  occurred_at: string;
  payload: Record<string, any>;
  synced: EventSyncStatus;
  sync_attempts: number;
  last_sync_error?: string;
}

interface SyncResult {
  accepted: string[]; // event_ids aceptados
  rejected: Array<{ event_id: string; reason: string }>;
  merged: Array<{ event_id: string; strategy: string }>;
  deduped: string[];
}

interface SyncState {
  last_terminal_sequence_acked: number;
  backlog_count: number;
  last_sync_attempt_at: string | null;
  last_sync_ok_at: string | null;
  is_offline: boolean;
}

// ============================================================
// Funciones puras de negocio para sync
// ============================================================

/**
 * Calcula el backoff exponencial con jitter
 * Fórmula: min(maxDelay, baseDelay * 2^attempt * (1 + random * jitterRatio))
 */
function calculateBackoffDelay(
  attempt: number,
  options: { baseDelayMs?: number; maxDelayMs?: number; jitterRatio?: number } = {}
): number {
  const {
    baseDelayMs = 1000,
    maxDelayMs = 60000,
    jitterRatio = 0.2,
  } = options;

  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = exponentialDelay * jitterRatio * Math.random();
  const delay = exponentialDelay + jitter;

  return Math.min(delay, maxDelayMs);
}

/**
 * Construye un bloque contiguo de eventos para sync
 * Solo envía eventos consecutivos (sin gaps en terminal_sequence)
 */
function buildContiguousBlock(events: SyncEvent[]): SyncEvent[] {
  if (events.length === 0) return [];

  // Ordenar por terminal_sequence
  const sorted = [...events].sort((a, b) => a.terminal_sequence - b.terminal_sequence);

  const contiguous: SyncEvent[] = [sorted[0]];
  let expectedSequence = sorted[0].terminal_sequence + 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].terminal_sequence === expectedSequence) {
      contiguous.push(sorted[i]);
      expectedSequence++;
    } else {
      // Gap detectado, detener
      break;
    }
  }

  return contiguous;
}

/**
 * Valida que los eventos tengan UUIDs válidos
 * Filtra eventos con IDs falsos que causarían errores en el servidor
 */
function validateEventUUIDs(events: SyncEvent[]): Array<{ event: SyncEvent; isValid: boolean; reason?: string }> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return events.map(event => {
    if (!uuidRegex.test(event.event_id)) {
      return { event, isValid: false, reason: `Invalid event_id: ${event.event_id}` };
    }
    if (!uuidRegex.test(event.aggregate_id)) {
      return { event, isValid: false, reason: `Invalid aggregate_id: ${event.aggregate_id}` };
    }
    return { event, isValid: true };
  });
}

/**
 * Procesa respuesta de sync del servidor
 * Marca eventos como synced, rejected, o conflict según respuesta
 */
function processSyncResponse(
  events: SyncEvent[],
  response: SyncResult
): SyncEvent[] {
  return events.map(event => {
    if (response.accepted.includes(event.event_id)) {
      return { ...event, synced: 'synced' as EventSyncStatus, sync_attempts: 0 };
    }

    const rejected = response.rejected.find(r => r.event_id === event.event_id);
    if (rejected) {
      return {
        ...event,
        synced: 'rejected' as EventSyncStatus,
        sync_attempts: event.sync_attempts + 1,
        last_sync_error: rejected.reason,
      };
    }

    const merged = response.merged.find(m => m.event_id === event.event_id);
    if (merged) {
      return {
        ...event,
        synced: 'conflict' as EventSyncStatus,
        sync_attempts: event.sync_attempts + 1,
        last_sync_error: `Merged with strategy: ${merged.strategy}`,
      };
    }

    // No mencionado en respuesta, mantener como pending
    return event;
  });
}

/**
 * Determina si un evento debe ser reintentado
 * Criterios:
 * - Estado es 'pending' o 'rejected'
 * - Menos de 5 intentos
 * - No es un rechazo permanente (PAYMENT_CONFLICT)
 */
function shouldRetryEvent(event: SyncEvent): boolean {
  if (event.synced === 'synced') return false;
  if (event.sync_attempts >= 5) return false;
  if (event.last_sync_error?.includes('PAYMENT_CONFLICT')) return false;

  return event.synced === 'pending' || event.synced === 'rejected';
}

/**
 * Calcula métricas de sync
 */
function calculateSyncMetrics(events: SyncEvent[]): {
  total: number;
  synced: number;
  pending: number;
  rejected: number;
  conflict: number;
  syncRate: number;
} {
  const total = events.length;
  const synced = events.filter(e => e.synced === 'synced').length;
  const pending = events.filter(e => e.synced === 'pending').length;
  const rejected = events.filter(e => e.synced === 'rejected').length;
  const conflict = events.filter(e => e.synced === 'conflict').length;

  return {
    total,
    synced,
    pending,
    rejected,
    conflict,
    syncRate: total > 0 ? synced / total : 0,
  };
}

/**
 * Detecta si hay duplicados potenciales en eventos
 * (mismo aggregate_id + mismo event_type + timestamps cercanos)
 */
function detectPotentialDuplicates(events: SyncEvent[]): Array<{
  event1: string;
  event2: string;
  reason: string;
}> {
  const duplicates: Array<{ event1: string; event2: string; reason: string }> = [];
  const timeThresholdMs = 5000; // 5 segundos

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const e1 = events[i];
      const e2 = events[j];

      // Mismo aggregate y mismo tipo
      if (e1.aggregate_id === e2.aggregate_id && e1.event_type === e2.event_type) {
        const timeDiff = Math.abs(
          new Date(e1.occurred_at).getTime() - new Date(e2.occurred_at).getTime()
        );

        if (timeDiff < timeThresholdMs) {
          duplicates.push({
            event1: e1.event_id,
            event2: e2.event_id,
            reason: `Same aggregate ${e1.aggregate_id} with ${e1.event_type} within ${timeDiff}ms`,
          });
        }
      }
    }
  }

  return duplicates;
}

// ============================================================
// TESTS
// ============================================================

describe('Offline → Sync Flow', () => {

  // ----------------------------------------------------------
  // calculateBackoffDelay
  // ----------------------------------------------------------

  describe('calculateBackoffDelay', () => {

    it('should increase delay exponentially with attempts', () => {
      // Usar seed fijo para jitter determinista
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const delay0 = calculateBackoffDelay(0, { jitterRatio: 0 });
      const delay1 = calculateBackoffDelay(1, { jitterRatio: 0 });
      const delay2 = calculateBackoffDelay(2, { jitterRatio: 0 });
      const delay3 = calculateBackoffDelay(3, { jitterRatio: 0 });

      // 1000, 2000, 4000, 8000
      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
      expect(delay3).toBe(8000);

      vi.restoreAllMocks();
    });

    it('should cap delay at maxDelayMs', () => {
      const delay = calculateBackoffDelay(10, { maxDelayMs: 30000, jitterRatio: 0 });
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should add jitter to prevent thundering herd', () => {
      const delays = new Set<number>();

      for (let i = 0; i < 10; i++) {
        const delay = calculateBackoffDelay(2, { jitterRatio: 0.2 });
        delays.add(delay);
      }

      // Con jitter, no todos los delays deberían ser iguales
      expect(delays.size).toBeGreaterThan(1);
    });

    it('should use default parameters correctly', () => {
      const delay = calculateBackoffDelay(0, { jitterRatio: 0 });
      expect(delay).toBe(1000); // baseDelayMs default
    });
  });

  // ----------------------------------------------------------
  // buildContiguousBlock
  // ----------------------------------------------------------

  describe('buildContiguousBlock', () => {

    it('should build contiguous block from consecutive events', () => {
      const events: SyncEvent[] = [
        { terminal_sequence: 1, event_id: 'e1' } as SyncEvent,
        { terminal_sequence: 2, event_id: 'e2' } as SyncEvent,
        { terminal_sequence: 3, event_id: 'e3' } as SyncEvent,
      ];

      const block = buildContiguousBlock(events);

      expect(block).toHaveLength(3);
      expect(block.map(e => e.terminal_sequence)).toEqual([1, 2, 3]);
    });

    it('should stop at gap in sequence', () => {
      const events: SyncEvent[] = [
        { terminal_sequence: 1, event_id: 'e1' } as SyncEvent,
        { terminal_sequence: 2, event_id: 'e2' } as SyncEvent,
        { terminal_sequence: 5, event_id: 'e5' } as SyncEvent, // Gap
        { terminal_sequence: 6, event_id: 'e6' } as SyncEvent,
      ];

      const block = buildContiguousBlock(events);

      expect(block).toHaveLength(2);
      expect(block.map(e => e.terminal_sequence)).toEqual([1, 2]);
    });

    it('should handle unsorted events', () => {
      const events: SyncEvent[] = [
        { terminal_sequence: 3, event_id: 'e3' } as SyncEvent,
        { terminal_sequence: 1, event_id: 'e1' } as SyncEvent,
        { terminal_sequence: 2, event_id: 'e2' } as SyncEvent,
      ];

      const block = buildContiguousBlock(events);

      expect(block).toHaveLength(3);
      expect(block.map(e => e.terminal_sequence)).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty input', () => {
      expect(buildContiguousBlock([])).toEqual([]);
    });

    it('should return single event for single input', () => {
      const events: SyncEvent[] = [
        { terminal_sequence: 1, event_id: 'e1' } as SyncEvent,
      ];

      const block = buildContiguousBlock(events);

      expect(block).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // validateEventUUIDs
  // ----------------------------------------------------------

  describe('validateEventUUIDs', () => {

    it('should validate correct UUIDs', () => {
      const events: SyncEvent[] = [
        {
          event_id: '550e8400-e29b-41d4-a716-446655440000',
          aggregate_id: '550e8400-e29b-41d4-a716-446655440001',
        } as SyncEvent,
      ];

      const results = validateEventUUIDs(events);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
    });

    it('should reject invalid event_id', () => {
      const events: SyncEvent[] = [
        {
          event_id: 'invalid-uuid',
          aggregate_id: '550e8400-e29b-41d4-a716-446655440001',
        } as SyncEvent,
      ];

      const results = validateEventUUIDs(events);

      expect(results[0].isValid).toBe(false);
      expect(results[0].reason).toContain('Invalid event_id');
    });

    it('should reject fake IDs used in tests', () => {
      const events: SyncEvent[] = [
        {
          event_id: 'p1',
          aggregate_id: 'prod_001',
        } as SyncEvent,
      ];

      const results = validateEventUUIDs(events);

      expect(results[0].isValid).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // processSyncResponse
  // ----------------------------------------------------------

  describe('processSyncResponse', () => {

    it('should mark accepted events as synced', () => {
      const events: SyncEvent[] = [
        { event_id: 'e1', synced: 'pending', sync_attempts: 0 } as SyncEvent,
        { event_id: 'e2', synced: 'pending', sync_attempts: 0 } as SyncEvent,
      ];

      const response: SyncResult = {
        accepted: ['e1'],
        rejected: [],
        merged: [],
        deduped: [],
      };

      const updated = processSyncResponse(events, response);

      expect(updated[0].synced).toBe('synced');
      expect(updated[0].sync_attempts).toBe(0);
      expect(updated[1].synced).toBe('pending'); // No mencionado
    });

    it('should mark rejected events with error', () => {
      const events: SyncEvent[] = [
        { event_id: 'e1', synced: 'pending', sync_attempts: 0 } as SyncEvent,
      ];

      const response: SyncResult = {
        accepted: [],
        rejected: [{ event_id: 'e1', reason: 'PAYMENT_CONFLICT' }],
        merged: [],
        deduped: [],
      };

      const updated = processSyncResponse(events, response);

      expect(updated[0].synced).toBe('rejected');
      expect(updated[0].sync_attempts).toBe(1);
      expect(updated[0].last_sync_error).toBe('PAYMENT_CONFLICT');
    });

    it('should mark merged events with strategy', () => {
      const events: SyncEvent[] = [
        { event_id: 'e1', synced: 'pending', sync_attempts: 0 } as SyncEvent,
      ];

      const response: SyncResult = {
        accepted: [],
        rejected: [],
        merged: [{ event_id: 'e1', strategy: 'MERGE' }],
        deduped: [],
      };

      const updated = processSyncResponse(events, response);

      expect(updated[0].synced).toBe('conflict');
      expect(updated[0].last_sync_error).toContain('MERGE');
    });
  });

  // ----------------------------------------------------------
  // shouldRetryEvent
  // ----------------------------------------------------------

  describe('shouldRetryEvent', () => {

    it('should retry pending events', () => {
      const event: SyncEvent = {
        synced: 'pending',
        sync_attempts: 0,
      } as SyncEvent;

      expect(shouldRetryEvent(event)).toBe(true);
    });

    it('should retry rejected events with few attempts', () => {
      const event: SyncEvent = {
        synced: 'rejected',
        sync_attempts: 2,
        last_sync_error: 'NETWORK_ERROR',
      } as SyncEvent;

      expect(shouldRetryEvent(event)).toBe(true);
    });

    it('should NOT retry synced events', () => {
      const event: SyncEvent = {
        synced: 'synced',
        sync_attempts: 0,
      } as SyncEvent;

      expect(shouldRetryEvent(event)).toBe(false);
    });

    it('should NOT retry events with max attempts', () => {
      const event: SyncEvent = {
        synced: 'rejected',
        sync_attempts: 5,
        last_sync_error: 'NETWORK_ERROR',
      } as SyncEvent;

      expect(shouldRetryEvent(event)).toBe(false);
    });

    it('should NOT retry PAYMENT_CONFLICT events', () => {
      const event: SyncEvent = {
        synced: 'rejected',
        sync_attempts: 1,
        last_sync_error: 'PAYMENT_CONFLICT',
      } as SyncEvent;

      expect(shouldRetryEvent(event)).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // calculateSyncMetrics
  // ----------------------------------------------------------

  describe('calculateSyncMetrics', () => {

    it('should calculate correct metrics', () => {
      const events: SyncEvent[] = [
        { synced: 'synced' } as SyncEvent,
        { synced: 'synced' } as SyncEvent,
        { synced: 'pending' } as SyncEvent,
        { synced: 'rejected' } as SyncEvent,
        { synced: 'conflict' } as SyncEvent,
      ];

      const metrics = calculateSyncMetrics(events);

      expect(metrics.total).toBe(5);
      expect(metrics.synced).toBe(2);
      expect(metrics.pending).toBe(1);
      expect(metrics.rejected).toBe(1);
      expect(metrics.conflict).toBe(1);
      expect(metrics.syncRate).toBe(0.4); // 2/5
    });

    it('should handle empty events', () => {
      const metrics = calculateSyncMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.syncRate).toBe(0);
    });

    it('should show 100% sync rate when all synced', () => {
      const events: SyncEvent[] = [
        { synced: 'synced' } as SyncEvent,
        { synced: 'synced' } as SyncEvent,
      ];

      const metrics = calculateSyncMetrics(events);

      expect(metrics.syncRate).toBe(1.0);
    });
  });

  // ----------------------------------------------------------
  // detectPotentialDuplicates
  // ----------------------------------------------------------

  describe('detectPotentialDuplicates', () => {

    it('should detect duplicates with same aggregate and type', () => {
      const now = new Date().toISOString();
      const events: SyncEvent[] = [
        {
          event_id: 'e1',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: now,
        } as SyncEvent,
        {
          event_id: 'e2',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: new Date(Date.now() + 1000).toISOString(), // 1s después
        } as SyncEvent,
      ];

      const duplicates = detectPotentialDuplicates(events);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].reason).toContain('order-1');
    });

    it('should NOT detect duplicates with different aggregates', () => {
      const now = new Date().toISOString();
      const events: SyncEvent[] = [
        {
          event_id: 'e1',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: now,
        } as SyncEvent,
        {
          event_id: 'e2',
          aggregate_id: 'order-2',
          event_type: 'SALE_COMPLETED',
          occurred_at: new Date(Date.now() + 1000).toISOString(),
        } as SyncEvent,
      ];

      const duplicates = detectPotentialDuplicates(events);

      expect(duplicates).toHaveLength(0);
    });

    it('should NOT detect duplicates with different types', () => {
      const now = new Date().toISOString();
      const events: SyncEvent[] = [
        {
          event_id: 'e1',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: now,
        } as SyncEvent,
        {
          event_id: 'e2',
          aggregate_id: 'order-1',
          event_type: 'PAYMENT_PROCESSED',
          occurred_at: new Date(Date.now() + 1000).toISOString(),
        } as SyncEvent,
      ];

      const duplicates = detectPotentialDuplicates(events);

      expect(duplicates).toHaveLength(0);
    });

    it('should NOT detect duplicates with far timestamps', () => {
      const events: SyncEvent[] = [
        {
          event_id: 'e1',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: new Date('2026-04-09T10:00:00').toISOString(),
        } as SyncEvent,
        {
          event_id: 'e2',
          aggregate_id: 'order-1',
          event_type: 'SALE_COMPLETED',
          occurred_at: new Date('2026-04-09T10:10:00').toISOString(), // 10 min después
        } as SyncEvent,
      ];

      const duplicates = detectPotentialDuplicates(events);

      expect(duplicates).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Escenario completo: Offline → Sync con conflicto
  // ----------------------------------------------------------

  describe('Complete Offline → Sync Scenario', () => {

    it('should simulate offline sales flow correctly', () => {
      // ESCENARIO: Terminal pierde conexión, vende offline, reconecta y sincroniza

      // Paso 1: Eventos creados offline
      const offlineEvents: SyncEvent[] = [
        {
          event_id: '550e8400-e29b-41d4-a716-446655440100',
          event_type: 'SALE_COMPLETED',
          terminal_sequence: 10,
          aggregate_id: '550e8400-e29b-41d4-a716-446655440200',
          synced: 'pending',
          sync_attempts: 0,
          occurred_at: new Date().toISOString(),
        } as SyncEvent,
        {
          event_id: '550e8400-e29b-41d4-a716-446655440101',
          event_type: 'SALE_COMPLETED',
          terminal_sequence: 11,
          aggregate_id: '550e8400-e29b-41d4-a716-446655440201',
          synced: 'pending',
          sync_attempts: 0,
          occurred_at: new Date().toISOString(),
        } as SyncEvent,
        {
          event_id: '550e8400-e29b-41d4-a716-446655440102',
          event_type: 'SALE_COMPLETED',
          terminal_sequence: 12,
          aggregate_id: '550e8400-e29b-41d4-a716-446655440202',
          synced: 'pending',
          sync_attempts: 0,
          occurred_at: new Date().toISOString(),
        } as SyncEvent,
      ];

      // Paso 2: Construir bloque contiguo
      const block = buildContiguousBlock(offlineEvents);
      expect(block).toHaveLength(3);

      // Paso 3: Validar UUIDs
      const validations = validateEventUUIDs(block);
      expect(validations.every(v => v.isValid)).toBe(true);

      // Paso 4: Simular respuesta del servidor (todos aceptados)
      const serverResponse: SyncResult = {
        accepted: block.map(e => e.event_id),
        rejected: [],
        merged: [],
        deduped: [],
      };

      // Paso 5: Procesar respuesta
      const updatedEvents = processSyncResponse(offlineEvents, serverResponse);

      // Paso 6: Verificar métricas
      const metrics = calculateSyncMetrics(updatedEvents);
      expect(metrics.synced).toBe(3);
      expect(metrics.syncRate).toBe(1.0);
      expect(metrics.rejected).toBe(0);
    });

    it('should handle conflict scenario with REJECT policy', () => {
      // ESCENARIO: Venta duplicada detectada, política REJECT para pagos

      const offlineEvents: SyncEvent[] = [
        {
          event_id: '550e8400-e29b-41d4-a716-446655440200',
          event_type: 'CHECK_PAYMENT_ADDED',
          terminal_sequence: 20,
          aggregate_id: 'order-301',
          synced: 'pending',
          sync_attempts: 0,
          occurred_at: new Date().toISOString(),
        } as SyncEvent,
      ];

      // Servidor detecta conflicto de pago (ya fue cobrado en otro terminal)
      const serverResponse: SyncResult = {
        accepted: [],
        rejected: [
          {
            event_id: '550e8400-e29b-41d4-a716-446655440200',
            reason: 'PAYMENT_CONFLICT: Payment already exists for this check',
          },
        ],
        merged: [],
        deduped: [],
      };

      // Procesar respuesta
      const updatedEvents = processSyncResponse(offlineEvents, serverResponse);

      // Verificar que el evento fue rechazado
      expect(updatedEvents[0].synced).toBe('rejected');
      expect(updatedEvents[0].last_sync_error).toContain('PAYMENT_CONFLICT');

      // Verificar que NO se debe reintentar
      expect(shouldRetryEvent(updatedEvents[0])).toBe(false);

      // Métricas finales
      const metrics = calculateSyncMetrics(updatedEvents);
      expect(metrics.rejected).toBe(1);
      expect(metrics.syncRate).toBe(0);
    });

    it('should handle mixed scenario with accepts, rejects, and merges', () => {
      const offlineEvents: SyncEvent[] = [
        {
          event_id: '550e8400-e29b-41d4-a716-446655440300',
          event_type: 'SALE_COMPLETED',
          terminal_sequence: 30,
          aggregate_id: 'order-401',
          synced: 'pending',
          sync_attempts: 0,
        } as SyncEvent,
        {
          event_id: '550e8400-e29b-41d4-a716-446655440301',
          event_type: 'CHECK_PAYMENT_ADDED',
          terminal_sequence: 31,
          aggregate_id: 'order-402',
          synced: 'pending',
          sync_attempts: 0,
        } as SyncEvent,
        {
          event_id: '550e8400-e29b-41d4-a716-446655440302',
          event_type: 'ORDER_ITEM_STATUS_CHANGED',
          terminal_sequence: 32,
          aggregate_id: 'order-403',
          synced: 'pending',
          sync_attempts: 0,
        } as SyncEvent,
      ];

      // Respuesta mixta del servidor
      const serverResponse: SyncResult = {
        accepted: ['550e8400-e29b-41d4-a716-446655440300'], // Venta aceptada
        rejected: [
          {
            event_id: '550e8400-e29b-41d4-a716-446655440301',
            reason: 'PAYMENT_CONFLICT',
          },
        ],
        merged: [
          {
            event_id: '550e8400-e29b-41d4-a716-446655440302',
            strategy: 'LWW',
          },
        ],
        deduped: [],
      };

      const updatedEvents = processSyncResponse(offlineEvents, serverResponse);
      const metrics = calculateSyncMetrics(updatedEvents);

      expect(metrics.total).toBe(3);
      expect(metrics.synced).toBe(1);
      expect(metrics.rejected).toBe(1);
      expect(metrics.conflict).toBe(1);
      expect(metrics.syncRate).toBe(1 / 3);
    });
  });
});
