/**
 * Master Sync Worker (Web Worker)
 * 
 * Responsabilidades:
 * - Drenar el LocalEventStore (IndexedDB)
 * - Agrupar por aggregate_id (FIFO Particionado)
 * - Empujar al backend sin bloquear el Main Thread
 * - Emitir mensajes de estado masivos (Batching) a Zustand
 */

import { getLocalEventStore, type LocalEvent } from '../db/local-event-store';

// ============ PROTOCOLO DE MENSAJES ============

export type WorkerMessage = 
  | { type: 'WAKE_UP_AND_SYNC' };

export type SyncBatchUpdate = {
  type: 'SYNC_BATCH_UPDATE';
  payload: {
    synced_event_ids: string[];
    poison_pills: Array<{
      aggregate_id: string;
      event_id: string;
      error: string;
    }>;
  };
};

// ============ ESTADO DEL WORKER ============

let isSyncing = false;
let db = getLocalEventStore();

// ============ LISTENERS SRE ============

// 1. El "Boot Ping" o "Wake Up Ping" desde Zustand
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  if (event.data?.type === 'WAKE_UP_AND_SYNC') {
    void triggerSync();
  }
});

// 2. El Listener de Red Interno (Auto-Sanación)
self.addEventListener('online', () => {
  console.log('[Worker] Conexión recuperada. Despertando Sincronizador Maestro...');
  void triggerSync();
});

// ============ MOTOR DE SINCRONIZACIÓN ============

async function triggerSync() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const events = await db.getSyncableEvents();
    if (events.length === 0) return;

    // Agrupar por aggregate_id (Causalidad)
    const grouped = groupByAggregate(events);
    
    const syncedIds: string[] = [];
    const poisonPills: Array<{ aggregate_id: string; event_id: string; error: string }> = [];

    // Procesar cada Stream en paralelo o secuencial
    // (A nivel de arquitectura, cada aggregate es independiente)
    for (const [aggregateId, stream] of Object.entries(grouped)) {
      try {
        // Enviar stream al servidor
        // En un entorno real, haríamos un fetch a '/api/events/sync'
        // Mock de red para ilustrar la lógica:
        const response = await simulateNetworkRequest(stream);

        if (response.ok) {
          syncedIds.push(...stream.map(e => e.event_id));
        } else if (response.status >= 400 && response.status < 500) {
          // HTTP 4xx = Poison Pill (Error de Negocio, no reintentable)
          // El Head-of-Line Blocking se detiene aquí solo para este agregado
          const errorMsg = response.error || 'Validation Failed';
          poisonPills.push({
            aggregate_id: aggregateId,
            event_id: stream[0].event_id, // Identificamos al culpable
            error: errorMsg
          });
          
          // No enviamos el resto de eventos de este stream hoy
        } else {
          // HTTP 5xx o Network Error puro
          // Se reintentará en el próximo WAKE_UP o backoff
          throw new Error('Servidor inalcanzable');
        }
      } catch (error) {
        // Ignorar para continuar con el siguiente aggregate_id
        console.warn(`[Worker] Stream ${aggregateId} falló temporalmente:`, error);
      }
    }

    // 1. Limpiar IndexedDB (Trabajo sucio de disco)
    await db.cleanupSyncedEvents(syncedIds);
    await db.applyPoisonPills(poisonPills);

    // 2. Disparar Mensaje Consolidado (Batching al Main Thread)
    if (syncedIds.length > 0 || poisonPills.length > 0) {
      const updateMessage: SyncBatchUpdate = {
        type: 'SYNC_BATCH_UPDATE',
        payload: {
          synced_event_ids: syncedIds,
          poison_pills: poisonPills
        }
      };
      self.postMessage(updateMessage);
    }

  } catch (error) {
    console.error('[Worker] Falla catastrófica en el ciclo de sincronización:', error);
  } finally {
    isSyncing = false;
  }
}

// ============ UTILS ============

function groupByAggregate(events: LocalEvent[]): Record<string, LocalEvent[]> {
  const groups: Record<string, LocalEvent[]> = {};
  for (const event of events) {
    if (!groups[event.aggregate_id]) {
      groups[event.aggregate_id] = [];
    }
    groups[event.aggregate_id].push(event);
  }
  return groups;
}

async function simulateNetworkRequest(stream: LocalEvent[]): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const response = await fetch('/api/data-sync/ingest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // FUNDAMENTAL: Enviar cookie HttpOnly (Ruta A SRE)
      credentials: 'include',
      body: JSON.stringify({ events: stream }),
    });

    if (response.ok) {
      return { ok: true, status: response.status };
    } else {
      let errorMsg = 'Error en el servidor';
      try {
        const body = await response.json();
        errorMsg = body.error || errorMsg;
      } catch (e) {
        // body not parseable
      }
      return { ok: false, status: response.status, error: errorMsg };
    }
  } catch (error) {
    // Falla de red (offline, DNS, timeout)
    return { ok: false, status: 0, error: 'Network Error' };
  }
}
